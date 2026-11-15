import test from 'node:test';
import assert from 'node:assert/strict';
import {GithubClient} from '../src/github/api.js';
import {inspectGithubRepository} from '../src/github/connection.js';

async function withBrowser(fetcher,fn){
  const oldFetch=globalThis.fetch,locationDescriptor=Object.getOwnPropertyDescriptor(globalThis,'location');
  globalThis.fetch=fetcher;
  Object.defineProperty(globalThis,'location',{value:{protocol:'http:',hostname:'127.0.0.1'},configurable:true});
  try{return await fn();}
  finally{
    globalThis.fetch=oldFetch;
    if(locationDescriptor)Object.defineProperty(globalThis,'location',locationDescriptor);
    else delete globalThis.location;
  }
}
const reply=(data,status=200,relay=false)=>({
  ok:status>=200&&status<300,status,
  headers:{get:name=>name.toLowerCase()==='x-vigil-github-proxy'&&relay?'1':null},
  json:async()=>data
});
const publicApi=url=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/.gitattributes'))return reply({message:'Not Found'},404);
  if(path.endsWith('/contents'))return reply([{type:'file',name:'README.md',path:'README.md',sha:'demo1'}]);
  return reply({full_name:'octocat/Hello-World',default_branch:'master'});
};

test('explicit anonymous auto mode: relay TypeError switches to public browser GET and stays there',async()=>{
  const calls=[];
  await withBrowser(async(url,options)=>{
    calls.push({url:String(url),headers:options.headers});
    if(String(url).startsWith('api/github/'))throw new TypeError('Failed to fetch');
    return publicApi(url);
  },async()=>{
    const client=new GithubClient();
    client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setAnonymousConnectionMode('auto');
    const result=await inspectGithubRepository(client);
    assert.equal(result.meta.full_name,'octocat/Hello-World');
    assert.equal(result.files[0].name,'README.md');
    assert.equal(client.transport,'browser-anonymous');
    assert.match(client.relayWarning,/TypeError/);
    assert.equal(client.anonymousConnectionMode,'direct');
  });
  assert.equal(calls.filter(c=>c.url.startsWith('api/github/')).length,1);
  assert.equal(calls.filter(c=>c.url.startsWith('https://api.github.com/')).length,3);
  assert.ok(calls.every(c=>!Object.keys(c.headers).some(name=>name.toLowerCase()==='authorization')));
});

test('anonymous 502 may use browser direct, preserving explicit transport identity',async()=>{
  const calls=[];
  await withBrowser(async(url,options)=>{
    calls.push(String(url));
    if(String(url).startsWith('api/github/'))return reply({code:'GITHUB_UNREACHABLE',detail:'EAI_AGAIN'},502,true);
    return publicApi(url);
  },async()=>{
    const client=new GithubClient();client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setAnonymousConnectionMode('auto');
    assert.equal((await client.getRepository()).full_name,'octocat/Hello-World');
    assert.equal(client.transport,'browser-anonymous');
    assert.match(client.relayWarning,/502/);
  });
  assert.equal(calls.length,3); // primary -> alternate -> direct, GET only
  assert.ok(calls[1].startsWith('api/vigil-bridge/'));
});

test('if all three anonymous read paths fail, error preserves all causes',async()=>{
  await withBrowser(async url=>{
    if(String(url).startsWith('api/github/'))throw new TypeError('Failed to fetch');
    throw Object.assign(new TypeError('Failed to fetch'),{code:'ERR_BLOCKED_BY_CLIENT'});
  },async()=>{
    const client=new GithubClient();client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setAnonymousConnectionMode('auto');
    await assert.rejects(()=>client.getRepository(),/三个通道均未连通.*主同源.*TypeError.*备用同源.*ERR_BLOCKED_BY_CLIENT.*浏览器直连.*ERR_BLOCKED_BY_CLIENT/);
  });
});

