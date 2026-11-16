import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {markdownSafeStart} from '../src/editor/live-markdown.js';

test('safe repaint start never lands inside a fence, math block or paragraph',()=>{
  const lines=['intro','','```js','a','','b','```','','para one','para two','','tail'];
  assert.equal(markdownSafeStart(lines,4),1);
  assert.equal(markdownSafeStart(lines,5),1);
  assert.equal(markdownSafeStart(lines,9),7);
  assert.equal(markdownSafeStart(lines,11),10);
  const math=['x','','$$','a','','b','$$','y'];
  assert.equal(markdownSafeStart(math,4),1);
  assert.equal(markdownSafeStart(['a','b','c'],2),0);
  assert.equal(markdownSafeStart(Array(900).fill('x'),800),800);
});

function fakeEnvironment(text){
  const calls={marks:0,clears:0,scrolls:[],refresh:0};
  const el=()=>({classList:{add(){}},style:{},setAttribute(){},addEventListener(){},appendChild(){},
    removeEventListener(){},remove(){},closest(){return null},dataset:{},hidden:false});
  globalThis.document={createElement:el,fonts:{addEventListener(){},removeEventListener(){},ready:Promise.resolve()}};
  // Deferred rAF, flushed explicitly, like a real browser frame.
  const queue=[];
  globalThis.requestAnimationFrame=fn=>{queue.push(fn);return queue.length};
  globalThis.cancelAnimationFrame=()=>{};
  const flush=()=>{while(queue.length)queue.shift()();};
  let viewport={from:0,to:40},top=0,gen=1;
  const handlers={};
  const cm={
    getWrapperElement:()=>el(),getInputField:()=>el(),getValue:()=>text,
    getViewport:()=>viewport,lineCount:()=>text.split('\n').length,changeGeneration:()=>gen,
    listSelections:()=>[{anchor:{line:0,ch:0},head:{line:0,ch:0}}],
    getScrollInfo:()=>({top}),scrollTo:(x,y)=>{calls.scrolls.push(y);top=y},
    lineAtHeight:h=>Math.floor(h/20),heightAtLine:l=>l*20+(cm.shift||0),
    operation:fn=>{fn();if(cm.pending!=null){cm.shift=cm.pending;cm.pending=null;}},getLine:n=>text.split('\n')[n]||'',
    markText:()=>{calls.marks++;return {clear(){calls.clears++}}},
    setBookmark:()=>({clear(){calls.clears++}}),addLineClass(){},removeLineClass(){},
    addLineWidget:()=>({clear(){}}),refresh:()=>{calls.refresh++},
    on:(n,f)=>{handlers[n]=f},off(){},undo(){},redo(){},setCursor(){},focus(){},getDoc:()=>({})
  };
  globalThis.CodeMirror=function(){return cm};
  return {calls,cm,flush,
    scrollTo(from,to,newTop){viewport={from,to};top=newTop;handlers.viewportChange?.();flush();},
    typeSomething(){gen++;handlers.changes?.();flush();},setHeightShift(v){cm.pending=v}};
}
function mount(mountUnifiedEditor,text){
  return mountUnifiedEditor({host:{dataset:{},closest(){return null}},
    reader:{classList:{add(){}},hidden:true},onInput(){},initial:text,mode:'live'});
}

test('scrolling inside the painted window does not rebuild decorations; leaving it does',async()=>{
  const text=Array.from({length:600},(_,i)=>`line **${i}**`).join('\n');
  const env=fakeEnvironment(text);
  const {mountUnifiedEditor}=await import('../src/editor/unified-editor.js');
  const editor=mount(mountUnifiedEditor,text);
  env.flush();
  const first=env.calls.marks;
  assert.ok(first>0,'initial paint decorates the window');
  env.scrollTo(10,50,300);
  env.scrollTo(20,60,400);
  assert.equal(env.calls.marks,first,'no repaint while scrolling inside the window');
  assert.equal(env.calls.clears,0,'no decoration was torn down');
  env.scrollTo(560,598,11200);
  assert.ok(env.calls.marks>first,'repaint once the viewport leaves the window');
  assert.ok(env.calls.clears>0);
  editor.destroy();
});

test('repaint keeps the visible line pinned when heights above it change',async()=>{
  const text=Array.from({length:600},(_,i)=>`line ${i}`).join('\n');
  const env=fakeEnvironment(text);
  const {mountUnifiedEditor}=await import('../src/editor/unified-editor.js');
  const editor=mount(mountUnifiedEditor,text);
  env.flush();
  env.scrollTo(100,140,2010);
  env.calls.scrolls.length=0;
  env.setHeightShift(37);
  env.typeSomething();
  assert.deepEqual(env.calls.scrolls,[2047],'scroll restored so the same line keeps its screen offset');
  editor.destroy();
});

test('block widgets carry spacing as borders, not collapsing margins',async()=>{
  const css=await readFile(new URL('../src/styles/editor.css',import.meta.url),'utf8');
  assert.match(css,/\.cm-active-block-preview\{margin-top:0!important;margin-bottom:0!important;border-top:6px solid transparent/);
  assert.match(css,/\.cm-preview-slot\{/);
});

test('inline math keeps an intrinsic inline box outside .article-content (callouts in editor widgets)',async()=>{
  const css=await readFile(new URL('../src/styles/reader.css',import.meta.url),'utf8');
  assert.match(css,/(?:^|\n)\.math-inline\{display:inline-block!important;[^}]*white-space:nowrap;width:max-content/);
  assert.match(css,/(?:^|\n)\.math-inline math\{display:inline-block!important;width:max-content!important/);
});
