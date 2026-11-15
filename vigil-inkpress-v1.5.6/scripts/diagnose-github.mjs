/**
 * Safe, read-only localhost diagnostic for the exact endpoints the browser uses.
 * Usage: run `npm run dev` in another terminal, then `npm run diagnose:github`.
 * Never asks for, reads, saves, or prints any GitHub PAT or private repo URL.
 */
const port=Number(process.env.VIGIL_PORT||process.env.PORT||5173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid localhost port');
const base=`http://127.0.0.1:${port}`;
const scenarios=[
  {label:'本地服务',path:'/api/github/health'},
  {label:'当前代理',path:'/api/github/proxy'},
  {label:'GitHub 完整 JSON 网络探测',path:'/api/github/diagnose'},
  {label:'公开仓库信息',path:'/api/github/repos/octocat/Hello-World'},
  {label:'公开仓库目录',path:'/api/github/repos/octocat/Hello-World/contents'},
  {label:'备用匿名同源通道',path:'/api/vigil-bridge/repos/octocat/Hello-World'}
];
let failures=0;
for(const step of scenarios){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),21000);
  try{
    const response=await fetch(base+step.path,{
      method:'GET',headers:{Accept:'application/json'},signal:controller.signal,cache:'no-store'
    });
    const relay=response.headers.get('X-Vigil-Github-Proxy')==='1';
    const contentType=response.headers.get('Content-Type')||'';
    let data={};
    if(contentType.includes('application/json')){
      try{data=await response.json();}catch{data={code:'INVALID_LOCAL_JSON'};}
    }else{data={code:'NOT_JSON'};}
    const code=data.code||'';
    let extra='';
    if(step.path.endsWith('/health'))extra=`localOnly=${Boolean(data.localOnly)}`;
    else if(step.path.endsWith('/proxy'))extra=`mode=${data.effective?.mode||'?'},source=${data.effective?.source||'?'},endpoint=${data.effective?.endpoint||'none'}`;
    else if(step.path.endsWith('/diagnose'))extra=`bodyVerified=${Boolean(data.bodyVerified)},upstreamHTTP=${data.upstreamStatus||'?'}${data.detail?', detail='+data.detail:''}`;
    else if(step.path.endsWith('/contents'))extra=`items=${Array.isArray(data)?data.length:'?'}`;
    else extra=`name=${data.full_name||'?'}${data.detail?', detail='+data.detail:''}`;
    if(code)extra+=`, code=${code}`;
    const ok=response.ok&&relay&&(step.path.endsWith('/diagnose')?data.bodyVerified===true:!code);
    console.log(`${ok?'PASS':'FAIL'}  ${step.label} · HTTP ${response.status} · relay=${relay} · ${extra}`);
    if(!ok)failures++;
  }catch(error){
    failures++;
    console.log(`FAIL  ${step.label} · ${String(error?.cause?.code||error?.code||error?.name||'NETWORK').slice(0,36)} · localhost request failed`);
  }finally{clearTimeout(timer);}
}
if(failures){
  console.log(`\n诊断发现 ${failures} 项失败：以上结果不包含 Token。可以复制输出用于排查。`);
  process.exitCode=1;
}else{
  console.log('\n本地代理与公开仓库完整读取均成功。这 6 项均来自 Node。若网页仍失败，请在 GitHub 页面点「浏览器链路检查」，对照同源与备用地址。');
}
