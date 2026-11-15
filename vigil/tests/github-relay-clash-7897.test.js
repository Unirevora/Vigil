import test from 'node:test';
import assert from 'node:assert/strict';
import {GithubClient} from '../src/github/api.js';
import {githubProxyEnvironment} from '../scripts/github-transport.mjs';

async function withBrowserStubs(fetcher,fn){
  const previousFetch=globalThis.fetch;
  const previousLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
  globalThis.fetch=fetcher;
  Object.defineProperty(globalThis,'location',{value:{protocol:'http:',hostname:'127.0.0.1'},configurable:true});
  try{return await fn();}
  finally{
    globalThis.fetch=previousFetch;
    if(previousLocation)Object.defineProperty(globalThis,'location',previousLocation);
    else delete globalThis.location;
  }
}

test('localhost relay connection failures must not silently retry via browser direct',async()=>{
  const calls=[];
  await withBrowserStubs(async url=>{
    calls.push(String(url));
    if(String(url).startsWith('api/github/'))throw Object.assign(new TypeError('Failed to fetch'),{code:'ECONNRESET'});
    throw new Error('DANGEROUS_BROWSER_FALLBACK');
  },async()=>{
    const api=new GithubClient();
    api.setConfig({owner:'octocat',repo:'Hello-World'});
    await assert.rejects(()=>api.getRepository(),/本地 GitHub 同源转发请求失败.*ECONNRESET/);
  });
  assert.equal(calls.length,1);
  assert.match(calls[0],/^api\/github\/repos\/octocat\/Hello-World/);
});

test('explicit localhost relay 502 preserves diagnostic reason, not a generic TypeError',async()=>{
  const calls=[];
  await withBrowserStubs(async url=>{
    calls.push(String(url));
    return {
      ok:false,status:502,
      headers:{get:name=>name.toLowerCase()==='x-vigil-github-proxy'?'1':null},
      json:async()=>({code:'GITHUB_UNREACHABLE',detail:'ECONNREFUSED',transport:'MANUAL',message:'本机代理端口拒绝连接'})
    };
  },async()=>{
    const api=new GithubClient();
    api.setConfig({owner:'octocat',repo:'Hello-World'});
    await assert.rejects(()=>api.getRepository(),/本机代理端口拒绝连接（ECONNREFUSED；MANUAL）/);
  });
  assert.equal(calls.length,1);
});

test('Clash mixed port 7897 can be routed through manual HTTP or SOCKS5',()=>{
  const http=githubProxyEnvironment({HTTPS_PROXY:'http://example.invalid:1234'},
    {mode:'http',host:'127.0.0.1',port:7897});
  const socks=githubProxyEnvironment({},
    {mode:'socks5',host:'127.0.0.1',port:7897});
  assert.equal(http.enabled,true);
  assert.equal(http.kind,'http');
  assert.equal(http.reason,'MANUAL');
  assert.equal(http.url.port,'7897');
  assert.equal(socks.kind,'socks5');
  assert.equal(socks.url.port,'7897');
});
