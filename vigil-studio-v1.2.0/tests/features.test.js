import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEntry,filterEntries,sortEntries} from '../src/core/entries.js';
import {validateDataset,makeDataset} from '../src/storage/schema.js';
import {calendarDays,archiveMonths,yearsAgoToday,shiftMonth} from '../src/core/calendar.js';

const sample={
  id:'e1',title:'一篇',content:'旅行散步',date:'2025-11-13',
  createdAt:'2025-11-13T00:00:00Z',updatedAt:'2025-11-13T00:00:00Z',
  tags:['旅行','生活'],mood:'喜悦',favorite:true
};
const second={...sample,id:'e2',title:'另一篇',content:'学习书法',date:'2026-11-13',tags:['学习'],favorite:false};

test('历史数据缺失新字段仍可以正常读取',()=>{
  const record=validateDataset(makeDataset([{...sample,tags:undefined,mood:undefined,favorite:undefined}]))[0];
  assert.deepEqual(record.tags,[]);
  assert.equal(record.mood,'');
  assert.equal(record.favorite,false);
});
test('标签心情收藏能通过保存和数据校验',()=>{
  const updated=buildEntry({title:' 题目 ',content:'新内容',date:'2026-11-13',
    tags:['旅行','旅行','记录'],mood:'灵感'},sample);
  assert.deepEqual(updated.tags,['旅行','记录']);
  assert.equal(updated.mood,'灵感');
  assert.equal(updated.favorite,true);
  assert.deepEqual(validateDataset(makeDataset([updated]))[0].tags,['旅行','记录']);
});
test('查询支持收藏、标签和月份',()=>{
  const collection=[sample,second];
  assert.equal(filterEntries(collection,'','desc',{favorite:true}).length,1);
  assert.equal(filterEntries(collection,'','desc',{tag:'学习'})[0].id,'e2');
  assert.equal(filterEntries(collection,'','desc',{month:'2025-11'})[0].id,'e1');
  assert.equal(filterEntries(collection,'旅行').length,1);
});
test('日历月变化、归档与往年今日',()=>{
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
  const grid=calendarDays('2026-11');
  assert.equal(grid.filter(Boolean).length,30);
  assert.deepEqual(archiveMonths([sample,second]),[['2026-11',1],['2025-11',1]]);
  assert.equal(yearsAgoToday([sample,second],'2026-11-13')[0].id,'e1');
});
