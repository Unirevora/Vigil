import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {editorialMonthLabel} from '../src/core/format.js';
import {APP_VERSION,RELEASE_NAME} from '../src/core/diagnostics.js';
import {entriesCards} from '../src/ui/views/entry-cards.js';
import {entriesView} from '../src/ui/views/entries.js';
import {readerView} from '../src/ui/views/reader.js';
import {almanacView} from '../src/ui/views/almanac.js';
import {editorView} from '../src/ui/views/editor.js';
import {aboutPanel} from '../src/ui/views/about.js';
import {captureMotionRect,animatePaperUnfold} from '../src/ui/motion.js';
import {readStyles,readStyle} from './support/styles.js';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('v1.7.7「墨笺」：版本号、发布名、更新日志与各处文档全面一致',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'1.7.7');
  assert.equal(APP_VERSION,'1.7.7');
  assert.equal(RELEASE_NAME,'墨笺');
  assert.match(pkg.description,/v1\.7\.7/);
  assert.match(read('index.html'),/class="sidebar-version">v1\.7\.7</);
  assert.match(read('README.md'),/^# 不眠手记 · VIGIL Inkpress 1\.7\.7/m);
  assert.match(read('CHANGELOG.md'),/^## v1\.7\.7 · 墨笺/m);
  assert.match(read('docs/ARCHITECTURE.md'),/版本 1\.7\.7/);
  assert.match(read('docs/PRODUCT.md'),/1\.7\.7/);
  assert.match(read('docs/USER-GUIDE.md'),/适用版本：1\.7\.7/);
  const about=aboutPanel({entries:[],drafts:[],backups:[],aboutDiagnostics:null});
  assert.match(about,/版本 1\.7\.7 · 墨笺/);
  assert.match(about,/器透纸温/);
});

test('v1.7.7：编年四时月令标题纯函数',()=>{
  assert.equal(editorialMonthLabel('2026-11'),'2026 年 11 月 · 孟冬');
  assert.equal(editorialMonthLabel('2026-02'),'2026 年 2 月 · 孟春');
  assert.equal(editorialMonthLabel('2026-06'),'2026 年 6 月 · 仲夏');
  assert.equal(editorialMonthLabel('2026-09'),'2026 年 9 月 · 仲秋');
  assert.equal(editorialMonthLabel('invalid'),'invalid');
});

test('v1.7.7：编年目录分卷眉、卷首跨列导读，且所有卡片预览统一使用正文字体',()=>{
  const notes=[
    {id:'n1',title:'深秋长卷',date:'2026-11-16',content:'这是一篇较长的手记正文。'.repeat(10),tags:['随笔'],mood:'思考',favorite:true},
    {id:'n2',title:'短句',date:'2026-11-03',content:'檐前落叶三两片，煮茶听风。',tags:[],mood:'平静',favorite:false},
    {id:'n3',title:'十月札记',date:'2026-10-20',content:'秋深露重。',tags:[],mood:'',favorite:false}
  ];
  const compact=entriesCards(notes);
  assert.doesNotMatch(compact,/editorial-month-divider|note-card-lead|note-card-aphorism/);
  assert.match(compact,/note-words/);

  const editorial=entriesCards(notes,'',{editorial:true});
  assert.match(editorial,/class="editorial-month-divider"[^>]*aria-label="2026 年 11 月 · 孟冬"/);
  assert.match(editorial,/2026 年 10 月 · 季秋/);
  assert.match(editorial,/2 篇/);
  assert.match(editorial,/note-card note-card-lead/);
  assert.match(editorial,/卷首/);
  assert.match(editorial,/data-entry-card="n1"/);
  assert.doesNotMatch(editorial,/note-card-aphorism/);

  const entriesCss=readStyle('entries');
  assert.match(entriesCss,/\.note-link p\{font:400 13\.5px\/1\.82 var\(--font-body\)!important/);
  assert.doesNotMatch(entriesCss,/note-card-aphorism/);

  const page=entriesView({entries:notes,drafts:[],github:{connected:false,config:null},entriesSource:'local',filters:{},query:'',order:'desc'});
  assert.match(page,/editorial-note-grid/);
  assert.equal((page.match(/<h1\b/g)||[]).length,1,'编年横眉不额外占用 h1');
});

test('v1.7.7：「器透而纸温」材质反差——哑光棉纸与光学玻璃分工',()=>{
  const tokens=readStyle('tokens');
  const surfaces=readStyle('surfaces');
  for(const token of ['--paper-matte-bg:','--paper-sheet-edge:','--paper-stack-sheet:','--paper-sheet-shadow:'])
    assert.ok(tokens.includes(token),token);
  assert.match(surfaces,/\.main-inner :is\(\.reading-paper,\.editor-paper\)\{[^}]*border-color:var\(--paper-sheet-edge\)!important;box-shadow:var\(--paper-sheet-shadow\)!important;[^}]*backdrop-filter:none!important/);
  assert.match(surfaces,/\.main-inner :is\(\.reading-paper,\.editor-paper\)::before\{[^}]*background:var\(--paper-matte-bg\)!important/);
  assert.match(surfaces,/\.main-inner \.season-verse\{[^}]*background-color:var\(--paper-matte-bg\)!important;border-color:var\(--paper-sheet-edge\)!important;box-shadow:var\(--paper-sheet-shadow\)!important/);
});

