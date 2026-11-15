/**
 * Fixed-host transport for the *local* GitHub REST relay.
 * Supports HTTPS_PROXY, HTTP_PROXY and ALL_PROXY (HTTP(S) CONNECT or SOCKS5),
 * as well as an ephemeral loopback-only override selected in the app.
 * Remote DNS for GitHub is performed by SOCKS5, so local DNS can fail safely.
 * Never disables certificate validation or logs tokens / proxy credentials.
 */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const HOST='api.github.com';
const TUNNEL_PORT=443;
const SUPPORTED=['http:','https:','socks5:','socks5h:'];

function matchesNoProxy(host,noProxy=''){
  return String(noProxy).split(',').map(x=>x.trim().toLowerCase()).some(item=>{
    if(!item)return false;
    if(item==='*')return true;
    item=item.replace(/^\*\./,'.').split(':')[0];
    return host===item||host.endsWith(item.startsWith('.')?item:'.'+item);
  });
}
function invalidProxy(reason){
  return {enabled:false,reason,kind:'invalid'};
}
/** `override` is {mode:'env'|'direct'|'http'|'socks5',host,port}.
 * For safety only loopback hosts may be manually configured via the browser.
 * Corporate remote proxies are still supported through environment variables.
 */
export function normalizeGithubProxySettings(value){
  if(value===null||typeof value!=='object'||Array.isArray(value))throw new Error('PROXY_CONFIG_INVALID');
  const mode=String(value.mode||'env').toLowerCase();
  if(!['env','direct','http','socks5'].includes(mode))throw new Error('PROXY_MODE_INVALID');
  if(mode==='env'||mode==='direct')return {mode};
  const host=String(value.host||'127.0.0.1').trim().toLowerCase();
  const port=Number(value.port);
  if(!['127.0.0.1','localhost','::1','[::1]'].includes(host) ||
     !Number.isInteger(port)||port<1||port>65535)throw new Error('PROXY_LOCAL_ADDRESS_INVALID');
  return {mode,host:host==='[::1]'?'::1':host,port};
}
export function githubProxyEnvironment(env=process.env,override=null){
  let settings;
  try{settings=override?normalizeGithubProxySettings(override):{mode:'env'};}
  catch{return invalidProxy('BAD_MANUAL_PROXY');}
  if(settings.mode==='direct')return {enabled:false,reason:'MANUAL_DIRECT',kind:'direct'};
  if(settings.mode==='http'||settings.mode==='socks5'){
    const protocol=settings.mode==='http'?'http:':'socks5:';
    const hostname=settings.host==='::1'?'[::1]':settings.host;
    return {enabled:true,reason:'MANUAL',kind:settings.mode,url:new URL(`${protocol}//${hostname}:${settings.port}`)};
  }
  if(matchesNoProxy(HOST,env.NO_PROXY||env.no_proxy)){
    return {enabled:false,reason:'NO_PROXY',kind:'direct'};
  }
  const pairs=[
    ['HTTPS_PROXY',env.https_proxy||env.HTTPS_PROXY],
    ['ALL_PROXY',env.all_proxy||env.ALL_PROXY],
    ['HTTP_PROXY',env.http_proxy||env.HTTP_PROXY]
  ];
  const found=pairs.find(([,value])=>typeof value==='string'&&value.trim());
  if(!found)return {enabled:false,reason:'DIRECT',kind:'direct'};
  let url;
  try{url=new URL(found[1]);}
  catch{return invalidProxy('BAD_PROXY_URL');}
  if(!SUPPORTED.includes(url.protocol)||!url.hostname)return invalidProxy('UNSUPPORTED_PROXY');
  return {enabled:true,reason:found[0],kind:url.protocol.startsWith('socks5')?'socks5':'http',url};
}

function abortError(){return Object.assign(new Error('GitHub proxy connection cancelled'),{code:'ABORT_ERR',name:'AbortError'});}
function wrapError(code,message){return Object.assign(new Error(message),{code});}
function attachAbort(signal,socket){
  if(!signal)return ()=>{};
  const cancel=()=>socket.destroy(abortError());
  if(signal.aborted){cancel();throw abortError();}
  signal.addEventListener('abort',cancel,{once:true});
  return ()=>signal.removeEventListener('abort',cancel);
}

