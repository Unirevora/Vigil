import test from 'node:test';
import assert from 'node:assert/strict';
import {GithubClient} from '../src/github/api.js';
import {inspectGithubRepository} from '../src/github/connection.js';
import {checkGithubBrowserPaths} from '../src/github/browser-diagnostics.js';

async function withPageGlobals(action){
  const originalFetch=globalThis.fetch;
  const locationDescriptor=Object.getOwnPropertyDescriptor(globalThis,'location');
  Object.defineProperty(globalThis,'location',{
    value:{protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:5173'},configurable:true
  });
  try{return await action();}
  finally{
    globalThis.fetch=originalFetch;
    if(locationDescriptor)Object.defineProperty(globalThis,'location',locationDescriptor);
    else delete globalThis.location;
  }
}
function reply(value, status=200){
  return new Response(JSON.stringify(value),{
    status,headers:{'Content-Type':'application/json','X-Vigil-Github-Proxy':'1'}
  });
}
const canned=url=>{
  const path=new URL(url,'http://127.0.0.1:5173').pathname;
  if(path.endsWith('/diagnose'))return reply({ok:true,bodyVerified:true});
  if(path.endsWith('/.gitattributes'))return reply({message:'Not Found'},404);
  if(path.endsWith('/contents'))return reply([{name:'README.md',type:'file',path:'README.md',sha:'aa'}]);
  return reply({full_name:'octocat/Hello-World',default_branch:'master'});
};

test('浏览器网络检测 PASS 但 fetch 在启动后被替换：客户端仍使用当前的 fetch 完成仓库连接',async()=>{
  await withPageGlobals(async()=>{
    let staleCalls=0;
    globalThis.fetch=async()=>{staleCalls++;throw new TypeError('Failed to fetch: stale request wrapper');};
    const client=new GithubClient(); // captures the OLD function in v1.5.6, was the mismatch
    client.setConfig({owner:'octocat',repo:'Hello-World',folder:'',branch:''});
    client.setAnonymousConnectionMode('auto');
    const seen=[];
    globalThis.fetch=async(url,options)=>{
      seen.push({url:String(url),method:options.method,credentials:options.credentials,accept:options.headers?.Accept});
      return canned(url);
    };
    const browser=await checkGithubBrowserPaths();
    assert.equal(browser.checks.every(check=>check.ok),true,'all four browser probes pass');
    const connected=await inspectGithubRepository(client);
    assert.equal(connected.meta.full_name,'octocat/Hello-World');
    assert.equal(connected.files[0].name,'README.md');
    assert.equal(staleCalls,0,'stale fetch must NEVER be used');
    assert.ok(seen.some(x=>x.url.endsWith('/api/github/repos/octocat/Hello-World')));
    assert.ok(seen.every(x=>x.credentials==='omit'));
    assert.ok(seen.every(x=>x.accept==='application/json'));
  });
});

test('明确注入的测试 fetcher 继续固定，不会被全局 fetch 覆盖',async()=>{
  await withPageGlobals(async()=>{
    let directCalls=0;
    const mock=async()=>{directCalls++;return reply({full_name:'octocat/Hello-World'});};
    const client=new GithubClient(mock);
    client.setConfig({owner:'octocat',repo:'Hello-World'});
    const previous=globalThis.fetch;
    globalThis.fetch=async()=>{throw new Error('unrelated browser fetch');};
    try{
      const repo=await client.getRepository();
      assert.equal(repo.full_name,'octocat/Hello-World');
      assert.equal(directCalls,1);
    }finally{globalThis.fetch=previous;}
  });
});

test('metadata 网络 TypeError 的追踪标注 fetch 环节而非泛化错误',async()=>{
  await withPageGlobals(async()=>{
    globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};
    const client=new GithubClient();
    client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setAnonymousConnectionMode('auto');
    await assert.rejects(()=>client.getRepository(),/三个通道/);
    assert.equal(client.requestTrace.length,3);
    assert.deepEqual(client.requestTrace.map(x=>x.phase),['fetch','fetch','fetch']);
    assert.ok(client.requestTrace.every(x=>x.error==='TypeError'&&x.hint==='FETCH_REJECTED'));
  });
});

test('响应 JSON 正文 TypeError 会标注 response-body，而不是混同于 fetch 网络错误',async()=>{
  await withPageGlobals(async()=>{
    globalThis.fetch=async()=>({
      ok:true,status:200,headers:new Headers({'X-Vigil-Github-Proxy':'1'}),
      json:async()=>{throw new TypeError('Stream aborted');}
    });
    const client=new GithubClient();
    client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setAnonymousConnectionMode('auto');
    await assert.rejects(()=>client.getRepository(),/JSON 正文/);
    assert.equal(client.requestTrace.length,3);
    assert.ok(client.requestTrace.every(item=>item.phase==='response-body'));
    assert.ok(client.requestTrace.every(item=>item.error==='INVALID_JSON_BODY'));
  });
});
