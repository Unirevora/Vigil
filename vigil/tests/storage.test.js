import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalEntryRepository} from '../src/storage/repository.js';
import {DATA_KEY,PREVIOUS_PROTOTYPE_KEY,validateDataset,makeDataset} from '../src/storage/schema.js';
import {parseImportText,exportJson} from '../src/storage/transfer.js';

class FakeStorage {
  constructor(data={}){this.data={...data};this.failWrites=false;}
  getItem(k){return Object.hasOwn(this.data,k)?this.data[k]:null;}
  setItem(k,v){if(this.failWrites)throw new Error('QuotaExceeded');this.data[k]=String(v);}
}
const sample = {
  id:'old-entry',title:'旧原型',content:'# 文字',date:'2026-10-28',
  createdAt:'2026-10-28T08:00:00.000Z',updatedAt:'2026-10-28T09:00:00.000Z',
  demo:false
};
test('新安装生成示例数据，重复启动不重复生成',()=>{
  const storage=new FakeStorage();
  const repo=new LocalEntryRepository(storage);
  const first=repo.load();
  assert.equal(first.entries.length,4);
  const second=(new LocalEntryRepository(storage)).load();
  assert.equal(second.entries.length,4);
  assert.equal(second.demo,false);
});
test('上一版单 HTML 原型数据复制到新 Key，保留旧 Key',()=>{
  const old=JSON.stringify(makeDataset([sample]));
  const storage=new FakeStorage({[PREVIOUS_PROTOTYPE_KEY]:old});
  const result=(new LocalEntryRepository(storage)).load();
  assert.equal(result.migrated,true);
  assert.equal(result.entries[0].content,'# 文字');
  assert.equal(storage.getItem(PREVIOUS_PROTOTYPE_KEY),old);
  assert.equal(JSON.parse(storage.getItem(DATA_KEY)).entries.length,1);
  const again=(new LocalEntryRepository(storage)).load();
  assert.equal(again.migrated,false);
  assert.equal(again.entries.length,1);
});
test('损坏数据进入只读模式，不会覆盖原始字节',()=>{
  const storage=new FakeStorage({[DATA_KEY]:'not-json'});
  const repo=new LocalEntryRepository(storage);
  const out=repo.load();
  assert.equal(out.entries.length,0);
  assert.equal(repo.readOnly,true);
  assert.throws(()=>repo.save([sample]),/只读保护/);
  assert.equal(storage.getItem(DATA_KEY),'not-json');
});
test('写入失败不修改已有数据',()=>{
  const original=JSON.stringify(makeDataset([sample]));
  const storage=new FakeStorage({[DATA_KEY]:original});
  const repo=new LocalEntryRepository(storage);
  repo.load();
  storage.failWrites=true;
  assert.throws(()=>repo.save([]),/QuotaExceeded/);
  assert.equal(storage.getItem(DATA_KEY),original);
});
test('合法 JSON 可以导出并完整导回',()=>{
  const exported=exportJson([sample]);
  const imported=parseImportText(exported);
  assert.equal(imported.length,1);
  assert.deepEqual(imported[0],{...sample,tags:[],mood:'',favorite:false});
});
test('导入检测重复 ID、错误 Schema 与无效日期',()=>{
  assert.throws(()=>validateDataset({schemaVersion:1,entries:[sample,sample]}),/重复/);
  assert.throws(()=>parseImportText('not-json'),/格式无效/);
  assert.throws(()=>parseImportText('{"schemaVersion":99,"entries":[]}'),/Schema v1/);
  assert.throws(()=>validateDataset(makeDataset([{...sample,date:'2026-02-30'}])),/字段无效/);
});
