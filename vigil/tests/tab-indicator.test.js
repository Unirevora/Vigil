import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncTabIndicators} from '../src/ui/tab-indicator.js';

// Minimal DOM: a tablist with tabs at fixed offsets; the view is "re-rendered" by
// building a fresh bar, exactly like render() replacing #mainContent.innerHTML.
function fakeBar(label,activeIndex,tabs=[[0,100],[106,140],[252,90]]){
  const indicator={style:{},animations:[],className:'',setAttribute(){},animate(frames,options){this.animations.push({frames,options});}};
  let mounted=null;
  const tabEls=tabs.map(([offsetLeft,offsetWidth],i)=>({offsetLeft,offsetWidth,active:i===activeIndex}));
  const bar={
    classes:new Set(),classList:{add:c=>bar.classes.add(c)},
    getAttribute:name=>name==='aria-label'?label:null,
    querySelector(sel){
      if(sel.includes('vigil-tab-indicator'))return mounted;
      return tabEls.find(t=>t.active)||null;
    },
    append(node){mounted=node;}
  };
  const root={querySelectorAll:()=>[bar]};
  return {root,bar,indicator,get mounted(){return mounted;}};
}
function withDom(fn,{reduced=false}={}){
  const saved={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle,matchMedia:globalThis.matchMedia};
  const created=[];
  globalThis.document={createElement:()=>{const el={style:{},animations:[],setAttribute(){},animate(frames,options){el.animations.push({frames,options});}};created.push(el);return el;}};
  globalThis.getComputedStyle=()=>({getPropertyValue:()=>'12px'});
  globalThis.matchMedia=()=>({matches:reduced});
  try{return fn(created);}finally{Object.assign(globalThis,saved);}
}

test('v1.7.1: 标签指示条首次出现时直接就位，不播放动画',()=>withDom(()=>{
  const view=fakeBar('设置分类-first',0);
  syncTabIndicators(view.root);
  const ind=view.mounted;
  assert.equal(ind.style.width,'76px');                 // 100 - 2×12 inset
  assert.equal(ind.style.transform,'translateX(12px)');
  assert.equal(ind.animations.length,0);
  assert.ok(view.bar.classes.has('has-indicator'));
}));

test('v1.7.1: 重新渲染后指示条从上一个标签滑到新标签',()=>withDom(()=>{
  syncTabIndicators(fakeBar('设置分类-slide',0).root);
  const next=fakeBar('设置分类-slide',2);                // a brand-new DOM, like innerHTML re-render
  syncTabIndicators(next.root);
  const [anim]=next.mounted.animations;
  assert.ok(anim,'animates across the re-render');
  assert.deepEqual(anim.frames[0],{transform:'translateX(12px)',width:'76px'});
  assert.deepEqual(anim.frames[1],{transform:'translateX(264px)',width:'66px'});
  assert.equal(next.mounted.style.transform,'translateX(264px)');
}));

test('v1.7.1: 减少动态效果时只移动不播放动画；不同标签栏互不影响',()=>{
  withDom(()=>{
    syncTabIndicators(fakeBar('岁时视图-reduced',0).root);
    const next=fakeBar('岁时视图-reduced',1);
    syncTabIndicators(next.root);
    assert.equal(next.mounted.animations.length,0);
    assert.equal(next.mounted.style.transform,'translateX(118px)');
  },{reduced:true});
  withDom(()=>{
    syncTabIndicators(fakeBar('手记来源-x',1).root);
    const other=fakeBar('设置分类-y',1);                  // never seen before → no animation
    syncTabIndicators(other.root);
    assert.equal(other.mounted.animations.length,0);
  });
});

test('v1.7.1: 每次渲染后同步指示条，并在窗口尺寸或字体变化时重新测量',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/import \{syncTabIndicators,watchTabIndicatorLayout\} from '\.\/ui\/tab-indicator\.js'/);
  assert.match(main,/mountThemedSelects\(\$\('#mainContent'\)\);\n\s*syncTabIndicators\(\$\('#mainContent'\)\);/);
  assert.match(main,/watchTabIndicatorLayout\(\);/);
});
