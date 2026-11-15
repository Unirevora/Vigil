/** Fixed-host GitHub transport with optional HTTPS_PROXY / HTTP_PROXY.
 * Zero dependencies, no generic URL proxy and no token logging. `NO_PROXY`
 * is honored for api.github.com. Only HTTPS to api.github.com is accepted.
 */
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

function matchesNoProxy(host,noProxy=''){
  return String(noProxy).split(',').map(x=>x.trim().toLowerCase()).some(item=>{
    if(!item)return false;
    if(item==='*')return true;
    item=item.replace(/^\*\./,'.');
    return host===item||host.endsWith(item.startsWith('.')?item:'.'+item);
  });
}
export function githubProxyEnvironment(env=process.env){
  const host='api.github.com';
  if(matchesNoProxy(host,env.NO_PROXY||env.no_proxy))return {enabled:false,reason:'NO_PROXY'};
  const raw=env.HTTPS_PROXY||env.https_proxy||env.HTTP_PROXY||env.http_proxy||'';
  if(!raw)return {enabled:false,reason:'DIRECT'};
  let url;
  try{url=new URL(raw);}catch{return {enabled:false,reason:'BAD_PROXY_URL'};}
  if(!['http:','https:'].includes(url.protocol)||!url.hostname){
    return {enabled:false,reason:'UNSUPPORTED_PROXY'};
  }
  // No authentication data is returned, written to logs, or forwarded to GitHub.
  return {enabled:true,reason:'HTTPS_PROXY',url};
}

function connectViaProxy(proxy,signal){
  return new Promise((resolve,reject)=>{
    const headers={Host:'api.github.com:443'};
    if(proxy.username||proxy.password){
      const auth=decodeURIComponent(proxy.username)+':'+decodeURIComponent(proxy.password);
      headers['Proxy-Authorization']='Basic '+Buffer.from(auth,'utf8').toString('base64');
    }
    const requestOptions={
      hostname:proxy.hostname,port:proxy.port||((proxy.protocol==='https:')?443:80),
      method:'CONNECT',path:'api.github.com:443',headers,
      ...(proxy.protocol==='https:'?{servername:proxy.hostname}:{}),
    };
    const request=(proxy.protocol==='https:'?https:http).request(requestOptions);
    let finished=false;
    const done=(error,socket)=>{
      if(finished)return;finished=true;
      signal?.removeEventListener('abort',abort);
      if(error)reject(error);else resolve(socket);
    };
    const abort=()=>request.destroy(Object.assign(new Error('GitHub proxy connection cancelled'),{code:'ABORT_ERR'}));
    signal?.addEventListener('abort',abort,{once:true});
    request.on('connect',(res,socket,head)=>{
      if(res.statusCode!==200){
        socket.destroy();done(Object.assign(new Error('GitHub HTTPS proxy tunnel rejected'),{code:'PROXY_CONNECT_'+res.statusCode}));return;
      }
      if(head.length)socket.unshift(head);
      const secure=tls.connect({socket,servername:'api.github.com',rejectUnauthorized:true});
      secure.once('error',error=>done(error));
      secure.once('secureConnect',()=>done(null,secure));
    });
    request.once('error',error=>done(error));
    request.end();
  });
}
/** Return a fetch-compatible {ok,status,body,headers} object. */
export async function githubTransportFetch(target,options={},env=process.env){
  const url=new URL(target);
  if(url.protocol!=='https:'||url.hostname!=='api.github.com'||url.port){
    throw new Error('GitHub transport accepts only https://api.github.com');
  }
  const proxy=githubProxyEnvironment(env);
  if(!proxy.enabled){
    return globalThis.fetch(url.toString(),options);
  }
  const secureSocket=await connectViaProxy(proxy.url,options.signal);
  return new Promise((resolve,reject)=>{
    const agent=new https.Agent({keepAlive:false,maxSockets:1});
    agent.createConnection=(requestOptions,callback)=>callback(null,secureSocket);
    const request=https.request({
      hostname:'api.github.com',port:443,path:url.pathname+url.search,
      method:options.method||'GET',headers:options.headers||{},
      agent,signal:options.signal,
      rejectUnauthorized:true,servername:'api.github.com'
    },response=>{
      const status=response.statusCode||502;
      resolve({status,ok:status>=200&&status<300,body:response,headers:response.headers});
    });
    request.once('error',reject);
    if(options.body)request.write(options.body);
    request.end();
  });
}
