import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pageHeading} from '../src/ui/views/page-heading.js';
import {entriesView} from '../src/ui/views/entries.js';
import {chronicleView} from '../src/ui/views/chronicle.js';
import {githubView} from '../src/ui/views/github.js';
import {insightsView} from '../src/ui/views/insights.js';
import {settingsView} from '../src/ui/views/settings.js';
import {DEFAULT_APPEARANCE} from '../src/appearance/settings.js';
import {filterEntries,hasOpenTasks} from '../src/core/entries.js';

const note=(id,date,content='',tags=[])=>({id,title:`手记${id}`,date,content,tags,favorite:id==='1',createdAt:`${date}T01:00:00Z`,updatedAt:`${date}T02:00:00Z`});
const entries=[
  note('1','2026-11-14','今天看书\n- [ ] 复盘', ['读书']),
  note('2','2026-11-09','完成计划\n- [x] 已完成'),
  note('3','2026-11-15','```md\n- [ ] 这只是示例\n```'),
  note('4','2026-10-27','等周末'),
];
const state={
  entries,drafts:[],backups:[],query:'',order:'desc',filters:{},calendarMonth:'2026-11',calendarSelected:'2026-11-15',
  almanacDate:'2026-11-15',seasonTab:'calendar',settingsTab:'appearance',appearance:DEFAULT_APPEARANCE,
  github:{connected:false,config:null,hasToken:false,error:'',files:[],note:null},aboutDiagnostics:null
};

test('标题共用组件支持计数、可访问操作区，并对外来字符转义',()=>{
  const html=pageHeading({title:'<标题>',description:'与 & 安全相关',count:12,actions:'<button>操作</button>'});
  assert.match(html,/<h1 class="page-title">&lt;标题&gt;/);
  assert.match(html,/id="pageTitleCount"/);
  assert.match(html,/aria-label="12 篇手记"/);
  assert.match(html,/与 &amp; 安全相关/);
  assert.match(html,/page-title-actions/);
});
test('五个功能页面共用同一主标题层级，主页编辑阅读保留独立语义',()=>{
  for(const html of [entriesView(state),chronicleView(state),githubView(state),insightsView(state),settingsView(state)]){
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert.match(html,/class="page-head page-titlebar/);
    assert.match(html,/class="page-title"/);
  }
});
test('顶栏不重复输出页面名称，样式载入在最终位置',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/id="pageBreadcrumb"/);
  assert.match(html,/src\/styles\/vigil-155\.css/);
  assert.ok(html.indexOf('vigil-154.css') < html.indexOf('vigil-155.css'));
  const css=readFileSync(new URL('../src/styles/vigil-155.css',import.meta.url),'utf8');
  assert.match(css,/--v155-title-size/);
});
test('未完成事项筛选避开代码围栏，并区分已完成与未完成',()=>{
  assert.equal(hasOpenTasks(entries[0].content),true);
  assert.equal(hasOpenTasks(entries[1].content),false);
  assert.equal(hasOpenTasks(entries[2].content),false);
  assert.equal(hasOpenTasks('~~~\n- [ ] not a task\n~~~'),false);
  assert.equal(hasOpenTasks('1. [ ] 数字列表任务'),true);
  assert.deepEqual(filterEntries(entries,'','desc',{pending:true}).map(e=>e.id),['1']);
});
test('最近七天窗口含当天及前六天，不包含未来和第八天',()=>{
  assert.deepEqual(filterEntries(entries,'','desc',{recent:true},'2026-11-15').map(e=>e.id),['3','1','2']);
  assert.deepEqual(filterEntries([...entries,note('5','2026-11-16')],'','desc',{recent:true},'2026-11-15').map(e=>e.id),['3','1','2']);
  assert.deepEqual(filterEntries(entries,'','desc',{recent:true,pending:true},'2026-11-15').map(e=>e.id),['1']);
});
test('列表提供最近七天、未完成任务、清除筛选和仅导出结果的入口',()=>{
  const html=entriesView({...state,filters:{pending:true}});
  for(const action of ['filter-recent','filter-pending','reset-list-filters','export-filtered']){
    assert.match(html,new RegExp(`data-action="${action}"`));
  }
  assert.match(html,/aria-pressed="true" data-action="filter-pending"/);
  assert.doesNotMatch(html,/\[object Object\]/);
});
