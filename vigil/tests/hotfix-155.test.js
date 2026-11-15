import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DEFAULT_APPEARANCE,normalizeAppearance,sidebarPalette,readAppearance,writeAppearance}
  from '../src/appearance/settings.js';
import {spectralEnabled,drapeStrength} from '../src/effects/spectral-drape.js';
import {settingsView} from '../src/ui/views/settings.js';
import {aboutPanel} from '../src/ui/views/about.js';
import {readStyles,styleModules} from './support/styles.js';

const base={appearance:DEFAULT_APPEARANCE,entries:[],drafts:[],backups:[],github:{cryptoKey:null}};

test('v1.5.6 保留原手记 Schema 与外观存储键',()=>{
  const packageJson=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  // package.json is the single version source; the sidebar must show the same version.
  assert.match(packageJson.version,/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),
    new RegExp(`class="sidebar-version">v${packageJson.version.replace(/\./g,'\\.')}<`));
  assert.equal(DEFAULT_APPEARANCE.spectralDrape,false);
  const map=new Map();const storage={getItem:key=>map.get(key)||null,setItem:(key,val)=>map.set(key,String(val))};
  const prefs=writeAppearance(storage,readAppearance(storage),{spectralDrape:true,drapeIntensity:62});
  assert.deepEqual(readAppearance(storage),prefs);
  assert.equal(map.has('vigil-mvp-data-v1'),false);
});
test('夜间侧栏是中性石墨色，与日间松绿或任意主题色不同',()=>{
  const green=sidebarPalette('#375d4f','accent',true);
  const plum=sidebarPalette('#795269','ink',true);
  assert.equal(green.top,plum.top);
  assert.equal(green.bottom,plum.bottom);
  assert.notEqual(green.active,plum.active);
  const day=sidebarPalette('#375d4f','ink',false);
  assert.notEqual(green.top,day.top);
});
test('点阵帷幕开关、强度的非法数据被规范化且默认关闭',()=>{
  assert.equal(spectralEnabled(DEFAULT_APPEARANCE),false);
  assert.equal(spectralEnabled({spectralDrape:true}),true);
  assert.equal(spectralEnabled({spectralDrape:'true'}),false);
  assert.equal(drapeStrength(DEFAULT_APPEARANCE),48);
  assert.equal(drapeStrength({drapeIntensity:10000}),85);
  assert.equal(drapeStrength({drapeIntensity:-5}),15);
  const a=normalizeAppearance({spectralDrape:true,drapeIntensity:10000});
  assert.equal(a.spectralDrape,true);
  assert.equal(a.drapeIntensity,85);
  assert.equal(normalizeAppearance({spectralDrape:'yes'}).spectralDrape,false);
});
test('设置页可开关点阵帷幕并调整强度，夜间仍沿用相同设置项',()=>{
  const html=settingsView(base);
  assert.match(html,/data-setting="spectralDrape"/);
  assert.match(html,/data-setting="drapeIntensity"/);
  assert.match(html,/点阵帷幕/);
  assert.match(settingsView({...base,appearance:{...DEFAULT_APPEARANCE,spectralDrape:true}}),/spectralDrapeToggle[^>]+checked/);
});
test('Logo 同时拥有主标识、浏览器图标和关于页呈现',()=>{
  for(const file of ['assets/vigil-mark.svg','assets/vigil-favicon.svg','src/styles/tokens.css'])
    assert.equal(existsSync(new URL('../'+file,import.meta.url)),true);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/vigil-favicon.svg/);
  assert.match(html,/vigil-mark.svg/);
  assert.match(html,/id="spectralDrape"/);
  assert.match(aboutPanel({...base,aboutDiagnostics:null}),/vigil-mark.svg/);
});
test('点阵帷幕是本地 Canvas 实现，不依赖 React Bits Pro 注册表',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  const deps={...pkg.dependencies,...pkg.devDependencies};
  assert.equal(Object.keys(deps).some(name=>name.includes('reactbits-starter')),false);
  const source=readFileSync(new URL('../src/effects/spectral-drape.js',import.meta.url),'utf8');
  const css=readStyles();
  assert.match(source,/getContext\('2d'/);
  assert.match(source,/prefers-reduced-motion/);
  assert.match(source,/visibilitychange/);
  assert.match(source,/1000\/30/);
  assert.match(css,/\.spectral-drape\.is-active/);
});
