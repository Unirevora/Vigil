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
    this.fetcher=fetcher;
    this.useLocalRelay=fetcher===globalThis.fetch;
    this.transport='direct';
    this.token='';
    this.config=null;
  }
  get transportLabel(){return this.transport==='local-relay'?'本地同源通道':'浏览器直连';}
  get canUseLocalRelay(){
    if(!this.useLocalRelay || typeof location==='undefined')return false;
    return /^https?:$/.test(location.protocol) &&
      /^(?:localhost|127\.0\.0\.1)$/i.test(location.hostname);
  }
  setToken(token){this.token=String(token||'').trim();}
  forgetToken(){this.token='';}
  setConfig(config){this.config=normalizeRepoConfig(config);}
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
  async request(path,{method='GET',body=null,query=null}={}){
    if(!this.config)throw new Error('尚未配置 GitHub 仓库');
    const url=new URL(`https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}${path?'/'+path:''}`);
    if(query)for(const [key,value] of Object.entries(query))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
    const options={
      method,
      headers:{...this.headers(),...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    };
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),18000);
    options.signal=controller.signal;
    let response,transport='direct';
    try{
      // The local Node server relays a narrow allowlisted set of REST calls
      // through its own origin: no browser preflight / cross-origin token leak.
      // A static web host without this route keeps the direct API fallback.
      if(this.canUseLocalRelay){
        const relay=`/api/github${url.pathname}${url.search}`;
        try{
          response=await this.fetcher(relay,options);
        }catch(localError){
          // Never silently retry a failed localhost relay against the browser
          // API: the second request can fail CORS and obscure the real failure
          // with an unhelpful TypeError (especially when using a PAT).
          // PUT is particularly unsafe to retry after an unknown outcome.
          const detail=localError?.name==='AbortError'?'TIMEOUT':
            String(localError?.cause?.code||localError?.code||localError?.name||'NETWORK').slice(0,40);
          throw new Error(method==='PUT'
            ?'本地同源通道提交连接中断。为避免重复提交，请先检查仓库文件是否已更新。'
            :`本地 GitHub 同源转发请求失败（${detail}），不会改用浏览器直连以掩盖错误。请确认通过 npm run dev 启动，并在「本地网络与代理」选择本机代理后重试。`);
        }
        if(response?.headers?.get?.('X-Vigil-Github-Proxy')==='1'){
          transport='local-relay';
        }else if(method==='GET'&&!this.token){
          // A plain static server running on localhost may have no relay route;
          // preserve anonymous public browsing only in this verified case.
          response=await this.fetcher(url.toString(),options);
        }else{
          throw new Error('本地同源转发未启用，不能安全使用访问令牌或确认提交状态。请以 npm run dev 启动项目。');
        }
      }else{
        response=await this.fetcher(url.toString(),options);
      }
    }catch(error){
      if(error?.message?.startsWith('本地同源')||error?.message?.startsWith('本地 GitHub 同源转发'))throw error;
      const detail=error?.name==='AbortError'?'TIMEOUT':
        String(error?.cause?.code||error?.code||error?.name||'NETWORK').slice(0,40);
      const tip=this.canUseLocalRelay
        ?'无法连接 api.github.com；已尝试本机转发或官方 API。请先使用「测试 GitHub 网络」，再检查本机 DNS 与 HTTPS_PROXY。'
        :'浏览器直连 api.github.com 失败。请在本机启动 npm run dev 并使用 127.0.0.1:5173 打开，或检查站点网络策略。';
      throw new Error(`GitHub 网络请求失败（${detail}）。${tip}`);
    }finally{clearTimeout(timeout);}
    this.transport=transport;
    let data;
    try{data=await response.json();}catch{data={};}
    if(!response.ok){
      if(response.status===401)throw new Error('GitHub 401：Token 无效或已过期。若连接公开仓库，请勾选「匿名读取公开仓库」以忽略本次会话中的旧令牌。');
      if(response.status===403){
        const rate=response.headers?.get?.('X-RateLimit-Remaining');
        throw new Error(rate==='0'?'GitHub 403：API 请求额度已耗尽，请稍后重试。':'GitHub 403：访问被拒绝，请检查仓库权限、组织 SSO 或频率限制。');
      }
      if(response.status===404)throw new Error('GitHub 404：仓库或文件不存在，也可能是目录错误或私有仓库的读取权限不足。');
      if(response.status===409)throw new Error('文件版本冲突：远端内容已变化。你的修改仍在编辑框，请复制备份后刷新。');
      if(response.status===422)throw new Error('GitHub 422：请检查路径、分支名称、文件 SHA 或权限。');
      if(response.status===502&&['GITHUB_UNREACHABLE','GITHUB_TIMEOUT'].includes(data.code))
        throw new Error(`${String(data.message||'GitHub 连接失败').slice(0,180)}（${data.detail||data.code}；${data.transport||'DIRECT'}）。请在 GitHub 页面 →「本地网络与代理」配置本机 HTTP/SOCKS5 端口并重新测试。`);
      throw new Error(`GitHub HTTP ${response.status}（${transport==='local-relay'?'本地同源通道':'浏览器直连'}）：${String(data.message||'请求失败').slice(0,130)}`);
    }
    return data;
  }
  async getRepository(){
    return this.request('');
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
