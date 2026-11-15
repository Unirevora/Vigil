import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Readable} from 'node:stream';
import {once} from 'node:events';
import {GithubClient} from '../src/github/api.js';
import {inspectGithubRepository} from '../src/github/connection.js';
import {handleGithubProxy} from '../scripts/github-proxy.mjs';

async function localRelayCase(fakeUpstream,action){
  const seen=[];
  const handler=async(url,options)=>{
    seen.push({url:String(url),authorized:Boolean(options.headers?.Authorization)});
    return fakeUpstream(new URL(url).pathname,options);
  };
  const server=http.createServer((req,res)=>handleGithubProxy(req,res,{fetchImpl:handler,timeoutMs:2500}));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const original=globalThis.fetch;
  const oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
  try{
    globalThis.fetch=(url,options)=>original(new URL(url,base),options);
    Object.defineProperty(globalThis,'location',{value:{protocol:'http:',hostname:'127.0.0.1'},configurable:true});
    const client=new GithubClient();
    client.setConfig({repoUrl:'https://github.com/octocat/Hello-World'});
    await action({client,seen});
  }finally{
    globalThis.fetch=original;
    if(oldLocation)Object.defineProperty(globalThis,'location',oldLocation);
    else delete globalThis.location;
    await new Promise(resolve=>server.close(resolve));
  }
}
const success=(data,status=200)=>({ok:status>=200&&status<300,status,body:Readable.from([JSON.stringify(data)])});
const response=path=>{
  if(path==='/repos/octocat/Hello-World')return success({full_name:'octocat/Hello-World',default_branch:'master'});
  if(path==='/repos/octocat/Hello-World/contents')return success([{type:'file',name:'README.md',path:'README.md',sha:'one'},{type:'file',name:'image.png',path:'image.png',sha:'two'}]);
  if(path==='/repos/octocat/Hello-World/contents/.gitattributes')return success({message:'Not Found'},404);
  return success({message:'Unknown'},404);
};

test('匿名公开仓库：通过真实本地 relay 完整读取信息、目录，容忍 .gitattributes 404',async()=>{
  await localRelayCase(response,async({client,seen})=>{
    const stages=[];
    const data=await inspectGithubRepository(client,{onStage:step=>stages.push(step)});
    assert.equal(data.meta.full_name,'octocat/Hello-World');
    assert.equal(data.files.length,1);
    assert.equal(data.attributes,'');
    assert.equal(data.attributesWarning,'');
    assert.equal(client.transport,'local-relay');
    assert.deepEqual(stages,['metadata','contents','attributes','done']);
    assert.deepEqual(seen.map(c=>new URL(c.url).pathname),[
      '/repos/octocat/Hello-World',
      '/repos/octocat/Hello-World/contents',
      '/repos/octocat/Hello-World/contents/.gitattributes'
    ]);
    assert.ok(seen.every(x=>!x.authorized),'anon public test must never attach token');
  });
});

test('连接失败会指出具体阶段：目录读取错误不会再伪装成整体网络失败',async()=>{
  await localRelayCase(path=>path.endsWith('/contents')?success({message:'Not Found'},404):response(path),
    async({client})=>{
      await assert.rejects(inspectGithubRepository(client),err=>{
        assert.equal(err.stage,'contents');
        assert.match(err.message,/根目录与 Markdown 文件阶段失败.*404/);
        return true;
      });
    });
});

test('可读仓库上的 .gitattributes 网络错误仅产生警告，不阻断只读浏览',async()=>{
  await localRelayCase(path=>path.endsWith('/.gitattributes')?success({message:'timeout',code:'GITHUB_TIMEOUT',detail:'TIMEOUT',transport:'MANUAL'},502):response(path),
    async({client})=>{
      const result=await inspectGithubRepository(client);
      assert.equal(result.files.length,1);
      assert.match(result.attributesWarning,/GitHub|请求|timeout|TIMEOUT/);
    });
});

test('明确使用匿名模式后，旧的 session PAT 不会被添加到任何公开仓库请求',async()=>{
  await localRelayCase(response,async({client,seen})=>{
    client.setToken('a-previous-token');
    assert.equal(client.canWrite,true);
    client.forgetToken();
    assert.equal(client.canWrite,false);
    await inspectGithubRepository(client);
    assert.equal(seen.length,3);
    assert.equal(seen.filter(call=>call.authorized).length,0);
  });
});
