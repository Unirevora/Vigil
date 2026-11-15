import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {handleGithubProxy} from '../scripts/github-proxy.mjs';
import {GithubClient} from '../src/github/api.js';
import {normalizeAppearance,DEFAULT_APPEARANCE} from '../src/appearance/settings.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('外观设置区间和兼容存储键不变，0-85% 背景强度可用',()=>{
  const a=normalizeAppearance({...DEFAULT_APPEARANCE,backgroundOpacity:0,surfaceOpacity:50,theme:'night'});
  assert.equal(a.backgroundOpacity,0);
  assert.equal(a.surfaceOpacity,50);
  assert.equal(a.theme,'night');
  const b=normalizeAppearance({...a,backgroundOpacity:85,surfaceOpacity:100});
  assert.equal(b.backgroundOpacity,85);
  assert.equal(b.surfaceOpacity,100);
});
test('后置样式统一变量的透明度覆盖，夜色也使用相同背景',()=>{
  const css=read('src/styles/vigil-155-repair.css');
  assert.match(css,/opacity:var\(--wallpaper-alpha\)!important/);
  assert.match(read('src/main.js'),/--paper-opacity/);
  assert.match(css,/data-theme=night/);
  assert.match(css,/glass-lens-canvas/);
  const js=read('src/main.js');
  assert.match(js,/glass\?\.refresh\(\)/);
  const html=read('index.html');
  const cssManifest=read('scripts/style-order.json');
  assert.ok(cssManifest.indexOf('vigil-155-repair.css')>cssManifest.indexOf('vigil-155-hotfix.css'));
  assert.match(html,/assets\/vigil\.css/);
});
test('背景场景采样与夜色的图片选择一一对应',()=>{
  const js=read('src/main.js');
  const css=read('src/styles/vigil-155-repair.css');
  for(const path of ['wallpaper-dawn-1672.webp','wallpaper-cloud-mist-2560.webp','wallpaper-garden-1672.webp','wallpaper-moonrise-1672.webp']){
    assert.ok(js.includes(path));assert.ok(css.includes(path));
  }
  assert.doesNotMatch(js,/state\.theme==='night'&&a\.background==='paper'/);
});

async function withProxy(fetchImpl,run){
  const server=createServer((req,res)=>{
    Promise.resolve(handleGithubProxy(req,res,{fetchImpl,timeoutMs:1000}))
      .then(handled=>{if(!handled)res.writeHead(404).end();})
      .catch(()=>res.writeHead(500).end());
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=server.address().port;
  try{return await run(`http://127.0.0.1:${port}`);}
  finally{await new Promise(resolve=>server.close(resolve));}
}

test('本地同源通道可读取公开仓库，严格固定 GitHub 目标地址',async()=>{
  const seen=[];
  await withProxy(async(url,options)=>{
    seen.push({url,options});
    return new Response(JSON.stringify({full_name:'octocat/Hello-World',default_branch:'main'}),
      {status:200,headers:{'Content-Type':'application/json'}});
  },async(base)=>{
    const health=await fetch(base+'/api/github/health');
    assert.equal((await health.json()).ok,true);
    const r=await fetch(base+'/api/github/repos/octocat/Hello-World',{
      headers:{Origin:base}
    });
    assert.equal(r.status,200);
    assert.equal(r.headers.get('x-vigil-github-proxy'),'1');
    assert.equal((await r.json()).full_name,'octocat/Hello-World');
  });
  assert.equal(seen.length,1);
  assert.equal(seen[0].url,'https://api.github.com/repos/octocat/Hello-World');
  assert.equal(seen[0].options.method,'GET');
});
test('客户端携带 SHA 的提交走受限同源通道，不存储 Token',async()=>{
  let intercepted;
  await withProxy(async(url,options)=>{
    intercepted={url,options};
    return new Response(JSON.stringify({content:{sha:'newsha'},commit:{sha:'commitsha'}}),
      {status:200,headers:{'Content-Type':'application/json'}});
  },async(base)=>{
    const r=await fetch(`${base}/api/github/repos/octocat/notes/contents/diary/test.md`,{
      method:'PUT',headers:{Origin:base,'Authorization':'Bearer ghp_testing_token','Content-Type':'application/json'},
      body:JSON.stringify({message:'update',content:'ZGF0YQ==',sha:'oldsha'})
    });
    assert.equal(r.status,200);
    assert.equal((await r.json()).content.sha,'newsha');
  });
  assert.equal(intercepted.options.headers.Authorization,'Bearer ghp_testing_token');
  assert.equal(JSON.parse(intercepted.options.body.toString('utf8')).sha,'oldsha');
  assert.equal(intercepted.url,'https://api.github.com/repos/octocat/notes/contents/diary/test.md');
});
test('代理拒绝外部来源、任意 URL、任意方法和非仓库 API',async()=>{
  let called=false;
  await withProxy(async()=>{called=true;return new Response('{}',{status:200});},async(base)=>{
    const cross=await fetch(base+'/api/github/repos/octocat/Hello-World',{
      headers:{Origin:'https://evil.example'}});
    assert.equal(cross.status,403);
    const bad=await fetch(base+'/api/github/https:%2F%2Fevil.example/');
    assert.equal(bad.status,400);
    const put=await fetch(base+'/api/github/repos/octocat/Hello-World',{
      method:'PUT',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
    assert.equal(put.status,405);
  });
  assert.equal(called,false);
});
test('代理把上游 DNS 网络失败反馈为结构化错误（不泄漏令牌）',async()=>{
  await withProxy(async()=>{const e=new TypeError('fetch failed');e.cause={code:'EAI_AGAIN'};throw e;},async(base)=>{
    const r=await fetch(base+'/api/github/repos/octocat/Hello-World',{
      headers:{Origin:base,Authorization:'Bearer confidentialtoken'}});
    assert.equal(r.status,502);
    const json=await r.json();
    assert.equal(json.code,'GITHUB_UNREACHABLE');
    assert.equal(json.detail,'EAI_AGAIN');
    assert.equal(JSON.stringify(json).includes('confidentialtoken'),false);
  });
});