test('v1.7.7：散文书页式阅读界面（统一版心天头、文学书摘引文）与东方竖排锚点',()=>{
  const almanac=almanacView({almanacDate:'2026-11-15',almanacPreview:false},{embedded:true});
  assert.match(almanac,/class="season-vertical-slip" id="almanac-vertical-slip"/);
  assert.match(read('src/ui/almanac-controller.js'),/almanac-vertical-slip/);

  const ed=editorView({
    draft:{title:'札记',date:'2026-11-15',content:'# 标题',tags:[],mood:''},
    editorMode:'live',editorOutlineOpen:false,zenMode:false,editorOrigin:'local',github:{}
  });
  assert.match(ed,/handle-vertical-label[^>]*>大纲</);
  assert.match(ed,/handle-vertical-label[^>]*>专注</);
  assert.match(readStyle('editor'),/\.refined-editor \.handle-vertical-label\{writing-mode:vertical-rl/);
  assert.match(readStyle('editor'),/\.refined-editor \.editor-outline-head-actions \.handle-vertical-label\{display:none\}/);

  const rd=readerView({
    readerSource:'local',selectedId:'n1',
    entries:[{id:'n1',title:'秋夜',date:'2026-11-15',content:'> 一句书摘\n\n正文段落。',tags:['随笔'],mood:'平静'}]
  });
  assert.match(rd,/<header class="reading-header">[\s\S]*?<h1 class="reading-title">秋夜<\/h1>[\s\S]*?<\/header>\s*<div class="article-content">/);
  assert.doesNotMatch(rd,/reading-ornament|❖/);

  const readerCss=readStyle('reader');
  assert.match(readerCss,/\.reading-header\{[^}]*max-width:var\(--reading-measure\);margin:0 auto/);
  assert.match(readerCss,/\.reading-header::after\{[^}]*background:var\(--appearance-accent\)/);
  assert.match(readerCss,/\.reading-paper \.article-content\{max-width:var\(--reading-measure\);margin:0 auto!important;[^}]*text-autospace:normal;hanging-punctuation:first allow-end;line-break:strict/);
  assert.match(readerCss,/\.reading-paper \.reading-foot\{max-width:var\(--reading-measure\);margin:38px auto 0/);
  assert.match(readerCss,/\.article-content \.markdown-quote\{[^}]*background:transparent/);

  const css=readStyles();
  assert.match(css,/\.season-vertical-slip\{writing-mode:vertical-rl/);
  assert.match(css,/\.hou-index\{writing-mode:vertical-rl/);
});

test('v1.7.7：桌面顶栏去重、编辑器敲字退隐与同步展信转场安全回退',()=>{
  const shell=readStyle('shell');
  const editor=readStyle('editor');
  const main=read('src/main.js');
  assert.match(shell,/@media \(min-width:901px\)\{\s*html body \.topbar \.header-settings\{display:none!important\}/);
  assert.match(editor,/\.refined-editor\.is-typing :is\(\.editor-topline,\.editor-properties,\.unified-toolbar,\.editor-outline-handles,\.editor-foot\)\{opacity:\.44\}/);
  assert.match(main,/function enterTypingQuietude\(\)/);
  assert.match(main,/function exitTypingQuietude\(\)/);
  assert.match(main,/animatePaperUnfold\(/);

  assert.equal(captureMotionRect(null),null);
  assert.equal(animatePaperUnfold(null,null),null);
});
