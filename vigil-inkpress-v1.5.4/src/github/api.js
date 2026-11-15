import {isGitCryptBlob,encryptGitCryptBytes,decryptGitCryptBytes,encodeGitCryptText,decodeGitCryptText,gitCryptRuleMatches,gitCryptRuleDetail} from '../security/git-crypt.js';
// Direct GitHub REST Contents API client. No connector, proxy, or stored token.
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
    this.token='';
    this.config=null;
  }
  setToken(token){this.token=String(token||'').trim();}
  forgetToken(){this.token='';}
  setConfig(config){this.config=normalizeRepoConfig(config);}
  get canWrite(){return Boolean(this.token);}
  headers(){
    return {
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2026-03-10',
      ...(this.token?{'Authorization':`Bearer ${this.token}`}:{})
    };
  }
  async request(path,{method='GET',body=null,query=null}={}){
    if(!this.config)throw new Error('尚未配置 GitHub 仓库');
    const url=new URL(`https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}${path?'/'+path:''}`);
    if(query) for(const [key,value] of Object.entries(query)) if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
    let response;
    try{
      response=await this.fetcher(url.toString(),{
        method,
        headers:{...this.headers(),...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{})
      });
    }catch{
      throw new Error('无法连接 GitHub。请检查网络、跨域限制或代理设置。');
    }
    let data;
    try{data=await response.json();}catch{data={};}
    if(!response.ok){
      if(response.status===401)throw new Error('认证失败。请检查令牌是否有效。');
      if(response.status===403)throw new Error('访问被拒绝或请求频率受限，请检查权限及 GitHub API 限额。');
      if(response.status===404)throw new Error('仓库或文件不存在，也可能没有访问权限。');
      if(response.status===409)throw new Error('文件版本冲突：远端内容已变化。你的修改仍在编辑框，请复制备份后刷新。');
      if(response.status===422)throw new Error('提交内容无效，请检查路径、分支和权限。');
      throw new Error(`GitHub 返回 ${response.status}：${String(data.message||'请求失败').slice(0,150)}`);
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
