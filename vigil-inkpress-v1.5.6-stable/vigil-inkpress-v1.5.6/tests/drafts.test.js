import test from 'node:test';
import assert from 'node:assert/strict';
import {DraftRepository,DRAFT_KEY,NEW_DRAFT_ID} from '../src/storage/drafts.js';

class Store {
  data=new Map();
  failWrites=false;
  getItem(k){return this.data.has(k)?this.data.get(k):null;}
  setItem(k,v){if(this.failWrites)throw new Error('quota');this.data.set(k,v);}
}
const draft={title:'一页未完',content:'一个尚未写完的句子',date:'2026-11-13'};
test('新手记草稿创建、读取与跨实例恢复',()=>{
  const storage=new Store();
  const repo=new DraftRepository(storage);
  repo.save(NEW_DRAFT_ID,draft);
  const reopened=new DraftRepository(storage);
  const stored=reopened.get(NEW_DRAFT_ID);
  assert.equal(stored.title,draft.title);
  assert.equal(stored.content,draft.content);
  assert.equal(stored.date,draft.date);
});
test('修改同一个条目时更新，而不是重复草稿',()=>{
  const storage=new Store();
  const repo=new DraftRepository(storage);
  repo.save('e1',draft);
  repo.save('e1',{...draft,content:'新版内容'});
  assert.equal(repo.list().length,1);
  assert.equal(repo.get('e1').content,'新版内容');
});
test('草稿删除不影响其他条目',()=>{
  const repo=new DraftRepository(new Store());
  repo.save('e1',draft);
  repo.save(NEW_DRAFT_ID,draft);
  repo.remove('e1');
  assert.equal(repo.list().length,1);
  assert.equal(repo.get(NEW_DRAFT_ID).title,draft.title);
});
test('破损的草稿记录禁止静默覆盖',()=>{
  const storage=new Store();
  storage.data.set(DRAFT_KEY,'{bad');
  const repo=new DraftRepository(storage);
  assert.throws(()=>repo.save(NEW_DRAFT_ID,draft),/无法解析/);
  assert.equal(storage.getItem(DRAFT_KEY),'{bad');
});
test('容量异常不应伪装成保存成功',()=>{
  const storage=new Store();
  storage.failWrites=true;
  assert.throws(()=>new DraftRepository(storage).save(NEW_DRAFT_ID,draft),/quota/);
  assert.equal(storage.getItem(DRAFT_KEY),null);
});

test('草稿数量达到上限后禁止静默丢弃旧草稿',()=>{
  const storage=new Store();
  const repo=new DraftRepository(storage);
  for(let i=0;i<40;i++)repo.save('draft-'+i,draft);
  assert.equal(repo.list().length,40);
  assert.throws(()=>repo.save('draft-41',draft),/上限/);
  assert.equal(repo.list().length,40);
  assert.equal(repo.get('draft-0').content,draft.content);
});
