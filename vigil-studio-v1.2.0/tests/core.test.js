import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidDate,escapeHtml, charCount} from '../src/core/format.js';
import {buildEntry,sortEntries,filterEntries,getMetrics} from '../src/core/entries.js';
import {renderMarkdown} from '../src/core/markdown.js';

const entries=[
  {id:'1',title:'第一篇',content:'今天散步',date:'2026-11-01',createdAt:'a',updatedAt:'b'},
  {id:'2',title:'阅读笔记',content:'## 读书日记\n有趣',date:'2026-11-03',createdAt:'a',updatedAt:'b'}
];

test('日期校验拒绝无效年月日',()=>{
  assert.equal(isValidDate('2026-02-30'),false);
  assert.equal(isValidDate('2026-11-13'),true);
  assert.equal(isValidDate('bad'),false);
});
test('手记按日期排序与中英文关键词搜索',()=>{
  assert.deepEqual(sortEntries(entries).map(e=>e.id),['2','1']);
  assert.deepEqual(sortEntries(entries,'asc').map(e=>e.id),['1','2']);
  assert.deepEqual(filterEntries(entries,'日记').map(e=>e.id),['2']);
  assert.deepEqual(filterEntries(entries,'散步').map(e=>e.id),['1']);
});
test('创建条目与统计',()=>{
  const entry=buildEntry({date:'2026-11-13',title:' ',content:'第一行\n 第二行'});
  assert.equal(entry.title,'未命名手记');
  assert.ok(entry.id);
  assert.equal(charCount(entry.content),6);
  const m=getMetrics([entry],'2026-11-13');
  assert.equal(m.total,1);assert.equal(m.thisMonth,1);assert.equal(m.words,6);
});
test('基础 Markdown 的安全标记',()=>{
  const html=renderMarkdown('## 标题\n\n**加粗**与*斜体*\n\n- 第一点\n- 第二点');
  assert.match(html,/<h2>标题<\/h2>/);
  assert.match(html,/<strong>加粗<\/strong>/);
  assert.match(html,/<ul>/);
});
test('HTML 在 Markdown 前被转义，危险协议拒绝',()=>{
  const html=renderMarkdown('<script>alert(1)</script>\n\n[点击](javascript:alert(1))');
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/href="javascript:/);
  assert.match(renderMarkdown('[链接](https://example.org)'),/href="https:\/\/example.org"/);
  assert.equal(escapeHtml('<img onerror="a">'),'&lt;img onerror=&quot;a&quot;&gt;');
});
