import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderMarkdown} from '../src/core/markdown.js';
import {sanitizeStyledTag,sanitizeTypographyStyle} from '../src/core/safe-html.js';
import {markdownQuoteAt,inlineSegments,markdownHeading} from '../src/editor/live-markdown.js';
import {githubDraftKey,githubDraftSnapshot,githubNoteTitle,githubEntriesScope} from '../src/github/notebook.js';
import {GithubClient,encodeGithubBase64,decodeGithubBase64} from '../src/github/api.js';
import {readStyles,styleModules} from './support/styles.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('v1.7.0: H1-H6 in reading & editing, H4 has distinct typography',()=>{
 for(let level=1;level<=6;level++){
  const text='#'.repeat(level)+' 段落标题';
  assert.match(renderMarkdown(text),new RegExp(`<h${level}>段落标题<\\/h${level}>`));
  assert.equal(markdownHeading(text).level,level);
 }
 const css=readStyles();
 assert.match(css,/\.article-content h4\{/);
 assert.match(css,/\.cm-live-heading\.cm-live-h4\{/);
 assert.match(css,/\.cm-live-heading\.cm-live-h5\{/);
 assert.match(css,/\.cm-live-heading\.cm-live-h6\{/);
});
test('v1.7.0: Obsidian callouts, custom titles, folding, nesting and normal quote',()=>{
 const tip=renderMarkdown('> [!tip]+ 写作提醒\n> **记得**整理材料。');
 assert.match(tip,/<details class="vigil-callout/);
 assert.match(tip,/data-callout="tip" open/);
 assert.match(tip,/写作提醒/);
 assert.match(tip,/<strong>记得<\/strong>/);
 const closed=renderMarkdown('> [!question]- 收起\n> 答案');
 assert.match(closed,/<details class="vigil-callout/);
 assert.doesNotMatch(closed,/data-callout="question" open/);
 const nested=renderMarkdown('> [!question] 外层\n> > [!note] 内层\n> > 本文');
 assert.equal((nested.match(/class="vigil-callout /g)||[]).length,2);
 const quote=renderMarkdown('> 普通引用\n> 第二行');
 assert.match(quote,/<blockquote class="markdown-quote">/);
 assert.doesNotMatch(quote,/\[!note\]/);
 // Obsidian/CommonMark lazy continuation: a non-blank text line continues the quote.
 assert.equal(markdownQuoteAt(['> [!tip] 提示','> 内容','下一行'],0).end,2);
 assert.equal(markdownQuoteAt(['> [!tip] 提示','> 内容','','下一行'],0).end,1);
 assert.equal(markdownQuoteAt(['> [!tip] 提示','> 内容','# 标题'],0).end,1);
 assert.match(renderMarkdown('> 引用\n懒续行\n\n后文'),/<p>引用 懒续行<\/p><\/blockquote><p>后文<\/p>/);
 assert.match(renderMarkdown('> [!todo] 事项\n> 内容'),/callout-todo/);
});
test('v1.7.0: typography HTML styles render through allowlist and retain classes',()=>{
 const md=renderMarkdown('<span class="font-kai" style="font-family: KaiTi; font-size: 20px">以字会友</span>');
 assert.match(md,/class="font-kai"/);
 assert.match(md,/font-family: KaiTi/);
 assert.match(md,/font-size: 20px/);
 const block=renderMarkdown('<div class="font-song" style="text-align: center">纸上有山川</div>');
 assert.match(block,/<div class="font-song" style="text-align: center">纸上有山川<\/div>/);
 const live=inlineSegments('<span style="font-family: KaiTi">一字一句</span>');
 assert.equal(live[0].type,'styled');
 assert.equal(live[0].css,'font-family: KaiTi');
});
test('v1.7.0: HTML XSS is escaped; CSS style and attrs never execute',()=>{
 const malicious=renderMarkdown('<script>alert(1)</script>\n\n<span onclick="alert(1)" style="background:url(javascript:alert(1));color:#aabbcc">文字</span>');
 assert.doesNotMatch(malicious,/<script>/i);
 assert.doesNotMatch(malicious,/onclick=/i);
 assert.doesNotMatch(malicious,/background:/i);
 assert.match(malicious,/<span style="color: #aabbcc">文字<\/span>/);
 assert.equal(sanitizeStyledTag('<iframe src="https://evil">'),null);
 assert.equal(sanitizeStyledTag('<span onmouseover="alert(1)">'),'<span>');
 assert.equal(sanitizeTypographyStyle('font-family: url(https://bad); color: #c2a'), 'color: #c2a');
 assert.match(renderMarkdown('<img src=x onerror=alert(1)>'),/&lt;img/);
});
test('v1.7.0: GitHub notebook keys are namespaced by branch/repo/path',()=>{
 const conf={owner:'someone',repo:'letters',branch:'main',folder:'notes'};
 const key=githubDraftKey(conf,'notes/今日.md');
 assert.match(key,/^github:[a-f0-9]{32}$/);
 assert.notEqual(key,githubDraftKey({...conf,branch:'other'},'notes/今日.md'));
 assert.notEqual(key,githubDraftKey({...conf,repo:'other'},'notes/今日.md'));
 assert.equal(githubNoteTitle('notes/今天下午.markdown'),'今天下午');
 assert.equal(githubDraftSnapshot({path:'notes/a.md',content:'# 文字'}).content,'# 文字');
 assert.deepEqual(githubEntriesScope(conf,'notes/day'),{root:'notes',current:'notes/day',canGoBack:true});
 assert.throws(()=>githubEntriesScope(conf,'secret'),/范围/);
});
test('v1.7.0: remote source is separate from local entries, editor uses shared layout',()=>{
 const entries=read('src/ui/views/entries.js');
 const reader=read('src/ui/views/reader.js');
 const editor=read('src/ui/views/editor.js');
 const main=read('src/main.js');
 assert.match(entries,/role="tablist"/);
 assert.match(entries,/github-note-card/);
 assert.match(reader,/state.readerSource==='github'/);
 assert.match(editor,/state.editorOrigin==='github'/);
 assert.match(main,/async function saveGithubEntry\(\)/);
 assert.match(main,/gitClient\.saveNote\(\{path:note.path,content:savedContent,sha:note.sha/);
 assert.match(main,/state.entriesSource='github';state.readerSource='github';state.view='entries'/);
 assert.doesNotMatch(read('index.html'),/PRIVATE JOURNAL · 001/);
 const {version}=JSON.parse(read('package.json'));
 assert.match(read('index.html'),new RegExp(`sidebar-version">v${version.replace(/\./g,'\\.')}<`));
});
test('v1.7.0: GitHub SHA preserved, no anonymous remote write, git-crypt blocks plaintext',async()=>{
 let saved;
 const api=new GithubClient(async(url,options)=>{
  if(url.includes('.gitattributes')){
   return {ok:true,status:200,json:async()=>({type:'file',encoding:'base64',content:encodeGithubBase64('*.md filter=git-crypt diff=git-crypt'),sha:'att'})};
  }
  saved={url,options};
  return {ok:true,status:200,json:async()=>({content:{sha:'nextsha'}})};
 });
 api.setConfig({owner:'someone',repo:'notes',folder:''});
 await assert.rejects(()=>api.saveNote({path:'a.md',content:'# 你好',sha:'base'}),/令牌/);
 api.setToken('temporary');
 await assert.rejects(()=>api.saveNote({path:'a.md',content:'# 你好',sha:'base'}),/禁止明文提交/);
 assert.equal(saved,undefined);
});