function connectHttpTunnel(proxy,signal){
  return new Promise((resolve,reject)=>{
    const headers={Host:`${HOST}:${TUNNEL_PORT}`};
    if(proxy.username||proxy.password){
      const auth=decodeURIComponent(proxy.username)+':'+decodeURIComponent(proxy.password);
      headers['Proxy-Authorization']='Basic '+Buffer.from(auth,'utf8').toString('base64');
    }
    const opts={
      hostname:proxy.hostname,port:Number(proxy.port)||((proxy.protocol==='https:')?443:80),
      method:'CONNECT',path:`${HOST}:${TUNNEL_PORT}`,headers,
      ...(proxy.protocol==='https:'?{servername:proxy.hostname}:{}),
      timeout:13000
    };
    const request=(proxy.protocol==='https:'?https:http).request(opts);
    let finished=false;
    const abort=()=>request.destroy(abortError());
    const done=(error,socket)=>{
      if(finished){socket?.destroy();return;}
      finished=true;
      signal?.removeEventListener('abort',abort);
      if(error)reject(error);else resolve(socket);
    };
    if(signal?.aborted){request.destroy();done(abortError());return;}
    signal?.addEventListener('abort',abort,{once:true});
    request.on('timeout',()=>request.destroy(wrapError('PROXY_TIMEOUT','HTTP proxy CONNECT timed out')));
    request.once('connect',(res,socket,head)=>{
      if(res.statusCode!==200){
        socket.destroy();done(wrapError(`PROXY_CONNECT_${res.statusCode}`,'HTTP proxy rejected CONNECT'));return;
      }
      if(head.length)socket.unshift(head);
      done(null,socket);
    });
    request.once('response',res=>{
      res.resume();done(wrapError(`PROXY_CONNECT_${res.statusCode}`,'HTTP proxy returned a non-tunnel response'));
    });
    request.once('error',err=>done(err));
    request.end();
  });
}

function openTcp(host,port,signal){
  return new Promise((resolve,reject)=>{
    const socket=net.connect({host,port});
    socket.setTimeout(13000,()=>socket.destroy(wrapError('PROXY_TIMEOUT','SOCKS proxy timed out')));
    let settled=false;
    const fail=err=>{if(settled)return;settled=true;cleanup();socket.destroy();reject(err);};
    const ok=()=>{if(settled)return;settled=true;cleanup();resolve(socket);};
    const cancel=()=>fail(abortError());
    const cleanup=()=>{socket.off('connect',ok);socket.off('error',fail);signal?.removeEventListener('abort',cancel);};
    socket.once('connect',ok);socket.once('error',fail);
    if(signal?.aborted){cancel();return;}
    signal?.addEventListener('abort',cancel,{once:true});
  });
}
/** Buffered byte reader to tolerate fragmented/combined SOCKS packets. */
function socketReader(socket,signal){
  let bytes=Buffer.alloc(0),pending=null,failed=null;
  socket.pause();
  const flush=()=>{
    if(!pending||bytes.length<pending.length)return;
    const {length,resolve}=pending;pending=null;
    const out=bytes.subarray(0,length);bytes=bytes.subarray(length);resolve(out);
  };
  const error=err=>{
    failed=err;
    if(pending){const {reject}=pending;pending=null;reject(err);}
  };
  const onData=chunk=>{bytes=Buffer.concat([bytes,chunk]);flush();};
  const onEnd=()=>error(wrapError('PROXY_EOF','SOCKS5 proxy disconnected during handshake'));
  const onAbort=()=>socket.destroy(abortError());
  socket.on('data',onData);socket.on('error',error);socket.on('end',onEnd);
  signal?.addEventListener('abort',onAbort,{once:true});
  socket.resume();
  return {
    read(length){
      if(failed)return Promise.reject(failed);
      if(length<=bytes.length){const out=bytes.subarray(0,length);bytes=bytes.subarray(length);return Promise.resolve(out);}
      if(pending)return Promise.reject(wrapError('PROXY_READ_CONFLICT','Concurrent SOCKS reads are unsupported'));
      return new Promise((resolve,reject)=>{pending={length,resolve,reject};});
    },
    close(){
      socket.pause();socket.off('data',onData);socket.off('error',error);socket.off('end',onEnd);
      signal?.removeEventListener('abort',onAbort);
      if(bytes.length)socket.unshift(bytes);
    }
  };
}

