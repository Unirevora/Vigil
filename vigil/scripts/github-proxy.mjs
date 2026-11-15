import {githubTransportFetch,githubProxyEnvironment,normalizeGithubProxySettings} from './github-transport.mjs';
/** Strict same-origin GitHub API relay served by scripts/dev-server.mjs — locally on
 * 127.0.0.1, or on a server behind nginx (which checks Origin and forwards with a
 * loopback Host). No generic proxy URL, no credential storage, no logging of
 * Authorization or request bodies. Only the REST routes the app needs are permitted.
 * Plain static hosting (no Node service) makes the browser call GitHub directly.
 * VIGIL_PROXY_LOCK: refuse runtime proxy changes (shared server deployment).
 */
import {readFileSync} from 'node:fs';
const VERSION=(()=>{try{return JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;}catch{return 'dev';}})();
const USER_AGENT=`Vigil/${VERSION}`;
const MAX_BODY=3*1024*1024;
const MAX_REPLY=7*1024*1024;
const MAX_SETTINGS=1024;
let runtimeProxySettings={mode:'env'};
const JSON_HEADERS={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'X-Vigil-Github-Proxy':'1'
};
const REPO_ROUTE=/^\/repos\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}(?:\/contents(?:\/(?:[^/?#]+\/?)+)?)?$/;
const text=(value)=>typeof value==='string'?value:'';
function send(res,status,payload){res.writeHead(status,JSON_HEADERS).end(JSON.stringify(payload));}
function proxyState(){
  const current=githubProxyEnvironment(process.env,runtimeProxySettings);
  return {
    settings:runtimeProxySettings,
    effective:{mode:current.enabled?current.kind:'direct',source:current.reason,
      // Never reveal proxy credentials or sensitive environment values.
      endpoint:current.enabled?`${current.url.hostname}:${current.url.port||((current.url.protocol==='https:')?443:current.kind==='socks5'?1080:80)}`:null},
    warning:current.kind==='invalid'?'代理环境变量格式或协议不正确':null
  };
}
function failureCode(error,aborted=false){
  if(aborted||error?.name==='AbortError'||error?.code==='ABORT_ERR')return 'GITHUB_TIMEOUT';
  return 'GITHUB_UNREACHABLE';
}
function networkMessage(code,detail){
  if(code==='GITHUB_TIMEOUT')return '请求 GitHub 超时；请确认代理端口可访问，或尝试本机 SOCKS5。';
  if(detail.startsWith('SOCKS_AUTH'))return 'SOCKS5 代理拒绝认证。请检查代理设置。';
  if(detail.startsWith('SOCKS_CONNECT_'))return 'SOCKS5 无法建立到 GitHub 的连接；请检查代理规则与节点。';
  if(detail.startsWith('PROXY_CONNECT_'))return 'HTTP 代理隧道被拒绝；请检查代理地址、权限和节点。';
  if(detail==='ECONNREFUSED')return '本地代理端口拒绝连接。请检查代理软件是否启动、端口与代理类型。';
  if(detail==='ENOTFOUND'||detail==='EAI_AGAIN')return '本机 DNS 解析失败；可以使用支持远程 DNS 的 SOCKS5 代理。';
  if(detail==='UNSUPPORTED_PROXY'||detail==='BAD_PROXY_URL')return '代理格式不支持。请使用 HTTP、HTTPS 或 SOCKS5 代理地址。';
  if(detail.startsWith('CERT_')||detail==='UNABLE_TO_VERIFY_LEAF_SIGNATURE')return 'HTTPS 证书验证失败。请检查代理的证书拦截设置，勿关闭 TLS 验证。';
  return '本地服务无法访问 GitHub。请在此页面选择实际使用的 HTTP 或 SOCKS5 代理端口。';
}
async function networkProbe(fetchImpl,timeoutMs=9000){
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),timeoutMs);
  try{
    // Same real metadata endpoint and same upstream headers/transport as a
    // repository connection. A status line alone does NOT prove that the
    // response body can be streamed and decoded through Clash / Node.
    const path='https://api.github.com/repos/octocat/Hello-World';
    const response=await (fetchImpl===globalThis.fetch
      ?githubTransportFetch(path,{method:'GET',headers:{
          Accept:'application/vnd.github+json',
          'X-GitHub-Api-Version':'2022-11-28',
          'User-Agent':USER_AGENT
        },signal:abort.signal},process.env,runtimeProxySettings)
      :fetchImpl(path,{method:'GET',headers:{
          Accept:'application/vnd.github+json',
          'X-GitHub-Api-Version':'2022-11-28',
          'User-Agent':USER_AGENT
        },signal:abort.signal}));
    // Fully consume stream, with stream errors handled by this try/catch.
    // The old .resume() returned immediately and could misleadingly report
    // HTTP 200 even when the body never reached the app.
    const raw=await boundedUpstreamBody(response);
    let decoded;
    try{decoded=JSON.parse(raw);}catch{
      return {ok:false,code:'GITHUB_INVALID_RESPONSE',detail:'INVALID_JSON',
        upstreamStatus:response.status,message:'GitHub API 已返回响应头，但仓库数据正文未完整送达或不是有效 JSON。'};
    }
    if(response.ok&&(!decoded||typeof decoded.full_name!=='string')){
      return {ok:false,code:'GITHUB_INVALID_RESPONSE',detail:'MISSING_REPOSITORY',
        upstreamStatus:response.status,message:'GitHub API 返回了 HTTP 200，但没有可验证的仓库信息。'};
    }
    return {ok:true,upstreamStatus:response.status,bodyVerified:true,
      message:response.ok?'GitHub 公共仓库数据已完整读取':'GitHub 返回 HTTP '+response.status+'，数据正文已读取'};
  }catch(error){
    const detail=String(error?.cause?.code||error?.code||error?.name||'NETWORK').slice(0,36);
    const code=failureCode(error,abort.signal.aborted);
    return {ok:false,code,detail,message:networkMessage(code,detail)};
  }finally{clearTimeout(timer);}
}

function approvedOrigin(req){
  const host=text(req.headers.host);
  if(!/^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/i.test(host))return false;
  const origin=text(req.headers.origin);
  if(!origin)return true; // same-origin browser GET without Origin
  try{
    const u=new URL(origin);
    return u.protocol==='http:' && u.host.toLowerCase()===host.toLowerCase();
  }catch{return false;}
}
async function boundedRequestBody(req){
  let count=0;const parts=[];
  for await(const part of req){
    count+=part.byteLength;if(count>MAX_BODY)throw new Error('TOO_LARGE');
    parts.push(part);
  }
  return Buffer.concat(parts);
}
async function boundedUpstreamBody(response){
  const parts=[];let bytes=0;
  if(!response.body) return '';
  for await (const chunk of response.body){
    bytes+=chunk.byteLength;
    if(bytes>MAX_REPLY){await response.body.cancel?.().catch(()=>{});throw new Error('RESPONSE_TOO_LARGE');}
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts).toString('utf8');
}
export async function handleGithubProxy(req,res,{fetchImpl=globalThis.fetch,timeoutMs=16000}={}){
  const incoming=new URL(req.url||'/', 'http://127.0.0.1');
  // An alternate, anonymous-read-only route is provided for browsers where
  // privacy extensions or system proxy rules interfere with /api/github/repos.
  // Both prefixes share the same strict repository path validation.
  const alternate=incoming.pathname.startsWith('/api/vigil-bridge/');
  if(!alternate&&!incoming.pathname.startsWith('/api/github/'))return false;
  if(!approvedOrigin(req)){
    send(res,403,{code:'ORIGIN_DENIED',message:'仅允许从本机同源页面连接 GitHub。'});return true;
  }
  if(incoming.pathname==='/api/github/health'){
    // This is a LOCAL readiness check and does not imply Internet connectivity.
    send(res,200,{ok:true,localOnly:true,upstreamTested:false,version:VERSION,proxy:proxyState().effective});return true;
  }
  if(incoming.pathname==='/api/github/proxy'){
    if(req.method==='GET')send(res,200,{ok:true,...proxyState(),locked:Boolean(process.env.VIGIL_PROXY_LOCK)});
    else if(req.method==='POST'&&process.env.VIGIL_PROXY_LOCK){
      // Server deployment: "local proxy" would mean the SERVER's loopback, not the
      // visitor's Clash; settings are shared by every visitor, so refuse changes.
      send(res,409,{ok:false,code:'PROXY_LOCKED',...proxyState(),locked:true,
        message:'此网站部署在服务器上，GitHub 请求由服务器直接发出，已固定为直连。你电脑上的 Clash / SOCKS5 代理对服务器无效，请保持「跟随环境」，直接连接仓库即可。'});
    }
    else if(req.method==='POST'){
      let body;
      try{
        let bytes=0,parts=[];
        for await (const chunk of req){bytes+=chunk.length;if(bytes>MAX_SETTINGS)throw new Error('SETTINGS_TOO_LARGE');parts.push(chunk);}
        body=JSON.parse(Buffer.concat(parts).toString('utf8'));
        runtimeProxySettings=normalizeGithubProxySettings(body);
        send(res,200,{ok:true,...proxyState()});
      }catch(error){
        send(res,400,{ok:false,code:String(error?.message||'BAD_PROXY_SETTINGS').slice(0,48),message:'代理设置无效：只允许本机回环地址与 1–65535 端口。'});
      }
    }else send(res,405,{code:'METHOD_NOT_ALLOWED',message:'此接口只接受 GET 或 POST。'});
    return true;
  }
  if(incoming.pathname==='/api/github/diagnose'){
    if(req.method!=='GET'){send(res,405,{code:'METHOD_NOT_ALLOWED'});return true;}
    const result=await networkProbe(fetchImpl,Math.min(timeoutMs,9500));
    send(res,result.ok?200:502,{...result,local:true,proxy:proxyState().effective});return true;
  }
  if(alternate && (req.method!=='GET'||Boolean(req.headers.authorization))){
    send(res,403,{code:'ANONYMOUS_READ_ONLY',message:'备用同源地址仅允许无 Token 的公开仓库读取。'});return true;
  }
  if(!['GET','PUT'].includes(req.method)){
    send(res,405,{code:'METHOD_NOT_ALLOWED',message:'不支持此 GitHub 请求方法。'});return true;
  }
  const route=incoming.pathname.slice((alternate?'/api/vigil-bridge':'/api/github').length);
  let decoded;
  try{decoded=decodeURIComponent(route);}catch{decoded='';}
  if(!REPO_ROUTE.test(route)||!REPO_ROUTE.test(decoded)||
    decoded.split('/').some(segment=>segment==='..'||segment==='.') ||
    decoded.includes('\\')||decoded.includes('//')||
    [...incoming.searchParams.keys()].some(k=>k!=='ref')){
    send(res,400,{code:'PATH_DENIED',message:'只能通过此通道访问固定 GitHub 仓库与文件路径。'});
    return true;
  }
  if(req.method==='PUT'&&!decoded.includes('/contents/')){
    send(res,405,{code:'METHOD_NOT_ALLOWED',message:'只支持写入具体仓库文件。'});return true;
  }
  const target=new URL(`https://api.github.com${route}${incoming.search}`);
  if(target.hostname!=='api.github.com'){
    send(res,400,{code:'PATH_DENIED',message:'GitHub API 地址无效。'});return true;
  }
  const token=text(req.headers.authorization);
  if(token && !/^Bearer [A-Za-z0-9_\-]+$/.test(token)){
    send(res,400,{code:'BAD_AUTH',message:'临时访问令牌格式无效。'});return true;
  }
  let body;
  if(req.method==='PUT'){
    try{body=await boundedRequestBody(req);}catch{
      send(res,413,{code:'TOO_LARGE',message:'提交内容超过 3MB。'});return true;
    }
    try{JSON.parse(body.toString('utf8'));}catch{
      send(res,400,{code:'BAD_JSON',message:'GitHub 提交数据不是有效 JSON。'});return true;
    }
  }
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),timeoutMs);
  try{
    const upstream=await (fetchImpl===globalThis.fetch?githubTransportFetch:fetchImpl)(target.toString(),{
      method:req.method,
      headers:{
        'Accept':'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28',
        'User-Agent':USER_AGENT,
        ...(token?{'Authorization':token}:{}),
        ...(body?{'Content-Type':'application/json'}:{})
      },
      ...(body?{body}:{}),
      signal:abort.signal,redirect:'error'
    },process.env,runtimeProxySettings);
    const raw=await boundedUpstreamBody(upstream);
    let payload;
    try{payload=JSON.parse(raw);}catch{
      payload={message:upstream.ok?'GitHub API 返回非 JSON 数据。':'GitHub API 未返回有效 JSON。'};
    }
    send(res,upstream.status,payload);
  }catch(error){
    const code=failureCode(error,abort.signal.aborted);
    // Error codes are diagnostic, never include token, URL query or body.
    const detail=text(error?.cause?.code||error?.code||error?.name).slice(0,32) || (code==='GITHUB_TIMEOUT'?'TIMEOUT':'NETWORK');
    const phase=route.includes('/contents')?'contents':'metadata';
    console.warn(`[Vigil GitHub relay] ${phase}: ${code} / ${detail}`);
    send(res,502,{code,detail,phase,transport:proxyState().effective.source,message:networkMessage(code,detail)});
  }finally{clearTimeout(timer);}
  return true;
}
