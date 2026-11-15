// Sub-path deployment (e.g. https://server:8443/vigil/ behind nginx).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildCSS,bundleRelativeUrl} from '../scripts/build-css.mjs';
import {GithubClient} from '../src/github/api.js';
import {handleGithubProxy} from '../scripts/github-proxy.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
function jsFiles(dir){
  return readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>
    e.isDirectory()?jsFiles(join(dir,e.name)):/\.m?js$/.test(e.name)?[join(dir,e.name)]:[]);
}

test('index.html and browser sources use document-relative asset / relay URLs only',()=>{
  const rootAbs=/["'`(]\/(?:assets|vendor|src|fonts|api)\//;
  assert.doesNotMatch(read('index.html'),rootAbs);
  for(const file of jsFiles('src'))assert.doesNotMatch(read(file),rootAbs,file);
});

test('CSS bundle rewrites project-root URLs relative to assets/ and every target exists',async()=>{
  assert.equal(bundleRelativeUrl('/assets/a.webp'),'a.webp');
  assert.equal(bundleRelativeUrl('/fonts/t.ttf'),'../fonts/t.ttf');
  assert.equal(bundleRelativeUrl('https://x/y.png'),'https://x/y.png');
  await buildCSS();
  const css=read('assets/vigil.css');
  const urls=[...css.matchAll(/url\(\s*(['"]?)([^'"\)\s]+)\1\s*\)/g)].map(m=>m[2])
    .filter(u=>!/^(?:data:|#|https?:)/.test(u));
  assert.ok(urls.length>20);
  for(const url of urls){
    assert.ok(!url.startsWith('/'),`root-absolute url left in bundle: ${url}`);
    if(url.startsWith('../fonts/'))continue; // user-supplied fonts may be absent
    const file=resolve(root,'assets',url);
    assert.ok(existsSync(file)&&statSync(file).isFile(),`missing asset: ${url}`);
  }
});

async function withPage({hostname,relayMeta},fn){
  const saved={fetch:globalThis.fetch,location:Object.getOwnPropertyDescriptor(globalThis,'location'),
    document:Object.getOwnPropertyDescriptor(globalThis,'document')};
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url:String(url),credentials:options.credentials});
    return {ok:true,status:200,headers:{get:k=>k==='X-Vigil-Github-Proxy'?'1':null},
      json:async()=>({full_name:'octocat/Hello-World'})};
  };
  Object.defineProperty(globalThis,'location',{value:{protocol:'https:',hostname},configurable:true});
  Object.defineProperty(globalThis,'document',{value:{querySelector:sel=>relayMeta&&sel==='meta[name="vigil-relay"]'?{}:null},configurable:true});
  try{await fn(calls);}
  finally{
    globalThis.fetch=saved.fetch;
    for(const key of ['location','document']){
      if(saved[key])Object.defineProperty(globalThis,key,saved[key]);else delete globalThis[key];
    }
  }
}

test('page served by the Node service uses the same-origin relay on a non-localhost host',async()=>{
  await withPage({hostname:'10.129.81.79',relayMeta:true},async calls=>{
    const client=new GithubClient();
    client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setToken('github_pat_example');
    await client.getRepository();
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'api/github/repos/octocat/Hello-World');
    assert.equal(calls[0].credentials,'same-origin');
  });
});

test('plain static hosting (no relay marker) keeps direct GitHub requests without credentials',async()=>{
  await withPage({hostname:'example.org',relayMeta:false},async calls=>{
    const client=new GithubClient();
    client.setConfig({owner:'octocat',repo:'Hello-World'});
    await client.getRepository();
    assert.equal(calls[0].url,'https://api.github.com/repos/octocat/Hello-World');
    assert.equal(calls[0].credentials,'omit');
  });
});

test('VIGIL_PROXY_LOCK: visitors cannot point the shared server relay at a proxy port',async()=>{
  const server=createServer(async(req,res)=>{if(!(await handleGithubProxy(req,res)))res.writeHead(404).end();});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/api/github/proxy`;
  process.env.VIGIL_PROXY_LOCK='1';
  try{
    const post=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'http',host:'127.0.0.1',port:7897})});
    const info=await post.json();
    assert.equal(post.status,409);
    assert.equal(info.code,'PROXY_LOCKED');
    const state=await (await fetch(base)).json();
    assert.equal(state.locked,true);
    assert.notEqual(state.settings.mode,'http');
  }finally{
    delete process.env.VIGIL_PROXY_LOCK;
    server.close();
  }
});

test('dev server marks index.html as relay-capable and serves it under any host',async()=>{
  const port=20000+Math.floor(Math.random()*20000);
  const child=spawn(process.execPath,['scripts/dev-server.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  try{
    await new Promise((ok,fail)=>{
      const timer=setTimeout(()=>fail(new Error('dev server did not start')),8000);
      child.stdout.on('data',d=>{if(String(d).includes('Vigil MVP')){clearTimeout(timer);ok();}});
      child.on('exit',code=>{clearTimeout(timer);fail(new Error('dev server exited '+code));});
    });
    const html=await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.match(html,/<meta name="vigil-relay" content="same-origin">\s*<\/head>/);
    assert.match(html,/href="assets\/vigil\.css"/);
  }finally{child.kill();}
});
