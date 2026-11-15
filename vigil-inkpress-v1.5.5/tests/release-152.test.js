import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatBlockLine,formatBlockSelection,formatInlineSelection,INLINE_WRAPS,INSERT_TEMPLATES}
  from '../src/editor/formatting.js';
import {editorView} from '../src/ui/views/editor.js';
import {settingsView} from '../src/ui/views/settings.js';
import {DEFAULT_APPEARANCE} from '../src/appearance/settings.js';

const sample={
  editingId:null,draft:{title:'新手记',date:'2026-11-15',content:'# 主标题\n\n一些正文',tags:[],mood:''},
  editorMode:'live',editorOutlineOpen:false,zenMode:false,draftStatus:'已暂存',
};

test('v1.5.2 的通用标题/列表菜单包含可执行的不同层级与序号',()=>{
  const html=editorView(sample);
  assert.match(html,/data-menu="heading"/);
  assert.match(html,/data-menu="list"/);
  assert.match(html,/data-menu="insert"/);
  for(const kind of ['heading1','heading','heading3','heading4','heading5','heading6',
    'list','orderedList','task','codeBlock','blockMath','table','rule']){
    assert.ok(html.includes(`data-format="${kind}"`),kind);
  }
});

test('标题重复点击能够还原正文，且不会吞掉文字',()=>{
  assert.equal(formatBlockLine('风起时','heading1'),'# 风起时');
  assert.equal(formatBlockLine('# 风起时','heading1'),'风起时');
  assert.equal(formatBlockLine('## 小节','heading3'),'### 小节');
  assert.equal(formatBlockLine('  > 引述','quote'),'  引述');
});

test('列表保留缩进，编号连续，空行不被误转为待办',()=>{
  assert.deepEqual(formatBlockSelection(['一','', '二'],'orderedList'),['1. 一','', '2. 二']);
  assert.equal(formatBlockLine('  - [x] 完成','task'),'  - [ ] 完成');
  assert.equal(formatBlockLine('','task',{emptyPlaceholder:true}),'- [ ] 待办事项');
  assert.equal(formatBlockLine('  一','list'),'  - 一');
});

test('行内格式不污染原文，选中的包装格式可切换',()=>{
  const bold=formatInlineSelection('云','bold');
  assert.equal(bold.text,'**云**');
  assert.equal(formatInlineSelection('**云**','bold').text,'云');
  assert.equal(formatInlineSelection('字','inlineMath').text,'$字$');
  assert.ok(INLINE_WRAPS.link);
  assert.ok(INSERT_TEMPLATES.codeBlock.includes('```text'));
});

test('文章大纲是右侧侧栏，拥有移动端遮罩与关闭按钮',()=>{
  const html=editorView({...sample,editorOutlineOpen:true});
  assert.match(html,/data-outline-open="true"/);
  assert.match(html,/editor-outline-scrim/);
  assert.match(html,/editor-outline-sidebar is-open/);
  assert.match(html,/data-action="close-outline-sidebar"/);
});

test('数据管理与外观成为同一设置页面的两个选项卡',()=>{
  const base={...sample,appearance:{...DEFAULT_APPEARANCE},entries:[],drafts:[],backups:[],github:{cryptoKey:null}};
  const html=settingsView(base);
  assert.match(html,/role="tablist"/);
  assert.match(html,/data-tab="appearance"/);
  assert.match(html,/data-tab="data"/);
  const dataHtml=settingsView({...base,settingsTab:'data'});
  assert.match(dataHtml,/data-action="export-encrypted"/);
  assert.match(dataHtml,/本地备份/);
});

test('响应式细修样式在入口页面最后加载',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/styles/polish-152.css',import.meta.url),'utf8');
  assert.match(html,/src\/styles\/polish-152\.css/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/editor-outline-scrim/);
  assert.match(css,/reading-paper/);
  assert.match(css,/glass-dock\{display:none!important\}/);
});
