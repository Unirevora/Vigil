import {handleGithubProxy} from './github-proxy.mjs';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const port=Number(process.env.PORT||5173);
const contentTypes={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.md':'text/plain; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon',
  '.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2'
};
createServer(async(req,res)=>{
  try{
    if(await handleGithubProxy(req,res))return;
    const pathname=decodeURIComponent(new URL(req.url||'/',`http://localhost:${port}`).pathname);
    const file=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
    if(file!==root && !file.startsWith(root+sep)){
      res.writeHead(403).end('Forbidden');return;
    }
    if(!(await stat(file)).isFile()){res.writeHead(404).end('Not Found');return;}
    const bytes=await readFile(file);
    res.writeHead(200,{
      'Content-Type':contentTypes[extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    }).end(bytes);
  }catch{
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not Found');
  }
}).listen(port,'127.0.0.1',()=>{
  console.log(`Vigil MVP: http://127.0.0.1:${port}/`);
  console.log('GitHub local relay: /api/github/health (local only), /api/github/diagnose (real upstream)');
  console.log('Proxy can be configured in GitHub -> 本地网络与代理 (HTTP/SOCKS5).');
  console.log('Press Ctrl+C to stop.');
});
