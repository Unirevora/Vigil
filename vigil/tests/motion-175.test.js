import test from 'node:test';
import assert from 'node:assert/strict';
import {floatingPose} from '../src/ui/floating.js';
import {drapeResolution,createSpectralDrape} from '../src/effects/spectral-drape.js';
import {DEFAULT_APPEARANCE,normalizeAppearance,writeAppearance,readAppearance} from '../src/appearance/settings.js';
import {readStyle} from './support/styles.js';

test('全局浮动偏好严格校验，热切换只写外观键；拒绝保存时已有记录不变',()=>{
  assert.equal(DEFAULT_APPEARANCE.floating,true);
  assert.equal(normalizeAppearance({floating:false}).floating,false);
  assert.equal(normalizeAppearance({floating:'false'}).floating,true);
  const data=new Map([['vigil-mvp-data-v1','保留正式手记']]);
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
  const next=writeAppearance(storage,readAppearance(storage),{floating:false});
  assert.equal(next.floating,false);assert.equal(readAppearance(storage).floating,false);
  assert.equal(data.get('vigil-mvp-data-v1'),'保留正式手记');
  const saved=data.get('vigil-appearance-v142');
  assert.throws(()=>writeAppearance({...storage,setItem(){throw Error('quota');}},next,{floating:true}));
  assert.equal(data.get('vigil-appearance-v142'),saved);
});

test('统一浮动角度有边界、中心归零，更克制模式降低幅度',()=>{
  assert.equal(floatingPose(.5,.5).angle,0);
  assert.ok(floatingPose(1,0).angle>0);
  assert.ok(floatingPose(500,-500).angle<=.85);
  assert.ok(floatingPose(1,0,true).angle<floatingPose(1,0).angle);
  for(const n of Object.values(floatingPose(NaN,Infinity)))assert.ok(Number.isFinite(n));
});

test('点阵帷幕限制离屏像素预算，高分屏不再放大绘制成本',()=>{
  assert.equal(drapeResolution(1440,950,2),1);
  const scale=drapeResolution(3840,2160,3);
  assert.ok(scale>0&&scale<1);
  assert.ok(3840*2160*scale*scale<=1600001);
});

test('工具栏旧骤变缩放与颜色专用过渡已清理，浮动样式集中管理',()=>{
  assert.doesNotMatch(readStyle('editor'),/scale\(1\.075\)|scale\(\.91\)|transition:background \.15s,color \.15s/);
  assert.doesNotMatch(readStyle('editor'),/data-floating-surface/);
  assert.match(readStyle('floating'),/prefers-reduced-motion/);
});

test('帷幕相同设置不重启，静态/隐藏/关闭/销毁不遗留调度，光晕只在换色时构建',()=>{
  const keys=['window','document','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout'];
  const saved=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const frames=new Map(),timers=new Map(),events=new Map();let serial=0,draws=0,gradients=0;
  const context={setTransform(){},clearRect(){draws++;},drawImage(){},beginPath(){},arc(){},fill(){},fillRect(){},
    createRadialGradient(){gradients++;return {addColorStop(){}};}};
  const canvas=()=>({width:1,height:1,style:{},dataset:{},classList:{toggle(){}},setAttribute(){},getContext(){return context;}});
  const media={matches:false,addEventListener(){},removeEventListener(){}};
  try{
    globalThis.window={innerWidth:1440,innerHeight:950,devicePixelRatio:2,matchMedia:()=>media,
      addEventListener:(key,fn)=>events.set(key,fn),removeEventListener(){}};
    globalThis.document={hidden:false,createElement:canvas,addEventListener:(key,fn)=>events.set(key,fn),removeEventListener(){}};
    globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};
    globalThis.cancelAnimationFrame=id=>frames.delete(id);
    globalThis.setTimeout=fn=>{timers.set(++serial,fn);return serial;};globalThis.clearTimeout=id=>timers.delete(id);
    const surface=canvas(),effect=createSpectralDrape(surface);
    effect.setOptions({enabled:true,motion:'off'});
    const initial=draws;assert.equal(gradients,2);assert.equal(timers.size,0);
    effect.setOptions({enabled:true,motion:'off'});assert.equal(draws,initial);
    effect.setOptions({intensity:.6});assert.equal(gradients,2,'强度不重建贴图');
    effect.setOptions({motion:'standard'});assert.equal(timers.size,1);
    document.hidden=true;events.get('visibilitychange')();assert.equal(timers.size,0);
    document.hidden=false;events.get('visibilitychange')();assert.equal(timers.size,1);
    events.get('resize')();assert.equal(frames.size,1);
    effect.setOptions({enabled:false});assert.equal(frames.size,0);assert.equal(timers.size,0);assert.equal(surface.width,1);
    effect.setOptions({enabled:true});effect.destroy();assert.equal(timers.size,0);assert.equal(frames.size,0);
  }finally{
    for(const [key,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
});