test('no automatic browser direct for PAT reads or writes, even after earlier anonymous connection',async()=>{
  const urls=[];
  await withBrowser(async url=>{
    urls.push(String(url));throw new TypeError('relay unavailable');
  },async()=>{
    const client=new GithubClient();client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setAnonymousConnectionMode('auto');client.setToken('a-private-pat');
    assert.equal(client.anonymousConnectionMode,'relay');
    await assert.rejects(()=>client.getRepository(),/本地 GitHub 同源转发请求失败/);
    await assert.rejects(()=>client.request('contents/README.md',{method:'PUT',body:{message:'x'}}),/本地同源通道提交连接中断/);
    assert.deepEqual(urls,[
      'api/github/repos/octocat/Hello-World',
      'api/github/repos/octocat/Hello-World/contents/README.md'
    ]);
  });
});

test('default connection with no opt-in remains relay-only',async()=>{
  const calls=[];
  await withBrowser(async url=>{calls.push(String(url));throw new TypeError('Failed to fetch');},async()=>{
    const client=new GithubClient();client.setConfig({owner:'octocat',repo:'Hello-World'});
    await assert.rejects(()=>client.getRepository(),/本地 GitHub 同源转发请求失败/);
  });
  assert.deepEqual(calls,['api/github/repos/octocat/Hello-World']);
});

test('HTTP 200 without valid repository JSON is no longer treated as a successful connection',async()=>{
  await withBrowser(async()=>reply({ok:true}),async()=>{
    const client=new GithubClient();client.setConfig({owner:'octocat',repo:'Hello-World'});
    await assert.rejects(()=>client.getRepository(),/仓库元数据缺失/);
  });
});
test('truncated response JSON returns a concrete body error rather than a fake empty repository',async()=>{
  await withBrowser(async()=>({ok:true,status:200,headers:{get:()=>null},json:async()=>{throw new SyntaxError('truncated')}}),async()=>{
    const client=new GithubClient();client.setConfig({owner:'octocat',repo:'Hello-World'});
    await assert.rejects(()=>client.getRepository(),/JSON 正文不完整/);
  });
});


test('blocked primary repository URL uses anonymous same-origin bridge, and keeps it for directory and attributes',async()=>{
  const calls=[];
  await withBrowser(async(url,options)=>{
    const u=String(url);calls.push({url:u,headers:options.headers,method:options.method});
    if(u.startsWith('api/github/repos/'))throw Object.assign(new TypeError('Blocked request'),{code:'ERR_BLOCKED_BY_CLIENT'});
    if(u.startsWith('api/vigil-bridge/')){
      const suffix=u.slice('api/vigil-bridge'.length);
      if(suffix.endsWith('/.gitattributes'))return reply({message:'Not Found'},404,true);
      if(suffix.endsWith('/contents'))return reply([{type:'file',name:'README.md',path:'README.md',sha:'demo1'}],200,true);
      return reply({full_name:'octocat/Hello-World',default_branch:'master'},200,true);
    }
    throw Error('unexpected browser direct call: '+u);
  },async()=>{
    const client=new GithubClient();client.setConfig({owner:'octocat',repo:'Hello-World'});
    client.setAnonymousConnectionMode('auto');
    const data=await inspectGithubRepository(client);
    assert.equal(data.meta.full_name,'octocat/Hello-World');
    assert.equal(data.files[0].name,'README.md');
    assert.equal(data.attributes,'');
    assert.equal(client.anonymousConnectionMode,'alternate');
    assert.equal(client.transport,'local-relay');
    assert.match(client.relayWarning,/备用本地通道/);
  });
  assert.equal(calls.filter(x=>x.url.startsWith('api/github/')).length,1);
  assert.equal(calls.filter(x=>x.url.startsWith('api/vigil-bridge/')).length,3);
  assert.equal(calls.filter(x=>x.url.startsWith('https://')).length,0);
  assert.ok(calls.every(x=>x.method==='GET'&&!Object.keys(x.headers).some(k=>k.toLowerCase()==='authorization')));
});
