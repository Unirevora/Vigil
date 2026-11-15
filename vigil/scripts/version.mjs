#!/usr/bin/env node
/** One command to change the app version everywhere.
 *
 *   node scripts/version.mjs                  show the version and check every place agrees
 *   node scripts/version.mjs 1.7.4            set 1.7.4 everywhere (keeps the release name)
 *   node scripts/version.mjs 1.7.4 墨痕        set version and release name (shown on the About page)
 *   node scripts/version.mjs patch|minor|major [名称]   bump from the current version
 *   node scripts/version.mjs --check          exit 1 if any place disagrees (used by deploy)
 *
 * package.json is the single source of truth. Synced copies:
 *   package.json  "version" and the "v…" in "description"
 *   index.html    <span class="sidebar-version">v…</span>
 *   src/core/diagnostics.js   APP_VERSION and RELEASE_NAME
 *   README.md     the "# 不眠手记 · VIGIL Inkpress …" title
 *   CHANGELOG.md  a "## v… · 名称" section is added at the top if it doesn't exist yet
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const read=f=>readFileSync(resolve(root,f),'utf8');
const write=(f,s)=>writeFileSync(resolve(root,f),s,'utf8');
const SEMVER=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// Each place: how to read its version, and how to write a new one.
const PLACES=[
  {file:'package.json',label:'package.json version',
    get:s=>JSON.parse(s).version,
    set:(s,v)=>s.replace(/("version"\s*:\s*")[^"]+(")/,`$1${v}$2`)},
  {file:'package.json',label:'package.json description',
    get:s=>(JSON.parse(s).description||'').match(/v(\d+\.\d+\.\d+[^\s：:]*)/)?.[1],
    set:(s,v)=>s.replace(/("description"\s*:\s*"[^"]*?)v\d+\.\d+\.\d+[^\s：:"]*/,`$1v${v}`)},
  {file:'index.html',label:'侧栏版本 index.html',
    get:s=>s.match(/class="sidebar-version">v([^<]+)</)?.[1],
    set:(s,v)=>s.replace(/(class="sidebar-version">v)[^<]+(<)/,`$1${v}$2`)},
  {file:'src/core/diagnostics.js',label:'APP_VERSION（关于页 / 诊断）',
    get:s=>s.match(/export const APP_VERSION='([^']+)'/)?.[1],
    set:(s,v)=>s.replace(/(export const APP_VERSION=')[^']+(')/,`$1${v}$2`)},
  {file:'README.md',label:'README 标题',
    get:s=>s.match(/^# 不眠手记 · VIGIL Inkpress (\S+)/m)?.[1],
    set:(s,v)=>s.replace(/^(# 不眠手记 · VIGIL Inkpress )\S+/m,`$1${v}`)}
];

const current=()=>JSON.parse(read('package.json')).version;
const releaseName=()=>read('src/core/diagnostics.js').match(/export const RELEASE_NAME='([^']*)'/)?.[1]||'';

function status(){
  const want=current();
  const rows=PLACES.map(p=>({...p,found:p.get(read(p.file))}));
  const hasLog=new RegExp(`^## v${want.replace(/\./g,'\\.')}\\b`,'m').test(read('CHANGELOG.md'));
  return {want,rows,hasLog,ok:rows.every(r=>r.found===want)};
}
function report({want,rows,hasLog}){
  console.log(`当前版本 ${want}（发布名「${releaseName()||'—'}」）`);
  for(const r of rows)console.log(`  ${r.found===want?'✔':'✖'} ${r.label.padEnd(26)} ${r.found??'（未找到）'}`);
  console.log(`  ${hasLog?'✔':'·'} CHANGELOG.md 中的 v${want} 段落${hasLog?'':'（尚未添加）'}`);
}
function bump(v,kind){
  const [maj,min,pat]=v.split('-')[0].split('.').map(Number);
  return kind==='major'?`${maj+1}.0.0`:kind==='minor'?`${maj}.${min+1}.0`:`${maj}.${min}.${pat+1}`;
}

const args=process.argv.slice(2);
if(!args.length||args[0]==='--check'){
  const s=status();report(s);
  if(!s.ok){console.error('\n版本号不一致：运行 node scripts/version.mjs <版本号> 统一更新。');process.exit(1);}
  process.exit(0);
}

let [target,name]=args;
if(['patch','minor','major'].includes(target))target=bump(current(),target);
if(!SEMVER.test(target)){console.error(`版本号格式应为 1.2.3，收到：${target}`);process.exit(1);}

// Write every place (files may hold several places, so re-read each time).
for(const p of PLACES){
  const before=read(p.file),after=p.set(before,target);
  if(p.get(after)!==target){console.error(`无法在 ${p.file} 中写入版本号（${p.label}），请检查格式。`);process.exit(1);}
  write(p.file,after);
}
if(name!==undefined){
  const d=read('src/core/diagnostics.js');
  write('src/core/diagnostics.js',d.replace(/(export const RELEASE_NAME=')[^']*(')/,`$1${name.replace(/'/g,'’')}$2`));
}
// CHANGELOG: add a section stub for a new version.
const log=read('CHANGELOG.md');
if(!new RegExp(`^## v${target.replace(/\./g,'\\.')}\\b`,'m').test(log)){
  const title=`## v${target} · ${name||releaseName()||'未命名'}`;
  const stub=`${title}\n\n- （在这里写下本版本的更新）\n\n---\n\n`;
  const at=log.search(/^## /m);
  write('CHANGELOG.md',at<0?`${log.trimEnd()}\n\n${stub}`:log.slice(0,at)+stub+log.slice(at));
  console.log(`已在 CHANGELOG.md 顶部添加「${title}」，记得补写更新内容。`);
}
const s=status();report(s);
console.log(s.ok?`\n✔ 已全部更新为 ${target}`:'\n✖ 仍有不一致，请检查上面标 ✖ 的位置');
process.exit(s.ok?0:1);
