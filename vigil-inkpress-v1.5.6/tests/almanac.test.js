import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERMS,solarTermsForYear,solarTermOn,almanacForDate,addChinaDays,
  sunApparentLongitude,moonPhaseForDate,termRingModel
} from '../src/core/almanac.js';

test('24 节气 / 72 候都有完整的风物元数据',()=>{
  assert.equal(TERMS.length,24);
  assert.equal(new Set(TERMS.map(t=>t.name)).size,24);
  assert.equal(TERMS.reduce((s,t)=>s+t.hou.length,0),72);
  for(const t of TERMS){
    assert.equal(t.hou.every(Boolean),true);
    assert.equal(t.verse.length>6,true);
    assert.equal(t.note.length>3,true);
  }
});
test('2026 关键节气日期与香港天文台日期表对齐 (北京时间)',()=>{
  const expected={
    '小寒':'2026-01-05','大寒':'2026-01-20','立春':'2026-02-04',
    '雨水':'2026-02-18','春分':'2026-03-20','清明':'2026-04-05',
    '谷雨':'2026-04-20','夏至':'2026-06-21','秋分':'2026-09-23',
    '立冬':'2026-11-07','小雪':'2026-11-22','冬至':'2026-12-22'
  };
  for(const item of solarTermsForYear(2026)){
    if(expected[item.name])assert.equal(item.chinaDate,expected[item.name],item.name);
    const error=((sunApparentLongitude(item.instant)-item.angle+540)%360)-180;
    assert.ok(Math.abs(error)<.00001,item.name+' angular error');
  }
});
test('年末节令可跨年查询，三候与下节随日期更新',()=>{
  const info=almanacForDate('2026-11-13');
  assert.equal(info.selected.name,'立冬');
  assert.equal(info.hou,'地始冻');
  assert.equal(info.next.name,'小雪');
  assert.equal(almanacForDate('2026-12-31').selected.name,'冬至');
  assert.equal(almanacForDate('2027-01-01').selected.name,'冬至');
});
test('月相数据与节令轮盘索引稳定',()=>{
  const phase=moonPhaseForDate('2026-11-13');
  assert.ok(phase.fraction>=0&&phase.fraction<1);
  assert.ok(phase.name);
  const ring=termRingModel('2026-11-13');
  assert.equal(ring.index,20);
  assert.equal(ring.entries.length,24);
  assert.equal(solarTermOn('2026-11-22').name,'小雪');
});
test('日期前后推移不依赖运行设备时区',()=>{
  assert.equal(addChinaDays('2026-12-31',1),'2027-01-01');
  assert.equal(addChinaDays('2026-03-01',-1),'2026-02-28');
  assert.throws(()=>solarTermsForYear(1800),/1900/);
});
