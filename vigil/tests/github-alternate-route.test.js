import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {handleGithubProxy} from '../scripts/github-proxy.mjs';

async function withBridge(fn){
  const upstream=[];
  const fakeFetch=async(url,opts)=>{
    upstream.push({url:String(url),method:opts.method,authorization:opts.headers.Authorization});
    const path=new URL(String(url)).pathname;
    if(path.endsWith('/contents'))return new Response(JSON.stringify([{type:'file',name:'README.md',path:'README.md',sha:'demo'}]),{status:200});
    return new Response(JSON.stringify({full_name:'octocat/Hello-World',default_branch:'master'}),{status:200});
  };
  const server=createServer(async(req,res)=>{
    try{
      if(!await handleGithubProxy(req,res,{fetchImpl:fakeFetch}))res.writeHead(404).end();
    }catch(error){if(!res.headersSent)res.writeHead(500).end(String(error?.name||'ERROR'));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{return await fn(`http://127.0.0.1:${server.address().port}`,upstream);}
  finally{await new Promise(resolve=>server.close(resolve));}
}

test('alternate localhost route reads public metadata and directory using identical strict relay',async()=>{
  await withBridge(async(base,upstream)=>{
    for(const path of ['repos/octocat/Hello-World','repos/octocat/Hello-World/contents']){
      const res=await fetch(`${base}/api/vigil-bridge/${path}`);
      assert.equal(res.status,200);
      assert.equal(res.headers.get('x-vigil-github-proxy'),'1');
      const data=await res.json();
      assert.ok(data.full_name==='octocat/Hello-World'||Array.isArray(data));
    }
    assert.deepEqual(upstream.map(x=>x.url),[
      'https://api.github.com/repos/octocat/Hello-World',
      'https://api.github.com/repos/octocat/Hello-World/contents'
    ]);
  });
});

test('alternate route rejects authenticated reads, writes and disallowed paths',async()=>{
  await withBridge(async(base,upstream)=>{
    const path=`${base}/api/vigil-bridge/repos/octocat/Hello-World/contents/note.md`;
    const auth=await fetch(path,{headers:{Authorization:'Bearer token'}});
    assert.equal(auth.status,403);
    assert.equal((await auth.json()).code,'ANONYMOUS_READ_ONLY');
    const put=await fetch(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(put.status,403);
    assert.equal((await put.json()).code,'ANONYMOUS_READ_ONLY');
    const wrong=await fetch(`${base}/api/vigil-bridge/https://evil.example/`);
    assert.equal(wrong.status,400);
    assert.equal(upstream.length,0);
  });
});
