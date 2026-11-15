import test from 'node:test';
import assert from 'node:assert/strict';
import {chronicleView} from '../src/ui/views/chronicle.js';
import {calendarView} from '../src/ui/views/calendar.js';
import {almanacView} from '../src/ui/views/almanac.js';
import {settingsView} from '../src/ui/views/settings.js';
import {DEFAULT_APPEARANCE} from '../src/appearance/settings.js';
import {collectDiagnostics,formatDiagnostics,APP_VERSION} from '../src/core/diagnostics.js';

function fakeState(overrides={}){
  return {
    entries:[],drafts:[],backups:[],calendarMonth:'2026-11',calendarSelected:'2026-11-15',
    almanacDate:'2026-11-15',seasonTab:'calendar',almanacPreview:false,
    settingsTab:'appearance',appearance:DEFAULT_APPEARANCE,github:{connected:false},
    aboutDiagnostics:null,storageError:'',corruptStorage:false,katexAvailable:true,
    ...overrides
  };
}

test('v1.5.4: 日历与节气共用一个页面及两个键盘友好的页签',()=>{
  const html=chronicleView(fakeState());
  assert.match(html,/日历与风物/);
  assert.match(html,/role="tablist"/);
  assert.match(html,/id="chronicle-tab-calendar"/);
  assert.match(html,/aria-selected="true"/);
  assert.match(html,/id="chronicle-tab-almanac"/);
  assert.match(html,/archive-layout/);
  assert.doesNotMatch(html,/id="seasonDial"/);
  assert.match(html,/2026-11-15/);
});
test('v1.5.4: 节气页签嵌入轮盘但不重复页面标题，选日连续',()=>{
  const html=chronicleView(fakeState({seasonTab:'almanac',almanacDate:'2026-11-22'}));
  assert.match(html,/id="seasonDial"/);
  assert.match(html,/aria-labelledby="chronicle-tab-almanac"/);
  assert.match(html,/2026-11-22/);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.match(html,/小雪/);
});
test('v1.5.4: 独立的旧日历/风物渲染仍可调用，支持嵌入',()=>{
  const originalCalendar=calendarView(fakeState());
  const embeddedCalendar=calendarView(fakeState(),{embedded:true});
  assert.match(originalCalendar,/日历与归档/);
  assert.doesNotMatch(embeddedCalendar,/<h1>/);
  assert.doesNotMatch(almanacView(fakeState(),{embedded:true}),/<h1>/);
});
test('v1.5.4: 设置中心新增关于页签，与外观、排版、交互和数据并列',()=>{
  const html=settingsView(fakeState({settingsTab:'about'}));
  assert.equal((html.match(/role="tab"/g)||[]).length,5);
  assert.match(html,/role="tabpanel" aria-labelledby="settings-tab-about"/);
  assert.match(html,/本地环境检查/);
  assert.match(html,/你的文字，归你所有/);
});
test('v1.5.4: 本地诊断只输出状态与计数，绝不包含正文和密钥',()=>{
  const cache=new Map();
  const env={isSecureContext:true,crypto:{subtle:{}},indexedDB:{},CodeMirror(){},localStorage:{
    getItem:key=>cache.get(key)||null,
    setItem:(key,value)=>cache.set(key,String(value)),
    removeItem:key=>cache.delete(key)
  }};
  const state=fakeState({
    entries:[{title:'私人手记含敏感内容',content:'PRIVATE-SECRET-PAYLOAD'}],
    github:{connected:true,cryptoKey:'SENSITIVE-KEY',hasToken:true,config:{owner:'PRIVATE-OWNER'}}
  });
  const data=collectDiagnostics(state,env);
  assert.equal(APP_VERSION,'1.5.5');
  assert.equal(data.localStorage,true);
  assert.equal(data.secureContext,true);
  assert.equal(data.entries,1);
  assert.equal(data.githubConnected,true);
  assert.equal(cache.size,0);
  const report=formatDiagnostics(data);
  for(const secret of ['PRIVATE-SECRET-PAYLOAD','PRIVATE-OWNER','SENSITIVE-KEY','私人手记含敏感内容']){
    assert.equal(report.includes(secret),false);
  }
  assert.match(report,/不包含正文、仓库地址、口令、密钥或访问令牌/);
});
test('v1.5.4: 存储异常自动标记不可用，数据报告不会伪称可写',()=>{
  const env={isSecureContext:false,localStorage:{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}}};
  const data=collectDiagnostics(fakeState({corruptStorage:true}),env);
  assert.equal(data.localStorage,false);
  assert.equal(data.secureContext,false);
  assert.equal(data.storageProtected,true);
  assert.match(formatDiagnostics(data),/文库可写：不可用/);
});
