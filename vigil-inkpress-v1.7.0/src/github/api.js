import {isGitCryptBlob,encryptGitCryptBytes,decryptGitCryptBytes,encodeGitCryptText,decodeGitCryptText,gitCryptRuleMatches,gitCryptRuleDetail} from '../security/git-crypt.js';
// GitHub REST Contents API client: localhost allows a narrowly scoped same-origin
// relay; static web deployments use direct CORS fetch. No persisted token.
// The fine-grained PAT is retained only in JS memory until the page closes.
export const GITHUB_CONFIG_KEY='vigil-github-repository-v1';

export function normalizeRepoConfig(input) {
  const raw=String(input.repoUrl||'').trim().replace(/\.git$/,'').replace(/\/$/,'');
  let owner=String(input.owner||'').trim(), repo=String(input.repo||'').trim();
  if(raw){
    const match=raw.match(/^(?:https?:\/\/github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/i);
    if(!match)throw new Error('仓库地址应为 https://github.com/用户名/仓库名');
    owner=match[1];repo=match[2];
  }
  if(!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(owner)) throw new Error('GitHub 用户名或组织名无效');
  if(!/^[a-z0-9_.-]{1,100}$/i.test(repo)||repo==='.'||repo==='..')throw new Error('仓库名称无效');
  const branch=String(input.branch||'').trim()||'';
  if(branch && (branch.length>200||branch.startsWith('/')||branch.endsWith('/')||
     branch.includes('..')||/[~^:?*\[\]\\\s]/.test(branch)))throw new Error('分支名称格式无效');
  const folder=normalizePath(input.folder||'');
  return {owner,repo,branch,folder};
}
export function normalizePath(path='') {
  const v=String(path).replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');
  if(v.split('/').some(segment=>segment==='.'||segment==='..')||v.includes('//'))throw new Error('不支持相对路径或重复斜杠');
  if(v.length>500)throw new Error('路径过长');
  return v;
}
export const isMarkdownPath=path=>/\.(md|markdown|mdown)$/i.test(path);
const encodeParts=path=>normalizePath(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');

export function decodeGithubBase64(content) {
  const binary=atob(String(content||'').replace(/\s/g,''));
  const bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function encodeGithubBase64(content) {
  const bytes=new TextEncoder().encode(String(content));
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
export class GithubClient {
  constructor(fetcher=globalThis.fetch){
    // Keep test-supplied fetchers fixed, but never capture the page's native
    // fetch at application startup. Browser extensions / network shims can
    // replace window.fetch after module initialization. The diagnostics used
    // the current global fetch while this client held a stale reference,
    // causing every repository route to report TypeError despite 4 PASS probes.
    this.useLocalRelay=fetcher===globalThis.fetch;
    this.fetcher=this.useLocalRelay
      ? (url,options)=>globalThis.fetch(url,options)
      : fetcher;
    this.transport='direct';
    this.token='';
    this.config=null;
    // Explicit opt-in, anonymous GET only. Never retry authenticated traffic
    // or PUT after an uncertain result. Set on every connection attempt.
    this.anonymousConnectionMode='relay';
    this.relayWarning='';
    this.requestTrace=[]; // Request names / HTTP statuses only; never token or URLs.
  }
  get transportLabel(){return this.transport==='local-relay'?'本地同源通道':this.transport==='browser-anonymous'?'浏览器匿名直连':'浏览器直连';}
  get canUseLocalRelay(){
    if(!this.useLocalRelay || typeof location==='undefined')return false;
    return /^https?:$/.test(location.protocol) &&
      /^(?:localhost|127\.0\.0\.1)$/i.test(location.hostname);
  }
  setToken(token){
    this.token=String(token||'').trim();
    // An authenticated connection never inherits anonymous direct routing.
    if(this.token)this.anonymousConnectionMode='relay';
  }
  forgetToken(){this.token='';}
  setConfig(config){this.config=normalizeRepoConfig(config);this.relayWarning='';}
  setAnonymousConnectionMode(mode='relay'){
    if(!['relay','auto','direct','alternate'].includes(mode))throw new Error('不支持的 GitHub 匿名请求模式');
    if(this.token&&mode!=='relay')throw new Error('含令牌的仓库不能使用匿名浏览器通道');
    this.anonymousConnectionMode=mode;
    this.relayWarning='';
  }
  get canWrite(){return Boolean(this.token);}
  headers(){
    return {
      'Accept':'application/vnd.github+json',
      // Browser direct mode intentionally omits X-GitHub-Api-Version:
      // GitHub currently defaults to supported 2022-11-28, and older CORS
      // preflight allowlists reject this custom header. Local relay pins it upstream.
      ...(this.token?{'Authorization':`Bearer ${this.token}`}:{})
    };
  }
  // The anonymous browser diagnostic uses a plain JSON Accept header, no
  // credentials, no redirect and no caching. Repository reads MUST use the
  // same request shape; the previous vendor-specific Accept differed and
  // could be intercepted even when all four diagnostics passed.
  async request(path,{method='GET',body=null,query=null}={}){
    if(!this.config)throw new Error('尚未配置 GitHub 仓库');
    const url=new URL(`https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}${path?'/'+path:''}`);
    if(query)for(const [key,value] of Object.entries(query))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
    const anonymous=method==='GET'&&!this.token;
    const direct={name:'浏览器匿名直连',transport:'browser-anonymous',url:url.toString()};
    const local=prefix=>({name:prefix==='/api/github'?'本地主通道':'本地备用通道',
      transport:'local-relay',url:`${prefix}${url.pathname}${url.search}`});
    const routes=this.canUseLocalRelay
      ? (anonymous&&this.anonymousConnectionMode==='direct'?[direct]
        :anonymous&&this.anonymousConnectionMode==='alternate'?[local('/api/vigil-bridge'),direct]
        :anonymous&&this.anonymousConnectionMode==='auto'?[local('/api/github'),local('/api/vigil-bridge'),direct]
        :[local('/api/github')])
      :[direct];
    const trail=[];
    this.requestTrace=[];
    let data=null;
    for(let i=0;i<routes.length;i++){
      const route=routes[i];
      const controller=new AbortController();
      // Fresh signal per attempt. A timed-out primary route must never
      // poison the alternate/direct routes with an already-aborted signal.
      const timer=setTimeout(()=>controller.abort(),15000);
      let operation='request';
      try{
        const options=anonymous?{
          method:'GET',headers:{Accept:'application/json'},
          credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal
        }:{
          method,headers:{...this.headers(),...(body?{'Content-Type':'application/json'}:{})},
          ...(body?{body:JSON.stringify(body)}:{}),
          credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal
        };
        // Stage-specific error trace. Never store URLs, private paths, tokens,
        // or response bodies in requestTrace, even after a failed request.
        operation='fetch';
        const response=await this.fetcher(route.url,options);
        operation='response-headers';
        // Disallow a stale static server or unrelated localhost handler from
        // masquerading as Vigil's relay. Anonymous GET can safely try the
        // next route, but authenticated traffic and writes must never retry.
        if(route.transport==='local-relay'&&response.headers?.get?.('X-Vigil-Github-Proxy')!=='1'){
          // On a static localhost server the endpoint may be a generic HTML
          // fallback. Allow only an anonymous GET to try direct GitHub.
          if(anonymous&&routes.length===1)routes.push(direct);
          throw new Error('LOCAL_RELAY_MISSING');
        }
        let bodyData;
        operation='response-body';
        try{bodyData=await response.json();}
        catch(error){
          if(response.ok)throw new Error('INVALID_JSON_BODY');
          bodyData={};
        }
        operation='response-check';
        if(!response.ok){
          const status=response.status;
          // A relay-side 502 is a transport failure, not a GitHub 404 or
          // authorization decision. Anonymous reads may try the next route.
          if(anonymous&&status===502&&i<routes.length-1){
            trail.push(`${route.name}: HTTP 502`);
            this.requestTrace.push({route:route.name,status:502});
            continue;
          }
          if(status===401)throw new Error('GitHub 401：Token 无效或已过期。公开仓库请选匿名读取。');
          if(status===403){
            const remaining=response.headers?.get?.('X-RateLimit-Remaining');
            throw new Error(remaining==='0'?'GitHub 403：API 请求额度已耗尽，请稍后重试。':'GitHub 403：访问被拒绝，请检查权限、组织 SSO 或请求限制。');
          }
          if(status===404)throw new Error('GitHub 404：仓库或文件不存在，也可能是目录错误或私有仓库读取权限不足。');
          if(status===409)throw new Error('文件版本冲突：远端内容已变化。请备份当前修改，刷新后重试。');
          if(status===422)throw new Error('GitHub 422：请检查路径、分支、文件 SHA 或权限。');
          if(status===502&&['GITHUB_UNREACHABLE','GITHUB_TIMEOUT'].includes(bodyData.code)){
            throw new Error(`${String(bodyData.message||'GitHub 连接失败').slice(0,180)}（${bodyData.detail||bodyData.code}；${bodyData.transport||'DIRECT'}）。`);
          }
          throw new Error(`GitHub HTTP ${status}（${route.name}）：${String(bodyData.message||'请求失败').slice(0,130)}`);
        }
        // HTTP 200 alone does not mean a successful repository GET: the
        // anonymous probes verify valid JSON structure. Verify it here too.
        if(anonymous && path==='' && (!bodyData||typeof bodyData.full_name!=='string'))throw new Error('INVALID_REPOSITORY_JSON');
        if(anonymous && /^contents(?:\/|$)/.test(path) && path==='contents' && !Array.isArray(bodyData)){
          throw new Error('INVALID_DIRECTORY_JSON');
        }
        operation='response-verified';
        this.transport=route.transport;
        this.requestTrace.push({route:route.name,status:response.status});
        if(anonymous && i>0){
          this.relayWarning=`${trail.join('；')}；已使用${route.name==='本地备用通道'?'备用本地通道':route.name}`;
          if(route.url.startsWith('/api/vigil-bridge/'))this.anonymousConnectionMode='alternate';
          if(route.transport==='browser-anonymous')this.anonymousConnectionMode='direct';
        }
        data=bodyData;
        return data;
      }catch(error){
        // Actual HTTP errors (401/403/404/409 etc.) must not be hidden by a
        // browser fallback. Only network/stream/invalid JSON problems can
        // safely retry for anonymous GETs.
        const recoverable=error?.name==='TypeError'||error?.name==='AbortError'||
          ['LOCAL_RELAY_MISSING','INVALID_JSON_BODY','INVALID_REPOSITORY_JSON','INVALID_DIRECTORY_JSON'].includes(error?.message);
        // A TypeError may mean either a fetch rejection or an application-side
        // JS error. The old trace threw away that distinction entirely.
        const detail=error?.name==='AbortError'?'TIMEOUT':
          String(error?.cause?.code||error?.code||(error?.name==='TypeError'?'TypeError':error?.message)||error?.name||'NETWORK').slice(0,60);
        const phase=operation;
        const hint=error?.name==='TypeError'
          ? (/illegal invocation/i.test(String(error?.message||''))?'ILLEGAL_INVOCATION':
             /failed to fetch|networkerror|load failed/i.test(String(error?.message||''))?'FETCH_REJECTED':'JS_TYPE_ERROR')
          : undefined;
        trail.push(`${route.name}: ${phase}/${detail}${hint?'/'+hint:''}`);
        this.requestTrace.push({route:route.name,phase,error:detail,...(hint?{hint}:{})});
        if(anonymous&&recoverable&&i<routes.length-1)continue;
        if(!anonymous && method==='PUT' && recoverable)
          throw new Error('本地同源通道提交连接中断。为避免重复提交，请先检查远端文件是否已经更新。');
        if(anonymous && recoverable){
          if(error?.message==='INVALID_REPOSITORY_JSON')
            throw new Error('GitHub 仓库元数据缺失或响应无效（HTTP 200，当前路径）。');
          if(error?.message==='INVALID_JSON_BODY')
            throw new Error('GitHub HTTP 200 的 JSON 正文不完整或格式错误。');
          if(routes.length>=3 && i===routes.length-1){
            const descriptions=trail.map(x=>x.replace('本地主通道','主同源').replace('本地备用通道','备用同源').replace('浏览器匿名直连','浏览器直连'));
            throw new Error(`匿名仓库三个通道均未连通：${descriptions.join('；')}。请打开开发者工具检查应用请求。`);
          }
          throw new Error(`本地 GitHub 同源转发请求失败（${trail.join(' → ')}）。请在 GitHub 页面查看具体阶段。`);
        }
        if(recoverable)throw new Error(`本地 GitHub 同源转发请求失败（${detail}，${route.name}）。请检查浏览器与本地服务日志。`);
        throw error;
      }finally{clearTimeout(timer);}
    }
    throw new Error(`GitHub 请求没有可用通道（${trail.join(' → ')}）。`);
  }
  async getRepository(){
    const data=await this.request('');
    if(!data||typeof data.full_name!=='string'||!data.full_name.includes('/')){
      throw new Error(`GitHub 仓库元数据缺失或响应无效（${this.transportLabel}）。这可能是代理返回了不完整的正文。`);
    }
    return data;
  }
  contentPath(path=''){
    return `contents${normalizePath(path)?'/'+encodeParts(path):''}`;
  }
  async listFolder(folder=''){
    const data=await this.request(this.contentPath(folder),{query:{ref:this.config.branch}});
    if(!Array.isArray(data))throw new Error('该路径不是目录，请选择文件夹');
    return data.filter(item=>item.type==='dir'||(item.type==='file'&&isMarkdownPath(item.path)))
       .sort((a,b)=>(a.type==='dir'?0:1)-(b.type==='dir'?0:1)||a.name.localeCompare(b.name,'zh-Hans-CN'))
       .map(item=>({name:item.name,path:item.path,type:item.type,sha:item.sha,size:item.size||0}));
  }
  async readFileBytes(path){
    if(!isMarkdownPath(path)&&!/(^|\/)\.gitattributes$/.test(path))throw new Error('仅支持 Markdown 和 .gitattributes 文件');
    const data=await this.request(this.contentPath(path),{query:{ref:this.config.branch}});
    if(data.type!=='file'||data.encoding!=='base64'||typeof data.content!=='string'){
      throw new Error('文件太大或 GitHub 内容 API 未返回 Base64 正文。');
    }
    const text=atob(data.content.replace(/\s/g,''));
    const binary=Uint8Array.from(text,ch=>ch.charCodeAt(0));
    if(binary.length>900022)throw new Error('文件超过编辑器安全容量。');
    return {path:data.path,sha:data.sha,bytes:binary,htmlUrl:data.html_url||''};
  }
  async readAttributes(){
    try{
      const file=await this.readFileBytes('.gitattributes');
      return decodeGitCryptText(file.bytes);
    }catch(err){
      if(/仓库或文件不存在/.test(err.message))return '';
      throw err;
    }
  }
  async getEncryptionRule(path){
    const clean=normalizePath(path);
    const folders=clean.split('/').slice(0,-1);
    let prefix='',detected={matched:false,encrypted:false,keyName:'default',unsupported:false};
    for(const segment of ['',...folders]){
      if(segment)prefix=prefix?prefix+'/'+segment:segment;
      const attrPath=prefix?prefix+'/.gitattributes':'.gitattributes';
      let content='';
      try{content=decodeGitCryptText((await this.readFileBytes(attrPath)).bytes);}
      catch(err){if(/仓库或文件不存在/.test(err.message))continue;throw err;}
      const relative=prefix?clean.slice(prefix.length+1):clean;
      const rule=gitCryptRuleDetail(content,relative);
      if(rule.matched)detected=rule;
      if(rule.unsupported)detected.unsupported=true;
    }
    if(detected.unsupported)throw new Error('仓库 .gitattributes 含不支持的 git-crypt 模式，停止自动提交。');
    return detected;
  }
  async readNote(path,{key=null}={}){
    if(!isMarkdownPath(path))throw new Error('目前只支持 Markdown 文件');
    const file=await this.readFileBytes(path);
    const encrypted=isGitCryptBlob(file.bytes);
    const locked=encrypted&&!key;
    const content=locked?'':decodeGitCryptText(encrypted?await decryptGitCryptBytes(file.bytes,key):file.bytes);
    return {path:file.path,sha:file.sha,content,encrypted,locked,htmlUrl:file.htmlUrl};
  }
  async saveFileBytes({path,bytes,sha=null}){
    if(!this.token)throw new Error('提交仓库需要 Contents: Read and write 的临时令牌。');
    if(!isMarkdownPath(path))throw new Error('只能写入 Markdown 文件');
    if(bytes.length>900022)throw new Error('笔记内容过大');
    let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const data=await this.request(this.contentPath(path),{
      method:'PUT',body:{
        message:`docs: ${sha?'update':'add'} ${path} via Vigil`,
        content:btoa(binary),...(sha?{sha}:{}),
        ...(this.config.branch?{branch:this.config.branch}:{})
      }
    });
    return {sha:data.content?.sha||null,commit:data.commit?.sha||null,htmlUrl:data.content?.html_url||''};
  }
  async saveNote({path,content,sha=null,encrypted=false,key=null}){
    if(!this.token)throw new Error('修改仓库需要临时访问令牌（Contents: Read and write）。');
    if(!isMarkdownPath(path))throw new Error('只能提交 Markdown 文件');
    const rule=await this.getEncryptionRule(path);
    if(rule.encrypted&&!encrypted)throw new Error('路径匹配 git-crypt 规则，已禁止明文提交。');
    if(encrypted&&!rule.encrypted)throw new Error('仓库 .gitattributes 未为当前路径启用 git-crypt，拒绝提交无法自动解密的密文。');
    if(encrypted&&key?.name!==rule.keyName)throw new Error('git-crypt 密钥名与仓库属性规则不匹配，已阻止错误加密。');
    const bytes=encrypted?await encryptGitCryptBytes(encodeGitCryptText(content),key):encodeGitCryptText(content);
    if(bytes.length>900022)throw new Error('单篇笔记请保持在 900KB 以内');
    return this.saveFileBytes({path,bytes,sha});
  }

}
