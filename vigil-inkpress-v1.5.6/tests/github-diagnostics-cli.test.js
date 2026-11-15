import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const exec=promisify(execFile);
const project=resolve(fileURLToPath(new URL('../',import.meta.url)));

async function withLocalDiagnosticsServer(handler,fn){
  const server=http.createServer((req,res)=>{
    const path=req.url?.split('?')[0]||'/';
    res.writeHead(handler(path).status||200,{
      'Content-Type':'application/json',
      'X-Vigil-Github-Proxy':'1'
    }).end(JSON.stringify(handler(path).data));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{return await fn(server.address().port);}
  finally{await new Promise(resolve=>server.close(resolve));}
}
const success=path=>{
  if(path==='/api/github/health')return {data:{ok:true,localOnly:true}};
  if(path==='/api/github/proxy')return {data:{ok:true,effective:{mode:'http',source:'MANUAL',endpoint:'127.0.0.1:7897'}}};
  if(path==='/api/github/diagnose')return {data:{ok:true,bodyVerified:true,upstreamStatus:200}};
  if(path.endsWith('/contents'))return {data:[{name:'README.md'}]};
  if(path.endsWith('/Hello-World'))return {data:{full_name:'octocat/Hello-World'}};
  return {status:404,data:{code:'NOT_FOUND'}};
};
test('diagnose:github checks 6 real local routes without using a PAT',async()=>{
  await withLocalDiagnosticsServer(success,async port=>{
    const {stdout}=await exec(process.execPath,['scripts/diagnose-github.mjs'],{
      cwd:project,env:{...process.env,VIGIL_PORT:String(port)}
    });
    assert.equal((stdout.match(/^PASS /gm)||[]).length,6);
    assert.match(stdout,/bodyVerified=true/);
    assert.match(stdout,/127\.0\.0\.1:7897/);
    assert.match(stdout,/公开仓库目录/);
  });
});
test('diagnose:github reports a 502 metadata error and exits nonzero',async()=>{
  await withLocalDiagnosticsServer(path=>path.endsWith('/Hello-World')
    ?{status:502,data:{code:'GITHUB_UNREACHABLE',detail:'ECONNRESET'}}:success(path),async port=>{
      await assert.rejects(exec(process.execPath,['scripts/diagnose-github.mjs'],{
        cwd:project,env:{...process.env,VIGIL_PORT:String(port)}
      }),err=>{
        assert.equal(err.code,1);
        assert.match(err.stdout,/FAIL.*公开仓库信息.*HTTP 502/);
        assert.match(err.stdout,/ECONNRESET/);
        return true;
      });
    });
});
