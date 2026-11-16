import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsView,SETTINGS_TABS} from '../src/ui/views/settings.js';
import {DEFAULT_APPEARANCE} from '../src/appearance/settings.js';
import {readStyle} from './support/styles.js';
import {readFileSync} from 'node:fs';

const state={appearance:DEFAULT_APPEARANCE,entries:[],drafts:[],backups:[],github:{},aboutDiagnostics:null};
test('设置按外观、排版、数据、关于分类，每个偏好仅有一个入口',()=>{
  assert.deepEqual(SETTINGS_TABS.map(([key])=>key),['appearance','reading','data','about']);
  const panels=Object.fromEntries(SETTINGS_TABS.map(([key])=>[key,settingsView({...state,settingsTab:key})]));
  const keys=Object.values(panels).flatMap(html=>[...html.matchAll(/data-setting="([^"]+)"/g)].map(m=>m[1]));
  assert.equal(keys.length,new Set(keys).size);
  for(const key of ['sidebarTone','sidebarGlass','sidebarBlur','glassTint','texture','motionMode','spectralDrape','floating'])
    assert.ok(panels.appearance.includes(`data-setting="${key}"`),key+'归入外观');
  for(const key of ['fontFamily','bodyFontSize','lineHeight','contentWidth'])
    assert.ok(panels.reading.includes(`data-setting="${key}"`),key+'归入排版');
  assert.doesNotMatch(panels.appearance,/data-tab="interaction"|settings-effect-tag|settings-material-preview/);
  assert.doesNotMatch(panels.data,/secure-new|>NEW</);
  assert.equal((panels.appearance.match(/class="settings-toggle-row"/g)||[]).length,3);
});

test('开关下的强度控件统一禁用，旧设置类和标签卡片规则已删除',()=>{
  const html=settingsView({...state,appearance:{...DEFAULT_APPEARANCE,spectralDrape:false,floating:false}});
  assert.match(html,/id="setting-drapeIntensity"[^>]*disabled/);
  assert.match(html,/id="setting-floatingIntensity"[^>]*disabled/);
  const css=readStyle('settings');
  assert.doesNotMatch(css,/\.setting-(?:inline|value|controls|range|switch)\b|\.settings-drape-|\.settings-effect-tag\b/);
  assert.doesNotMatch(css,/\.settings-tab(?:[ .:{]|\[)|\.settings-hub-head h1/,'标签与标题只复用全站组件');
  assert.match(css,/\.settings-effect-controls\{[^}]*display:grid/);
  assert.match(css,/\.settings-hub \.settings-group\{background:transparent!important/,'夜间分组也保持平面，不继承旧卡片背景');
  assert.match(readStyle('pages'),/\.page-head\.page-titlebar\{[^}]*flex-wrap:wrap!important/,'窄屏标题与操作换行由页面标题组件负责');
  assert.doesNotMatch(readStyle('tokens'),/--settings-preview-image/);
  assert.doesNotMatch(readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),/--settings-preview-image|case 'remove-background'|case 'remove-hero'/);
});

test('设置标题和标签处于滚动区外，导入导出卡片使用完整的统一布局',()=>{
  const html=settingsView(state),css=readStyle('settings');
  assert.match(html,/<div class="settings-heading">[\s\S]*?<nav class="settings-hub-tabs vigil-tabs"[\s\S]*?<\/nav>\s*<\/div>\s*<section class="settings-hub-panel"/);
  assert.match(css,/\.settings-hub\{[^}]*height:var\(--settings-height/);
  assert.match(css,/\.settings-hub-panel\{[^}]*overflow:auto/);
  assert.match(css,/\.data-action-card\{[^}]*display:flex;[^}]*padding:22px/);
  assert.doesNotMatch(css,/\.data-action-card\{[^}]*border:0!important;[^}]*border-radius:0!important/);
});
