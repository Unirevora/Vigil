import test from 'node:test';
import assert from 'node:assert/strict';
import {BackupRepository,BACKUP_KEY,BACKUP_LIMIT} from '../src/storage/backups.js';

class Store {
  map=new Map();
  failWrites=false;
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){if(this.failWrites)throw new Error('QuotaExceeded');this.map.set(key,String(value));}
}
const sample={id:'first',title:'我的手记',content:'内容',date:'2026-11-13',
  createdAt:'2026-11-13T00:00:00.000Z',updatedAt:'2026-11-13T00:00:00.000Z'};
test('备份生成、跨实例读取、返回副本内容',()=>{
  const storage=new Store();
  const repo=new BackupRepository(storage);
  const saved=repo.create([sample],'manual','手动副本');
  const reloaded=(new BackupRepository(storage)).list();
  assert.equal(reloaded.length,1);
  assert.equal(reloaded[0].id,saved.id);
  assert.equal(reloaded[0].entries[0].content,'内容');
});
test('滚动上限严格为五份，最新保留',()=>{
  const repo=new BackupRepository(new Store());
  const ids=[];
  for(let i=0;i<8;i++){
    ids.push(repo.create([{...sample,content:'第'+i}]).id);
  }
  const backups=repo.list();
  assert.equal(backups.length,BACKUP_LIMIT);
  assert.equal(new Set(backups.map(b=>b.id)).size,5);
  assert.equal(backups.some(b=>b.entries[0].content==='第7'),true);
  assert.equal(backups.some(b=>b.entries[0].content==='第0'),false);
});
test('删除指定副本不触碰别的副本或正式手记',()=>{
  const repo=new BackupRepository(new Store());
  const a=repo.create([sample]);
  const b=repo.create([]);
  assert.equal(repo.remove(a.id),true);
  assert.equal(repo.list().length,1);
  assert.equal(repo.list()[0].id,b.id);
});
test('不允许将损坏备份静默置零',()=>{
  const storage=new Store();
  storage.map.set(BACKUP_KEY,'{broken');
  const repo=new BackupRepository(storage);
  assert.throws(()=>repo.create([sample]),/无法解析/);
  assert.equal(storage.getItem(BACKUP_KEY),'{broken');
});
test('备份写入失败保留已有历史记录',()=>{
  const storage=new Store();
  const repo=new BackupRepository(storage);
  repo.create([sample]);
  const old=storage.getItem(BACKUP_KEY);
  storage.failWrites=true;
  assert.throws(()=>repo.create([]),/QuotaExceeded/);
  assert.equal(storage.getItem(BACKUP_KEY),old);
});
test('备份条目结构校验失败时不写入',()=>{
  const storage=new Store();
  const repo=new BackupRepository(storage);
  assert.throws(()=>repo.create([{...sample,date:'2026-02-30'}]),/字段无效/);
  assert.equal(storage.getItem(BACKUP_KEY),null);
});
