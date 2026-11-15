/** Strict same-origin GitHub API relay for the local 127.0.0.1 development server.
 * No generic proxy URL, no credential storage, no logging of Authorization or
 * request bodies. Only the REST routes the app actually needs are permitted.
 * On static deployments the browser may still use direct GitHub requests.
 */
const MAX_BODY=3*1024*1024;
const MAX_REPLY=7*1024*1024;
const JSON_HEADERS={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'X-Vigil-Github-Proxy':'1'
};
const REPO_ROUTE=/^\/repos\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}(?:\/contents(?:\/(?:[^/?#]+\/?)+)?)?$/;
const text=(value)=>typeof value==='string'?value:'';
function send(res,status,payload){res.writeHead(status,JSON_HEADERS).end(JSON.stringify(payload));}
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
  if(!incoming.pathname.startsWith('/api/github/'))return false;
  if(!approvedOrigin(req)){
    send(res,403,{code:'ORIGIN_DENIED',message:'仅允许从本机同源页面连接 GitHub。'});return true;
  }
  if(incoming.pathname==='/api/github/health'){
    send(res,200,{ok:true,transport:'same-origin-local',upstream:'https://api.github.com',version:'1.5.5'});return true;
  }
  if(!['GET','PUT'].includes(req.method)){
    send(res,405,{code:'METHOD_NOT_ALLOWED',message:'不支持此 GitHub 请求方法。'});return true;
  }
  const route=incoming.pathname.slice('/api/github'.length);
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
    const upstream=await fetchImpl(target.toString(),{
      method:req.method,
      headers:{
        'Accept':'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28',
        'User-Agent':'Vigil-Local-1.5.5',
        ...(token?{'Authorization':token}:{}),
        ...(body?{'Content-Type':'application/json'}:{})
      },
      ...(body?{body}:{}),
      signal:abort.signal,redirect:'error'
    });
    const raw=await boundedUpstreamBody(upstream);
    let payload;
    try{payload=JSON.parse(raw);}catch{
      payload={message:upstream.ok?'GitHub API 返回非 JSON 数据。':'GitHub API 未返回有效 JSON。'};
    }
    send(res,upstream.status,payload);
  }catch(error){
    const code=error?.name==='AbortError'?'GITHUB_TIMEOUT':'GITHUB_UNREACHABLE';
    // Error codes are diagnostic, never include token, URL query or body.
    const detail=text(error?.cause?.code).slice(0,32) || (code==='GITHUB_TIMEOUT'?'TIMEOUT':'NETWORK');
    send(res,502,{code,detail,message:code==='GITHUB_TIMEOUT'
      ?'本地服务访问 GitHub 超时，请检查网络或代理。'
      :'本地服务无法访问 api.github.com，请检查 DNS、网络或代理。'});
  }finally{clearTimeout(timer);}
  return true;
}
