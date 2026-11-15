import test from 'node:test';
import assert from 'node:assert/strict';
import {GithubClient} from '../src/github/api.js';
import {checkGithubBrowserPaths} from '../src/github/browser-diagnostics.js';
import {inspectGithubRepository} from '../src/github/connection.js';

async function withBrowser(fakeFetch,fn){
  const originalFetch=globalThis.fetch,locationDesc=Object.getOwnPropertyDescriptor(globalThis,'location');
  globalThis.fetch=fakeFetch;
  Object.defineProperty(globalThis,'location',{value:{protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:5173'},configurable:true});
  try{return await fn();}finally{
    globalThis.fetch=originalFetch;
    if(locationDesc)Object.defineProperty(globalThis,'location',locationDesc);
    else delete globalThis.location;
  }
}
function reply(data,{status=200,relay=true,invalid=false}={}){
  return {ok:status>=200&&status<300,status,
    headers:{get:key=>key.toLowerCase()==='x-vigil-github-proxy'&&relay?'1':null},
    json:async()=>{if(invalid)throw new TypeError('Failed to read stream');return data;}};
}
function canned(url){
  const path=new URL(url,'http://127.0.0.1').pathname;
  if(path.endsWith('/.gitattributes'))return reply({message:'Not Found'},{status:404});
  if(path.endsWith('/contents'))return reply([{name:'README.md',path:'README.md',type:'file',sha:'f1'}]);
  if(path.endsWith('/diagnose'))return reply({bodyVerified:true,ok:true,upstreamStatus:200});
  return reply({full_name:'octocat/Hello-World',default_branch:'master'});
}
test('four browser probes PASS implies the exact app anonymous GET is accepted by same restricted fetch policy',async()=>{
  const seen=[];
  await withBrowser(async(url,opts)=>{
    const accept=opts.headers?.Accept||'';
    seen.push({url:String(url),accept,token:opts.headers?.Authorization||'',signal:opts.signal});
    // Demonstrates the user's earlier behavior: vendor-specific Accept rejected,
    // but the browser's simple JSON diagnostic header is allowed.
    if(accept!=='application/json')throw new TypeError('request blocked by browser policy');
    return canned(url);
  },async()=>{
    const checks=await checkGithubBrowserPaths();
    assert.equal(checks.checks.every(x=>x.ok),true);
    const client=new GithubClient();
    client.setConfig({owner:'octocat',repo:'Hello-World',branch:'',folder:''});
    client.setAnonymousConnectionMode('auto');
    const connected=await inspectGithubRepository(client);
    assert.equal(connected.meta.full_name,'octocat/Hello-World');
    assert.equal(connected.files[0].name,'README.md');
    assert.equal(client.transport,'local-relay');
  });
  assert.ok(seen.every(x=>x.accept==='application/json'));
  assert.ok(seen.every(x=>!x.token));
  assert.ok(seen.some(x=>x.url.endsWith('/contents')));
});

test('a broken metadata response body retries a fresh signal on the anonymous bridge',async()=>{
  const seen=[];
  await withBrowser(async(url,opts)=>{
    seen.push({url:String(url),signal:opts.signal});
    if(String(url).startsWith('api/github/')){
      opts.signal?.dispatchEvent?.(new Event('abort')); // emulate rejected/aborted primary
      return reply({}, {invalid:true});
    }
    if(String(url).startsWith('api/vigil-bridge/'))return canned(url);
    throw Error('unexpected direct fallback');
  },async()=>{
    const client=new GithubClient();
    client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setAnonymousConnectionMode('auto');
    const result=await inspectGithubRepository(client);
    assert.equal(result.meta.default_branch,'master');
    assert.equal(client.anonymousConnectionMode,'alternate');
    assert.equal(client.transport,'local-relay');
  });
  assert.ok(seen[0].signal!==seen[1].signal);
  assert.equal(seen[1].signal.aborted,false);
});

test('authenticated GET and PUT must never silently retry through anonymous bridge',async()=>{
  const calls=[];
  await withBrowser(async(url,opts)=>{
    calls.push({url:String(url),method:opts.method,authorization:opts.headers?.Authorization});
    throw new TypeError('network disconnected');
  },async()=>{
    const client=new GithubClient();
    client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setToken('test-pat-not-saved');
    await assert.rejects(()=>client.getRepository(),/转发请求失败/);
    await assert.rejects(()=>client.request('contents/README.md',{method:'PUT',body:{message:'x'}}),/提交连接中断/);
  });
  assert.equal(calls.length,2);
  assert.ok(calls.every(x=>x.url.startsWith('api/github/')&&x.authorization==='Bearer test-pat-not-saved'));
});
