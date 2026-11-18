import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {editorialMonthLabel,excerpt,todayISO} from '../src/core/format.js';
import {tasksFromEntries,reviewMetrics} from '../src/insights/insights.js';
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

test('当前版本、发布名、更新日志与各处文档一致',()=>{
  const pkg=JSON.parse(read('package.json'));
  const version=pkg.version.replaceAll('.','\\.');
  assert.equal(APP_VERSION,pkg.version);
  assert.match(RELEASE_NAME,/^\p{Script=Han}{2}$/u);
  assert.match(pkg.description,new RegExp(`v${version}`));
  assert.match(read('index.html'),new RegExp(`class="sidebar-version">v${version}<`));
  assert.match(read('README.md'),new RegExp(`^# 不眠手记 · VIGIL Inkpress ${version}$`,'m'));
  assert.match(read('CHANGELOG.md'),/^## v1\.7\.7 · 墨笺/m);
  assert.match(read('CHANGELOG.md'),new RegExp(`^## v${version} · ${RELEASE_NAME}$`,'m'));
  assert.ok(read('docs/ARCHITECTURE.md').includes(`版本 ${pkg.version}`));
  assert.ok(read('docs/PRODUCT.md').includes(pkg.version));
  assert.ok(read('docs/USER-GUIDE.md').includes(`适用版本 ${pkg.version}`));
  const about=aboutPanel({entries:[],drafts:[],backups:[],aboutDiagnostics:null});
  assert.ok(about.includes(`版本 ${pkg.version} · ${RELEASE_NAME}`));
});

test('v1.7.7：编年四时月令标题纯函数与卡片摘要语法清洗',()=>{
  assert.equal(editorialMonthLabel('2026-11'),'2026 年 11 月 · 孟冬');
  assert.equal(editorialMonthLabel('2026-02'),'2026 年 2 月 · 孟春');
  assert.equal(editorialMonthLabel('2026-06'),'2026 年 6 月 · 仲夏');
  assert.equal(editorialMonthLabel('2026-09'),'2026 年 9 月 · 仲秋');
  assert.equal(editorialMonthLabel('invalid'),'invalid');

  const rich=[
    '> [!tip]+ 写作提醒',
    '访问 [我的主页](https://example.com/long/path) 与 [[旧手记|去年秋夜]]。',
    '<span class="font-kai" style="font-family: KaiTi">楷体句子</span>',
    '- [x] 已办妥的事',
    '~~~js\nconst secret = 42;\n~~~',
    '$$\nE = mc^2\n$$'
  ].join('\n\n');
  const cleaned=excerpt(rich,120);
  assert.doesNotMatch(cleaned,/https:\/\/|!tip|<span|font-kai|const secret|E = mc|- x /);
  assert.match(cleaned,/写作提醒/);
  assert.match(cleaned,/我的主页/);
  assert.match(cleaned,/去年秋夜/);
  assert.match(cleaned,/楷体句子/);
  assert.match(cleaned,/已办妥的事/);
  assert.equal(excerpt('```\ncode\n```'),'留白，也是一天的注脚。');
});

test('v1.7.7：本地凌晨时段（00:00–07:59）统计与待办逾期按本地日期计算而非 UTC',()=>{
  const earlyLocal=new Date(2026,10,18,1,30,0); // Local 2026-11-18 01:30
  const localDay=todayISO(earlyLocal);
  assert.equal(localDay,'2026-11-18');
  const entries=[
    {id:'a',title:'凌晨手记',date:'2026-11-18',content:'- [ ] 昨日待办 📅 2026-11-17\n- [ ] 今日待办 📅 2026-11-18',tags:[]},
    {id:'b',title:'昨日手记',date:'2026-11-17',content:'记录',tags:[]}
  ];
  const metrics=reviewMetrics(entries,earlyLocal);
  assert.equal(metrics.week,2,'本地凌晨写下的当日手记计入近七日');
  assert.equal(metrics.streak,2,'连续写作日包含今天与昨天');
  const tasks=tasksFromEntries(entries,earlyLocal);
  assert.equal(tasks.find(t=>t.due==='2026-11-17').overdue,true,'昨日截止事项在本地凌晨即标为逾期');
  assert.equal(tasks.find(t=>t.due==='2026-11-18').overdue,false,'今日截止事项未逾期');
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

  const entriesCss=readStyle('entries');
  assert.match(entriesCss,/\.note-link p\{font:400 13\.5px\/1\.82 var\(--font-body\)!important/);
  assert.doesNotMatch(entriesCss,/note-card-aphorism|#f7edda/);

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

test('v1.7.7：散文书页阅读界面、实时/阅读共用引用竖线、日历空白格无框与双列竖排节气签',()=>{
  const almanac=almanacView({almanacDate:'2026-11-15',almanacPreview:false},{embedded:true});
  assert.match(almanac,/id="almanac-slip-season"[^>]*>冬令<\/span><span id="almanac-slip-hou"/);
  assert.match(read('src/ui/almanac-controller.js'),/almanac-slip-hou/);

  const ed=editorView({
    draft:{title:'札记',date:'2026-11-15',content:'# 标题',tags:[],mood:''},
    editorMode:'live',editorOutlineOpen:false,zenMode:false,editorOrigin:'local',github:{}
  });
  assert.match(ed,/handle-vertical-label[^>]*>大纲</);
  assert.match(ed,/handle-vertical-label[^>]*>专注</);
  const editorCss=readStyle('editor');
  assert.match(editorCss,/\.refined-editor \.handle-vertical-label\{writing-mode:vertical-rl/);
  assert.match(editorCss,/\.refined-editor \.editor-outline-head-actions \.handle-vertical-label\{display:none\}/);
  assert.match(editorCss,/@media \(max-width:680px\)\{[\s\S]*?\.refined-editor \.editor-outline-handles \.handle-vertical-label\{display:none\}/,'窄屏书耳收紧为纯图标，不遮挡下方工具栏');

  const rd=readerView({
    readerSource:'local',selectedId:'n1',
    entries:[{id:'n1',title:'秋夜',date:'2026-11-15',content:'> 一句书摘\n\n正文段落。',tags:['随笔'],mood:'平静'}]
  });
  assert.match(rd,/<header class="reading-header">[\s\S]*?<h1 class="reading-title">秋夜<\/h1>[\s\S]*?<\/header>\s*<div class="article-content">/);

  const readerCss=readStyle('reader');
  assert.match(readerCss,/\.reading-header\{[^}]*max-width:var\(--reading-measure\);margin:0 auto/);
  assert.match(readerCss,/\.markdown-quote,\.article-content \.markdown-quote\{[^}]*border-left:2px solid/);
  assert.match(readStyle('chronicle'),/\.day\.blank\{background:transparent!important;border-color:transparent!important/);
  assert.doesNotMatch(readStyle('home'),/#e7ddd0/);
});

test('v1.7.7：草稿回退原稿自动清理、桌面顶栏去重、编辑器敲字退隐与展信转场安全回退',()=>{
  const shell=readStyle('shell');
  const editor=readStyle('editor');
  const main=read('src/main.js');
  assert.match(main,/if\(signature===state\.originalDraft\)\{[\s\S]*?drafts\.remove\(draftKey\(\)\)/);
  assert.match(shell,/@media \(min-width:901px\)\{\s*html body \.topbar \.header-settings\{display:none!important\}/);
  assert.match(editor,/\.refined-editor\.is-typing :is\(\.editor-topline,\.editor-properties,\.unified-toolbar,\.editor-outline-handles,\.editor-foot\)\{opacity:\.44\}/);
  assert.match(main,/function enterTypingQuietude\(\)/);
  assert.match(main,/function exitTypingQuietude\(\)/);
  assert.match(main,/animatePaperUnfold\(/);

  assert.equal(captureMotionRect(null),null);
  assert.equal(animatePaperUnfold(null,null),null);
});
