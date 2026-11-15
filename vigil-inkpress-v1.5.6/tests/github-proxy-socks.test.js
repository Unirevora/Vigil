import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {once} from 'node:events';
import {
  githubProxyEnvironment,normalizeGithubProxySettings,openSocks5Tunnel,githubTransportFetch
} from '../scripts/github-transport.mjs';
import {handleGithubProxy} from '../scripts/github-proxy.mjs';

function socksProxy({result=0,authentication=false}={}){
  let lastHostname='',count=0;
  const server=net.createServer(socket=>{
    let buffer=Buffer.alloc(0),phase='greeting';
    socket.on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk]);
      while(true){
        if(phase==='greeting'){
          if(buffer.length<2)return;
          const n=buffer[1];
          if(buffer.length<2+n)return;
          const choices=[...buffer.subarray(2,2+n)];
          buffer=buffer.subarray(2+n);
          assert.equal(choices.includes(authentication?2:0),true);
          socket.write(Buffer.from([5,authentication?2:0]));
          phase=authentication?'auth':'request';
        }else if(phase==='auth'){
          if(buffer.length<2)return;
          const userLen=buffer[1];
          if(buffer.length<3+userLen)return;
          const passLen=buffer[2+userLen];
          if(buffer.length<3+userLen+passLen)return;
          buffer=buffer.subarray(3+userLen+passLen);
          socket.write(Buffer.from([1,0]));
          phase='request';
        }else if(phase==='request'){
          if(buffer.length<5)return;
          assert.deepEqual([...buffer.subarray(0,4)],[5,1,0,3]);
          const n=buffer[4];
          if(buffer.length<5+n+2)return;
          lastHostname=buffer.subarray(5,5+n).toString('ascii');
          const port=buffer.readUInt16BE(5+n);
          assert.equal(port,443);
          buffer=buffer.subarray(7+n);
          count++;
          socket.write(Buffer.from([5,result,0,1,127,0,0,1,0,1]));
          phase='done';
          return;
        }else return;
      }
    });
  });
  return {server,get host(){return lastHostname;},get count(){return count;}};
}

test('SOCKS5 proxies are recognized from HTTPS_PROXY and ALL_PROXY',()=>{
  assert.equal(githubProxyEnvironment({ALL_PROXY:'socks5h://127.0.0.1:1080'}).kind,'socks5');
  assert.equal(githubProxyEnvironment({HTTPS_PROXY:'socks5://127.0.0.1:1080'}).kind,'socks5');
  assert.equal(githubProxyEnvironment({HTTPS_PROXY:'https://localhost:8080'}).kind,'http');
  assert.equal(githubProxyEnvironment({NO_PROXY:'api.github.com',ALL_PROXY:'socks5://localhost:1080'}).enabled,false);
  assert.equal(githubProxyEnvironment({HTTPS_PROXY:'ftp://localhost:21'}).kind,'invalid');
});

test('manual proxy only accepts loopback host and sensible port',()=>{
  assert.deepEqual(normalizeGithubProxySettings({mode:'http',host:'127.0.0.1',port:7890}),{mode:'http',host:'127.0.0.1',port:7890});
  assert.deepEqual(normalizeGithubProxySettings({mode:'socks5',host:'localhost',port:'1080'}),{mode:'socks5',host:'localhost',port:1080});
  assert.throws(()=>normalizeGithubProxySettings({mode:'http',host:'10.0.0.2',port:7890}),/LOCAL/);
  assert.throws(()=>normalizeGithubProxySettings({mode:'http',host:'127.0.0.1',port:0}),/LOCAL/);
  assert.throws(()=>normalizeGithubProxySettings({mode:'http',host:'127.0.0.1',port:65536}),/LOCAL/);
  assert.throws(()=>normalizeGithubProxySettings({mode:'socks4',host:'127.0.0.1',port:1080}),/MODE/);
  assert.equal(githubProxyEnvironment({HTTPS_PROXY:'http://example:8080'}, {mode:'direct'}).reason,'MANUAL_DIRECT');
  assert.equal(githubProxyEnvironment({}, {mode:'socks5',host:'127.0.0.1',port:1080}).kind,'socks5');
});

test('SOCKS5 handshake requests api.github.com by name (remote DNS)',async()=>{
  const proxy=socksProxy();
  proxy.server.listen(0,'127.0.0.1');await once(proxy.server,'listening');
  try{
    const port=proxy.server.address().port;
    const socket=await openSocks5Tunnel(new URL(`socks5://127.0.0.1:${port}`));
    assert.equal(proxy.host,'api.github.com');assert.equal(proxy.count,1);
    socket.destroy();
  }finally{await new Promise(resolve=>proxy.server.close(resolve));}
});

test('SOCKS5 username/password authentication is supported for env URLs',async()=>{
  const proxy=socksProxy({authentication:true});
  proxy.server.listen(0,'127.0.0.1');await once(proxy.server,'listening');
  try{
    const port=proxy.server.address().port;
    const socket=await openSocks5Tunnel(new URL(`socks5://user:password@127.0.0.1:${port}`));
    assert.equal(proxy.host,'api.github.com');socket.destroy();
  }finally{await new Promise(resolve=>proxy.server.close(resolve));}
});

test('SOCKS5 connection rejection has an actionable code',async()=>{
  const proxy=socksProxy({result:5});
  proxy.server.listen(0,'127.0.0.1');await once(proxy.server,'listening');
  try{
    await assert.rejects(openSocks5Tunnel(new URL(`socks5://127.0.0.1:${proxy.server.address().port}`)),err=>err.code==='SOCKS_CONNECT_5');
  }finally{await new Promise(resolve=>proxy.server.close(resolve));}
});

test('manual proxy does not permit arbitrary URL targets',async()=>{
  await assert.rejects(githubTransportFetch('https://example.org/private',{}, {}, {mode:'http',host:'127.0.0.1',port:7890}),/only https/);
});

test('local relay exposes real upstream diagnostic distinct from health',async()=>{
  const server=http.createServer((req,res)=>handleGithubProxy(req,res,{
    fetchImpl:async()=>({ok:true,status:200,body:null}),timeoutMs:2000
  }));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=server.address().port;
  const base=`http://127.0.0.1:${port}`;
  try{
    const health=await (await fetch(base+'/api/github/health')).json();
    assert.equal(health.localOnly,true);assert.equal(health.upstreamTested,false);
    const test=await (await fetch(base+'/api/github/diagnose')).json();
    assert.equal(test.ok,true);assert.equal(test.upstreamStatus,200);
    const data=await (await fetch(base+'/api/github/proxy')).json();
    assert.equal(data.ok,true);
    const updated=await fetch(base+'/api/github/proxy',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'socks5',host:'127.0.0.1',port:1080})});
    assert.equal(updated.status,200);
    assert.equal((await updated.json()).effective.mode,'socks5');
    const blocked=await fetch(base+'/api/github/proxy',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'http',host:'192.168.0.8',port:80})});
    assert.equal(blocked.status,400);
    const crossOrigin=await fetch(base+'/api/github/proxy',{method:'POST',headers:{Origin:'https://evil.example.com','Content-Type':'application/json'},body:'{}'});
    assert.equal(crossOrigin.status,403);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
