import test from 'node:test';
import assert from 'node:assert/strict';
import {APPEARANCE_KEY,DEFAULT_APPEARANCE,normalizeAppearance,readAppearance,writeAppearance,
  contrastInk,mixHex} from '../src/appearance/settings.js';
import {readEditorMode,persistEditorMode} from '../src/editor/unified-editor.js';
class MemoryStorage{
  map=new Map();getItem(k){return this.map.get(k)??null;}
  setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}
}
test('外观偏好独立 Schema，默认沿袭经典朱砂与暖纸',()=>{
  const storage=new MemoryStorage();
  assert.deepEqual(readAppearance(storage),{...DEFAULT_APPEARANCE});
  const next=writeAppearance(storage,readAppearance(storage),{
    accent:'#49687C',background:'plum',fontFamily:'kai',theme:'night',bodyFontSize:18
  });
  assert.equal(next.accent,'#49687c');
  assert.equal(next.background,'mountains'); // 旧版梅花背景平滑迁移到新的高清晨雾
  assert.equal(next.fontFamily,'kai');
  assert.equal(next.theme,'night');
  assert.deepEqual(readAppearance(storage),next);
  assert.equal(storage.getItem('vigil-mvp-data-v1'),null);
});
test('错误颜色、恶意 CSS 值与异常数值不得写入主题',()=>{
  const data=normalizeAppearance({accent:'url(javascript:evil)',background:'javascript:',
    fontFamily:'<script>',bodyFontSize:Infinity,lineHeight:99,contentWidth:80,texture:'false'});
  assert.equal(data.accent,DEFAULT_APPEARANCE.accent);
  assert.equal(data.background,'paper');
  assert.equal(data.fontFamily,'heritage');
  assert.equal(data.bodyFontSize,DEFAULT_APPEARANCE.bodyFontSize);
  assert.equal(data.lineHeight,2.5);
  assert.equal(data.contentWidth,860);
  assert.equal(data.texture,true);
});
test('主题色可以生成可对比墨色及混色',()=>{
  assert.equal(contrastInk('#ffffff'),'#222d28');
  assert.equal(contrastInk('#20342c'),'#fff7e7');
  assert.equal(mixHex('#000000','#ffffff',.5),'#808080');
});
test('三种编辑模式使用单独偏好 Key，不覆盖正文',()=>{
  const storage=new MemoryStorage();
  assert.equal(readEditorMode(storage),'live');
  assert.equal(persistEditorMode(storage,'source'),true);
  assert.equal(readEditorMode(storage),'source');
  assert.equal(persistEditorMode(storage,'reading'),true);
  assert.equal(readEditorMode(storage),'reading');
  assert.equal(persistEditorMode(storage,'broken'),false);
  assert.equal(readEditorMode(storage),'reading');
});
test('损坏的外观偏好回退默认而不抛出',()=>{
  const storage=new MemoryStorage();storage.setItem(APPEARANCE_KEY,'{garbled');
  assert.deepEqual(readAppearance(storage),{...DEFAULT_APPEARANCE});
});