/** Exported for deterministic local SOCKS5 handshake tests. */
export async function openSocks5Tunnel(proxy,signal){
  const socket=await openTcp(proxy.hostname,Number(proxy.port)||1080,signal);
  const reader=socketReader(socket,signal);
  try{
    const user=decodeURIComponent(proxy.username||''),pass=decodeURIComponent(proxy.password||'');
    const authenticated=Boolean(user||pass);
    socket.write(Buffer.from([5,1,authenticated?2:0]));
    const method=await reader.read(2);
    if(method[0]!==5 || method[1]==255)throw wrapError('SOCKS_AUTH_REJECTED','SOCKS5 server rejected auth method');
    if(authenticated&&method[1]!==2 || !authenticated&&method[1]!==0)
      throw wrapError('SOCKS_AUTH_MISMATCH','SOCKS5 proxy authentication method mismatch');
    if(authenticated){
      const u=Buffer.from(user),p=Buffer.from(pass);
      if(!u.length||u.length>255||p.length>255)throw wrapError('SOCKS_AUTH_INVALID','SOCKS5 credential length invalid');
      socket.write(Buffer.concat([Buffer.from([1,u.length]),u,Buffer.from([p.length]),p]));
      const verified=await reader.read(2);
      if(verified[0]!==1||verified[1]!==0)throw wrapError('SOCKS_AUTH_FAILED','SOCKS5 proxy authentication failed');
    }
    // Domain-name form means GitHub DNS happens at the proxy rather than the local machine.
    const host=Buffer.from(HOST,'ascii');
    socket.write(Buffer.concat([Buffer.from([5,1,0,3,host.length]),host,Buffer.from([1,187])]));
    const reply=await reader.read(4);
    if(reply[0]!==5||reply[2]!==0)throw wrapError('SOCKS_INVALID_REPLY','Invalid SOCKS5 reply');
    if(reply[1]!==0)throw wrapError(`SOCKS_CONNECT_${reply[1]}`,'SOCKS5 proxy rejected GitHub connection');
    const addrLength=reply[3]===1?4:reply[3]===4?16:reply[3]===3?(await reader.read(1))[0]:null;
    if(addrLength===null)throw wrapError('SOCKS_INVALID_ADDRESS','SOCKS5 proxy reply address invalid');
    await reader.read(addrLength+2);
    reader.close();socket.setTimeout(0);
    return socket;
  }catch(err){reader.close();socket.destroy();throw err;}
}

async function secureGithubTunnel(socket,signal){
  return new Promise((resolve,reject)=>{
    const secure=tls.connect({socket,servername:HOST,rejectUnauthorized:true});
    let finished=false;
    const done=(err)=>{
      if(finished)return;finished=true;
      secure.off('error',fail);secure.off('secureConnect',success);
      signal?.removeEventListener('abort',abort);
      if(err){secure.destroy();reject(err);}else resolve(secure);
    };
    const fail=err=>done(err);
    const success=()=>done(null);
    const abort=()=>secure.destroy(abortError());
    secure.once('error',fail);secure.once('secureConnect',success);
    if(signal?.aborted){done(abortError());return;}
    signal?.addEventListener('abort',abort,{once:true});
  });
}
/** Return fetch-compatible response with either IncomingMessage or ReadableStream body. */
export async function githubTransportFetch(target,options={},env=process.env,override=null){
  const url=new URL(target);
  if(url.protocol!=='https:'||url.hostname!==HOST||url.port){
    throw new Error('GitHub transport accepts only https://api.github.com');
  }
  const proxy=githubProxyEnvironment(env,override);
  if(proxy.kind==='invalid')throw wrapError(proxy.reason,'Invalid GitHub proxy configuration');
  if(!proxy.enabled)return globalThis.fetch(url.toString(),options);
  const tunnel=proxy.kind==='socks5'
    ?await openSocks5Tunnel(proxy.url,options.signal)
    :await connectHttpTunnel(proxy.url,options.signal);
  const secureSocket=await secureGithubTunnel(tunnel,options.signal);
  return new Promise((resolve,reject)=>{
    const agent=new https.Agent({keepAlive:false,maxSockets:1});
    agent.createConnection=(requestOptions,callback)=>callback(null,secureSocket);
    const request=https.request({
      hostname:HOST,port:TUNNEL_PORT,path:url.pathname+url.search,
      method:options.method||'GET',headers:options.headers||{},
      agent,signal:options.signal,
      rejectUnauthorized:true,servername:HOST
    },response=>{
      const status=response.statusCode||502;
      resolve({status,ok:status>=200&&status<300,body:response,headers:response.headers});
    });
    request.once('error',reject);
    if(options.body)request.write(options.body);
    request.end();
  });
}
