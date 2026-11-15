import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {homeView} from '../src/ui/views/home.js';
import {createDemoEntries} from '../src/data/demo.js';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=(f)=>readFileSync(resolve(project,f),'utf8');

test('参考图首页仅把插画用作图片，导航/统计/按钮仍是实时 DOM',()=>{
  const state={entries:createDemoEntries(),drafts:[]};
  const html=homeView(state);
  assert.match(html,/class="hero-scene"/);
  assert.match(html,/typewriter-still-life\.webp/);
  assert.match(html,/data-action="new"/);
  assert.match(html,/data-to="almanac"/);
  assert.match(html,/data-to="entries"/);
  assert.match(html,/data-action="read"/);
  assert.match(html,/把日子写成/);
  assert.match(html,/已存文字/);
  assert.match(html,/把晚风写进今天/);
  assert.doesNotMatch(html,/<img[^>]+src="[^"]+\.png"[^>]+class="whole-page"/);
});
test('独立草稿卡片仍可回到写作，且不会被静态图片覆盖',()=>{
  const state={entries:createDemoEntries(),drafts:[{
    key:'__new__',title:'真正的未完稿',content:'写给今天',date:'2026-11-13',updatedAt:'2026-11-13T00:00:00Z'
  }]};
  const html=homeView(state);
  assert.match(html,/data-action="resume-draft"/);
  assert.match(html,/真正的未完稿/);
});
test('参考风格素材和独立样式文件均随项目交付',()=>{
  for(const name of ['typewriter-still-life.webp','paper-fibers.webp','motif-mountain.png',
    'motif-plum.png','motif-waves.png','motif-bamboo.png','bamboo-gold.svg']){
    assert.ok(statSync(resolve(project,'assets',name)).size>100,`${name} exists and is nonempty`);
  }
  const index=read('index.html');
  assert.match(index,/assets\/vigil\.css/);
  assert.match(read('scripts/style-order.json'),/src\/styles\/inkpress-reference\.css/);
  assert.match(index,/src\/main\.js/);
  const css=read('src/styles/inkpress-reference.css');
  assert.match(css,/\.heritage-hero/);
  assert.match(css,/\.hero-scene/);
  assert.match(css,/@media\(max-width:675px\)/);
});
