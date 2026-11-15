import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_APPEARANCE,normalizeAppearance,sidebarPalette,writeAppearance,readAppearance} from '../src/appearance/settings.js';
import {settingsView} from '../src/ui/views/settings.js';

const base={appearance:{...DEFAULT_APPEARANCE},entries:[],drafts:[],backups:[],github:{cryptoKey:null}};
const style=readFileSync(new URL('../src/styles/vigil-153.css',import.meta.url),'utf8');

test('v1.5.3 为外观、排版、交互和数据提供轻量四页签',()=>{
  const markup=settingsView(base);
  for(const tab of ['appearance','reading','interaction','data']){
    assert.ok(markup.includes(`data-tab="${tab}"`),tab);
  }
  assert.ok(markup.includes('role="tablist"'));
  assert.ok(!markup.includes('settings-tab"><span>'));
  assert.ok(!markup.includes('appearance-section settings-hub-surface'));
  const reading=settingsView({...base,settingsTab:'reading'});
  assert.ok(reading.includes('id="fontFamilySelect"'));
  assert.ok(reading.includes('data-setting="bodyFontSize"'));
  const interaction=settingsView({...base,settingsTab:'interaction'});
  for(const key of ['sidebarTone','sidebarGlass','sidebarBlur','glassTint','motionMode']){
    assert.ok(interaction.includes(`data-setting="${key}"`));
  }
  const data=settingsView({...base,settingsTab:'data'});
  assert.ok(data.includes('data-action="export-encrypted"'));
});

test('主题色驱动侧栏色阶，朱砂、黛蓝、梅紫不会都显示墨绿',()=>{
  const a=sidebarPalette('#a83f2a');
  const b=sidebarPalette('#49687c');
  const c=sidebarPalette('#795269');
  assert.notEqual(a.top,b.top);
  assert.notEqual(b.top,c.top);
  assert.notEqual(a.bottom,c.bottom);
  assert.notEqual(a.active,b.active);
  assert.ok(a.top.startsWith('#'));
});

test('经典墨绿模式不会抹掉用户已经选中的主题色',()=>{
  assert.equal(sidebarPalette('#a83f2a','ink').top,sidebarPalette('#49687c','ink').top);
  assert.equal(sidebarPalette('#795269','accent',true).top===sidebarPalette('#795269','accent',false).top,false);
  assert.notEqual(sidebarPalette('invalid','accent').top,'invalid');
});

test('毛玻璃设置归一化，防止持久化异常数值及注入',()=>{
  const a=normalizeAppearance({sidebarGlass:-20,sidebarBlur:900,glassTint:Infinity,sidebarTone:'<script>',motionMode:'trick'});
  assert.equal(a.sidebarGlass,55);
  assert.equal(a.sidebarBlur,36);
  assert.equal(a.glassTint,DEFAULT_APPEARANCE.glassTint);
  assert.equal(a.sidebarTone,'accent');
  assert.equal(a.motionMode,'standard');
  const b=normalizeAppearance({sidebarGlass:91,sidebarBlur:10,glassTint:44,sidebarTone:'ink',motionMode:'off'});
  assert.equal(b.sidebarGlass,91);
  assert.equal(b.motionMode,'off');
});

test('新增的用户偏好可跨会话读写，但绝不覆盖手记存储',()=>{
  const data=new Map();
  const fake={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))};
  const next=writeAppearance(fake,readAppearance(fake),{accent:'#49687c',sidebarGlass:88,sidebarTone:'accent',motionMode:'subtle'});
  assert.deepEqual(next,readAppearance(fake));
  assert.equal(data.has('vigil-mvp-data-v1'),false);
});

test('统一样式支持毛玻璃导航、真实 blur、主题变化与阅读实色',()=>{
  assert.match(style,/backdrop-filter:blur\(var\(--sidebar-glass-blur\)\)/);
  assert.match(style,/var\(--sidebar-glass-top\)/);
  assert.match(style,/--glass-material/);
  assert.match(style,/prefers-reduced-transparency/);
  assert.match(style,/\.settings-hub-tabs \.settings-tab\.active/);
  assert.match(style,/\.vigil-select-popup/);
});
