import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {editorView} from '../src/ui/views/editor.js';
import {chronicleView} from '../src/ui/views/chronicle.js';
import {settingsView} from '../src/ui/views/settings.js';
import {entriesView} from '../src/ui/views/entries.js';
import {DEFAULT_APPEARANCE} from '../src/appearance/settings.js';
import {APP_VERSION} from '../src/core/diagnostics.js';
import {readStyles,styleModules} from './support/styles.js';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const base={
  entries:[],drafts:[],backups:[],calendarMonth:'2026-11',calendarSelected:'2026-11-15',
  almanacDate:'2026-11-15',seasonTab:'calendar',almanacPreview:false,settingsTab:'appearance',
  appearance:DEFAULT_APPEARANCE,github:{connected:false,config:null},aboutDiagnostics:null,
  storageError:'',corruptStorage:false,katexAvailable:true,entriesSource:'local',filters:{},query:'',
  editingId:null,draft:{title:'新手记',date:'2026-11-15',content:'# 主标题\n\n## 小节',tags:[],mood:''},
  editorMode:'live',editorOutlineOpen:false,zenMode:false,draftStatus:'已暂存'
};

test('v1.7.1: 全部手记、日历风物、设置共用同一套 vigil-tabs 标签，并保留键盘导航所需的旧类名',()=>{
  const pages=[
    [entriesView(base),'notebook-switch','notebook-tab'],
    [chronicleView(base),'chronicle-tabs','chronicle-tab'],
    [settingsView(base),'settings-hub-tabs','settings-tab']
  ];
  for(const [html,bar,tab] of pages){
    assert.match(html,new RegExp(`class="${bar} vigil-tabs"[^>]*role="tablist"`));
    assert.match(html,new RegExp(`class="${tab} vigil-tab `));
    assert.match(html,/role="tab"/);
  }
});

test('v1.7.1: 标签无背景高亮，只有更粗的圆角主题色下划线，并在 @layer 中压过旧 !important',()=>{
  const css=readStyles();
  assert.match(css,/@layer overrides\{/);
  assert.match(css,/--vigil-tab-bar:4px/);
  const active=css.match(/\.vigil-tabs \.vigil-tab\.active\{([^}]*)\}/);
  assert.ok(active,'active tab rule exists');
  assert.match(active[1],/background:transparent!important/);
  assert.match(css,/\.vigil-tab::after\{[^}]*height:var\(--vigil-tab-bar\)!important;border-radius:999px!important;[^}]*background:var\(--appearance-accent\)!important/);
  assert.ok(styleModules().includes('/src/styles/tabs.css'));
});

test('v1.7.1: 毛玻璃覆盖卡片、面板、菜单、对话框、阅读与写作稿纸',()=>{
  const css=readStyles();
  // Every selector of every rule that applies the frosted-glass blur.
  const plain=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const frosted=[...plain.matchAll(/([^{}]+)\{[^{}]*backdrop-filter:var\(--glass-panel-blur\)!important/g)].map(m=>m[1]).join(',');
  for(const surface of ['.note-card','.filter-panel','.vintage-panel','.insight-panel','.settings-hub-panel','.unified-toolbar','.editor-outline-sidebar','.modal','.pagination-card'])
    assert.ok(frosted.includes(surface),`${surface} is frosted`);
  // Papers are frosted through a ::before underlay, never on the element itself
  // (backdrop-filter would capture the position:fixed outline drawer).
  assert.match(frosted,/:is\(\.reading-paper,\.editor-paper\)::before/);
  assert.match(plain,/:is\(\.reading-paper,\.editor-paper\)\{[^}]*backdrop-filter:none!important/);
  assert.match(css,/prefers-reduced-transparency:reduce/);
});

test('专注按钮在大纲按钮下方；日期与标签留在稿纸内；GitHub 文件提示移到写作窗口外',()=>{
  const html=editorView(base);
  assert.doesNotMatch(html,/editor-props-row|editor-pane-tools|editor-props-dock/);
  const paper=html.slice(html.indexOf('class="editor-paper'),html.indexOf('</article>'));
  assert.ok(paper.includes('class="editor-properties"'),'date & tags stay inside the paper');
  assert.ok(paper.indexOf('editor-properties')<paper.indexOf('unified-toolbar'),'under the title, above the toolbar');
  const handles=html.slice(html.indexOf('editor-outline-handles'),html.indexOf('editor-outline-sticky'));
  assert.ok(handles.indexOf('editor-zen-button')>handles.indexOf('editor-outline-toggle'),'focus button sits under the outline button');
  const remote=editorView({...base,editorOrigin:'github',github:{...base.github,note:{path:'notes/a.md'},config:{owner:'o',repo:'r'}}});
  const remotePaper=remote.slice(remote.indexOf('class="editor-paper'),remote.indexOf('</article>'));
  assert.ok(!remotePaper.includes('github-editor-filename-hint'),'hint is outside the paper');
  assert.match(remote,/class="editor-hint-dock"[^]*github-editor-filename-hint/);
  assert.doesNotMatch(html,/unified-pane-label|editorModeStatus/);
  assert.doesNotMatch(read('src/main.js'),/editorModeStatus/);
});

test('v1.7.1: 大纲与稿纸同排，收起为右缘小标签，展开为纵向窗口并以过渡略挤正文；收起时内容不可聚焦',()=>{
  const closed=editorView(base),open=editorView({...base,editorOutlineOpen:true});
  assert.match(closed,/class="editor-outline-sticky" inert>/);
  assert.match(closed,/id="editorOutlineSidebar" aria-label="文章大纲">/);
  assert.match(open,/editor-outline-sidebar is-open" id="editorOutlineSidebar" aria-label="文章大纲">/);
  assert.match(open,/class="editor-outline-sticky"/);
  const css=readStyles();
  assert.match(css,/\.refined-editor\.outline-open \.editor-stage\{grid-template-columns:minmax\(0,1fr\) var\(--outline-width\)/);
  assert.match(css,/transition:grid-template-columns \.52s/);
  assert.doesNotMatch(css,/editor-outline-scrim|data-outline-open|editor-manuscript-layout\{display:grid/);
  assert.match(read('src/main.js'),/toggleAttribute\('inert',!state\.editorOutlineOpen\)/);
});

test('v1.7.1: package.json、侧栏、关于页与诊断使用同一版本号',()=>{
  const {version}=JSON.parse(read('package.json'));
  assert.equal(APP_VERSION,version);
  assert.match(read('index.html'),new RegExp(`class="sidebar-version">v${version.replace(/\./g,'\\.')}<`));
  assert.match(read('CHANGELOG.md'),new RegExp(`^## v${version.replace(/\./g,'\\.')} `,'m'));
});

test('编辑器固定在视口内：标题与工具栏不动，只有正文滚动；大纲与稿纸等高',()=>{
  const css=readStyles(),main=read('src/main.js');
  assert.match(css,/\.composer-page\.refined-editor\{[^}]*height:var\(--editor-height/);
  assert.match(css,/\.refined-editor \.unified-reader\{flex:1 1 0;min-height:0;[^}]*overflow:auto/);
  assert.match(css,/\.refined-editor \.unified-edit-host \.CodeMirror\{height:100%\}/);
  assert.doesNotMatch(css,/min-height:510px|CodeMirror-scroll\{[^}]*max-height:\d+vh/);
  assert.match(main,/function fitEditorFrame/);
  assert.doesNotMatch(read('src/editor/unified-editor.js'),/minHeight=510/);
  assert.match(css,/\.refined-editor \.editor-outline-sidebar\.is-open\{[^}]*height:100%/);
});
