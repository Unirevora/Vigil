import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatBlockLine,formatBlockSelection,formatInlineSelection,formatInlineRange,formatTemplateSelection,INLINE_WRAPS,INSERT_TEMPLATES}
  from '../src/editor/formatting.js';
import {editorView} from '../src/ui/views/editor.js';
import {settingsView} from '../src/ui/views/settings.js';
import {DEFAULT_APPEARANCE} from '../src/appearance/settings.js';
import {readStyles,styleModules} from './support/styles.js';

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
  assert.equal(formatBlockLine('  - [x] 完成','task'),'  完成');
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

test('重复行内格式移除选区外的标记，保留正文、选区和其他格式',()=>{
  const cases=[['bold','**云起**',2,4],['italic','_云起_',1,3],
    ['strike','~~云起~~',2,4],['code','`云起`',1,3],
    ['inlineMath','$云起$',1,3],['link','[云起](https://example.com)',1,3]];
  for(const [kind,source,from,to] of cases){
    const result=formatInlineRange(source,from,to,kind);
    assert.equal(source.slice(0,result.from)+result.text+source.slice(result.to),'云起',kind);
    assert.equal(result.selectionFrom,0);assert.equal(result.selectionTo,2);
  }
  const cursor=formatInlineRange('前 **云起** 后',5,5,'bold');
  assert.equal(cursor.text,'云起');assert.equal(cursor.selectionFrom,cursor.selectionTo);
  assert.equal(formatInlineSelection('**云**','italic').text,'***云***','斜体操作不得剥掉粗体的一半');
  assert.equal(formatInlineRange('前 云 后',2,3,'bold').text,'**云**');
  const nested=formatInlineRange('***云***',1,6,'italic');
  assert.equal(nested.text,'**云**','重复斜体保留里面的加粗');
});

test('列表按样式识别取消，混合选区统一应用，重复代码块和公式块不嵌套',()=>{
  assert.equal(formatBlockLine('* 云','list'),'云');
  assert.equal(formatBlockLine('8) 云','orderedList'),'云');
  assert.deepEqual(formatBlockSelection(['- 云','雨'],'list'),['- 云','- 雨']);
  assert.deepEqual(formatBlockSelection(['3. 云','4. 雨'],'orderedList'),['云','雨']);
  for(const kind of ['codeBlock','blockMath']){
    const first=formatTemplateSelection('云起',kind);
    assert.equal(formatTemplateSelection(first,kind),'云起',kind);
  }
});

test('文章大纲是编辑器外的独立面板，带关闭按钮',()=>{
  const html=editorView({...sample,editorOutlineOpen:true});
  assert.doesNotMatch(html,/editor-outline-scrim/);
  assert.ok(html.indexOf('editor-outline-sidebar')<html.indexOf('class="editor-paper'),'outline sits beside the paper');
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
  const css=readStyles();
  assert.match(html,/assets\/vigil\.css/);
  assert.ok(styleModules().includes('/src/styles/editor.css'));
  assert.match(css,/@media ?\(max-width:680px\)/);
  assert.match(css,/reading-paper/);
  assert.match(css,/glass-dock\{display:none!important\}/);
});
