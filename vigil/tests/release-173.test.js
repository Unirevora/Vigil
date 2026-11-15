import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {readStyles,readStyle,styleModules} from './support/styles.js';
import {githubView} from '../src/ui/views/github.js';
import {aboutPanel} from '../src/ui/views/about.js';
import {APP_VERSION,RELEASE_NAME} from '../src/core/diagnostics.js';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('v1.7.3: 命令面板等对话框使用更厚的玻璃，浅色模式下不会被遮罩染灰',()=>{
  const css=readStyles();
  assert.match(css,/:root\{--glass-dialog-bg:color-mix\(in srgb,var\(--surface\) 92%,transparent\)\}/);
  for(const dialog of ['.modal-layer .modal','.command-dialog','.passphrase-dialog'])
    assert.ok(css.includes(`${dialog}{background-color:var(--glass-dialog-bg)!important`),dialog);
});

test('v1.7.3: 滚动条全部隐藏，焦点不再出现主题色方框，键盘焦点只留淡淡光晕',()=>{
  assert.equal(styleModules().at(-1),'/src/styles/focus.css','focus policy loads last');
  const css=readStyle('focus');
  assert.match(css,/@layer overrides\{/);
  assert.match(css,/\*\{scrollbar-width:none!important\}/);
  assert.match(css,/\*::-webkit-scrollbar\{display:none!important/);
  assert.match(css,/:focus,:focus-visible\{outline:none!important\}/);
  assert.match(css,/:is\(input,textarea,select,\[contenteditable\],\.CodeMirror textarea\):focus\{outline:none!important/);
  assert.match(css,/outline:2px solid color-mix\(in srgb,var\(--appearance-accent\) 26%,transparent\)!important/);
});

test('v1.7.3: 「本地手记 / GitHub 仓库」标签也支持方向键、Home、End',()=>{
  const main=read('src/main.js');
  assert.match(main,/\.notebook-tab\[role="tab"\]/);
  assert.match(main,/const tabs=\['local','github'\];/);
});

test('v1.7.3: 服务器锁定代理时不再显示代理表单与 Clash 按钮',()=>{
  const gh={connected:false,config:null,proxyLocked:true,proxySettings:{mode:'env'},files:[]};
  const locked=githubView({github:gh,drafts:[],entries:[]});
  assert.match(locked,/已固定为直连/);
  assert.doesNotMatch(locked,/github-proxy-clash|ghProxyHost/);
  const local=githubView({github:{...gh,proxyLocked:false},drafts:[],entries:[]});
  assert.match(local,/github-proxy-clash/);
  assert.match(read('src/main.js'),/gh\.proxyLocked=data\.locked===true/);
  assert.match(read('scripts/github-proxy.mjs'),/const USER_AGENT=`Vigil\/\$\{VERSION\}`/);
  assert.doesNotMatch(read('scripts/github-proxy.mjs'),/1\.5\.6/);
});

test('v1.7.3: 关于页显示当前版本名与亮点，文档链接为相对路径且文件存在',()=>{
  const {version}=JSON.parse(read('package.json'));
  assert.equal(APP_VERSION,version);
  const html=aboutPanel({entries:[],drafts:[],backups:[],aboutDiagnostics:null});
  assert.match(html,new RegExp(`版本 ${version.replace(/\./g,'\\.')} · ${RELEASE_NAME}`));
  assert.doesNotMatch(html,/同题同序|页面标题统一/);
  const links=[...html.matchAll(/href="([^"]+\.md)"/g)].map(m=>m[1]);
  assert.ok(links.length>=3);
  for(const link of links){
    assert.ok(!link.startsWith('/'),`${link} must be relative (sub-path deployment)`);
    assert.ok(existsSync(new URL('../'+link,import.meta.url)),link);
  }
});

test('v1.7.3: 文档按主题合并；不再有版本号命名的样式、文档、截图与测试脚本',()=>{
  const docs=readdirSync(new URL('../docs/',import.meta.url)).sort();
  assert.deepEqual(docs,['ARCHITECTURE.md','CHANGELOG-original.md','DEPLOY.md','GITHUB.md','PRODUCT.md','QA.md','USER-GUIDE.md']);
  const styles=readdirSync(new URL('../src/styles/',import.meta.url));
  assert.ok(styles.every(f=>!/\d{3}/.test(f)),styles.join(','));
  const css=readStyles();
  assert.doesNotMatch(css,/--v1[0-9]{2}-|\.settings-153|@layer vigil-/);
  const scripts=readdirSync(new URL('../scripts/',import.meta.url));
  assert.ok(scripts.every(f=>!/\d{3}/.test(f)),scripts.join(','));
  for(const file of ['README.md','src/ui/views/about.js'])
    for(const m of read(file).matchAll(/docs\/([\w.-]+\.md)/g))
      assert.ok(docs.includes(m[1]),`${file} links to docs/${m[1]}`);
});

test('v1.7.3: scripts/version.mjs 以 package.json 为准检查所有版本号，部署前强制校验',async()=>{
  const {spawnSync}=await import('node:child_process');
  const r=spawnSync(process.execPath,['scripts/version.mjs','--check'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.doesNotMatch(r.stdout,/✖/);
  assert.match(read('scripts/deploy.mjs'),/scripts\/version\.mjs','--check'/);
  assert.match(read('version.cmd'),/node scripts\\version\.mjs/);
});
