import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BackupRepository,BACKUP_KEY} from '../src/storage/backups.js';
import {storageFootprint,formatFootprint} from '../src/storage/footprint.js';
import {githubProxyEnvironment,githubTransportFetch} from '../scripts/github-transport.mjs';
import {buildCSS} from '../scripts/build-css.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const entry={id:'one',date:'2026-11-15',title:'私密札记',content:'# 今晚',createdAt:'2026-11-15T00:00:00.000Z',updatedAt:'2026-11-15T00:00:00.000Z'};
const store=()=>{
 const m=new Map();return {
  get length(){return m.size;},key(index){return [...m.keys()][index]??null;},
  getItem(key){return m.get(key)??null;},setItem(key,val){m.set(key,String(val));},
  removeItem(key){m.delete(key);}
 };
};
test('1.5.6：24 层样式来源合并为一次运行时请求，并保留覆盖顺序',async()=>{
 const manifest=JSON.parse(read('scripts/style-order.json'));
 const html=read('index.html');
 assert.equal((html.match(/rel="stylesheet"/g)||[]).length,1);
 assert.match(html,/href="\/assets\/vigil\.css"/);
 assert.equal(manifest.styles.at(-1),'/src/styles/vigil-156.css');
 assert.ok(manifest.styles.indexOf('/src/styles/vigil-155-repair.css')<manifest.styles.indexOf('/src/styles/vigil-156.css'));
 const result=await buildCSS();
 assert.equal(result.styles,manifest.styles.length);
 assert.equal(read('assets/vigil.css').includes('background:rgba(47,51,58,.97)!important;'),true);
 assert.match(read('assets/vigil.css'),/vigil-156\.css/);
});
test('1.5.6：暗色对比规则显式覆盖统计、回顾、顶栏，不能只覆盖文字',()=>{
 const css=read('src/styles/vigil-156.css');
 assert.match(css,/\.insight-metric strong/);
 assert.match(css,/\.reflection-panel blockquote/);
 assert.match(css,/\.insight-metric\{[\s\S]*?background:/);
 assert.match(css,/\.topbar::before/);
 assert.match(css,/background:none!important/);
});
test('1.5.6：连续相同内容只保留一份快照，不重写安全备份',()=>{
 const db=store(),repo=new BackupRepository(db);
 const a=repo.create([entry]);
 const raw=db.getItem(BACKUP_KEY);
 const b=repo.create([entry]);
 assert.equal(a.id,b.id);
 assert.equal(repo.list().length,1);
 assert.equal(db.getItem(BACKUP_KEY),raw);
 repo.create([{...entry,content:'# 改动'}]);
 assert.equal(repo.list().length,2);
 assert.equal(repo.get(a.id).entries[0].content,'# 今晚');
});
test('1.5.6：旧备份持久化格式和读取行为不变',()=>{
 const db=store(),repo=new BackupRepository(db);
 const legacy={schemaVersion:1,backups:[{id:'past',reason:'manual',label:'旧备份',createdAt:'2026-11-15T00:00:00.000Z',entries:[entry]}]};
 db.setItem(BACKUP_KEY,JSON.stringify(legacy));
 assert.equal(repo.list()[0].entries[0].title,'私密札记');
 const copy=repo.create([entry]);
 assert.equal(copy.id,'past');
});
test('1.5.6：只报告 Vigil 的存储占用，不读取其它应用内容',()=>{
 const db=store();db.setItem('unrelated-secret','hidden');db.setItem('vigil-mvp-data-v1','abc');db.setItem('vigil-mvp-backups-v1','123');
 const {available,bytes,count}=storageFootprint(db);
 assert.equal(available,true);assert.equal(count,2);
 assert.equal(bytes,2*('vigil-mvp-data-v1'.length+3+'vigil-mvp-backups-v1'.length+3));
 assert.match(formatFootprint(bytes),/ B$/);
 assert.equal(storageFootprint({}).available,false);
});
test('1.5.6：GitHub API 代理明确支持环境代理并尊重 NO_PROXY',()=>{
 const cfg=githubProxyEnvironment({HTTPS_PROXY:'http://alice:secret@proxy.example.com:8080'});
 assert.equal(cfg.enabled,true);
 assert.equal(cfg.url.hostname,'proxy.example.com');
 assert.equal(githubProxyEnvironment({HTTPS_PROXY:'http://proxy.example:8080',NO_PROXY:'api.github.com'}).enabled,false);
 assert.equal(githubProxyEnvironment({HTTPS_PROXY:'http://proxy.example:8080',NO_PROXY:'.github.com'}).enabled,false);
 assert.equal(githubProxyEnvironment({HTTPS_PROXY:'socks5://proxy.example'}).enabled,false);
});
test('1.5.6：代理只允许固定 GitHub HTTPS 主机',async()=>{
 await assert.rejects(githubTransportFetch('https://example.com/user'),/only https/);
 await assert.rejects(githubTransportFetch('http://api.github.com/user'),/only https/);
});
test('1.5.6：代理不可用时返回明确的 CONNECT 状态，不直连第三方',async()=>{
  const {createServer}=await import('node:http');
  const {once}=await import('node:events');
  const proxy=createServer();
  let target='';
  proxy.on('connect',(req,socket)=>{
    target=req.url;
    socket.end('HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 0\r\n\r\n');
  });
  proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
  try{
    await assert.rejects(githubTransportFetch('https://api.github.com/repos/octocat/Hello-World',
      {method:'GET'}, {HTTPS_PROXY:`http://127.0.0.1:${proxy.address().port}`} ),
      error=>error.code==='PROXY_CONNECT_407');
    assert.equal(target,'api.github.com:443');
  }finally{await new Promise(resolve=>proxy.close(resolve));}
});
