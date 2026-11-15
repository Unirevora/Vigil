import test from 'node:test';
import assert from 'node:assert/strict';
import {tasksFromEntries,toggleTask,connectionsFromEntries,reviewMetrics,promptFromEntries} from '../src/insights/insights.js';
const entries=[
 {id:'a',title:'第一篇',date:'2026-11-14',updatedAt:'2026-11-14T12:00:00Z',tags:['随笔'],content:'- [ ] 阅读书籍 📅 2026-11-15\n- [x] 晨间散步\n[[第二篇]]\n```\n- [ ] 这里不是任务\n```'},
 {id:'b',title:'第二篇',date:'2026-11-15',updatedAt:'2026-11-15T12:00:00Z',tags:['灵感'],content:'项目笔记 [[缺失的笔记]]'}
];
test('任务聚合跳过代码块，提供原始行位置与截止日期',()=>{
 const found=tasksFromEntries(entries);
 assert.equal(found.length,2);
 assert.equal(found.find(t=>!t.complete).due,'2026-11-15');
 assert.equal(found.find(t=>t.complete).line,1);
});
test('勾选任务只修改对应原始行，保持其他手记不变并检查冲突',()=>{
 const task=tasksFromEntries(entries).find(t=>!t.complete);
 const changed=toggleTask(entries,task.entryId,task.line,task.source);
 assert.ok(changed[0].content.includes('- [x] 阅读书籍'));
 assert.equal(changed[1].content,entries[1].content);
 assert.equal(entries[0].content.includes('- [ ]'),true);
 assert.throws(()=>toggleTask(entries,'a',0,'伪造文本'),/已发生变化/);
});
test('双向引用与无目标的链接解析',()=>{
 const graph=connectionsFromEntries(entries);
 assert.equal(graph.edges.length,1);
 assert.equal(graph.edges[0].to,'b');
 assert.equal(graph.backlinks.get('b')[0].from,'a');
 assert.equal(graph.unresolved[0].label,'缺失的笔记');
});
test('周期复盘、写作数量、标签与待办聚合都是离线可重算结果',()=>{
 const metrics=reviewMetrics(entries,new Date('2026-11-15T15:00:00Z'));
 assert.equal(metrics.week,2);
 assert.equal(metrics.pending,1);
 assert.equal(metrics.complete,1);
 assert.equal(metrics.tags.length,2);
 assert.ok(promptFromEntries(entries,new Date('2026-11-15T15:00:00Z')).text);
});
