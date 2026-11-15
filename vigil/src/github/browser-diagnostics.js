/** Browser-only anonymous connectivity probe, unlike Node diagnostics CLI.
 * Never reads local tokens, repository settings, cookies or private paths.
 */
export const PUBLIC_BROWSER_PROBES=Object.freeze([
  {label:'本地网络探测',path:'api/github/diagnose',kind:'diagnose'},
  {label:'仓库主通道',path:'api/github/repos/octocat/Hello-World',kind:'metadata'},
  {label:'仓库备用通道',path:'api/vigil-bridge/repos/octocat/Hello-World',kind:'metadata'},
  {label:'浏览器匿名直连',path:'https://api.github.com/repos/octocat/Hello-World',kind:'metadata'}
]);

export async function checkGithubBrowserPaths(fetcher=globalThis.fetch,{origin=globalThis.location?.origin||'unknown',timeoutMs=11000}={}){
  const checks=await Promise.all(PUBLIC_BROWSER_PROBES.map(async probe=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetcher(probe.path,{
        method:'GET',headers:{Accept:'application/json'},
        // Same-origin probes: 'same-origin' (see api.js, Safari + self-signed TLS).
        credentials:/^https?:/.test(probe.path)?'omit':'same-origin',
        cache:'no-store',redirect:'error',signal:controller.signal
      });
      let data;
      try{data=await response.json();}catch{data=null;}
      const verified=probe.kind==='diagnose'?data?.bodyVerified===true:
        data?.full_name==='octocat/Hello-World';
      const relay=response.headers.get('X-Vigil-Github-Proxy')==='1';
      const ok=response.ok&&verified;
      return {label:probe.label,ok,relay,status:response.status,
        code:ok?'':String(data?.code||(data===null?'INVALID_JSON':'INVALID_RESPONSE')).slice(0,36)};
    }catch(error){
      return {label:probe.label,ok:false,relay:false,status:null,
        code:error?.name==='AbortError'?'TIMEOUT':
          String(error?.cause?.code||error?.code||error?.name||'NETWORK').slice(0,36)};
    }finally{clearTimeout(timer);}
  }));
  const lines=checks.map(item=>`${item.ok?'PASS':'FAIL'}  ${item.label} · ${item.status===null?item.code:`HTTP ${item.status} · ${item.relay?'RELAY':'OTHER'}${item.ok?'':` · ${item.code}`}`}`);
  return {origin,checks,text:`当前页面：${origin}\n${lines.join('\n')}\n仅使用公开示例；未发送 GitHub Token。`};
}
