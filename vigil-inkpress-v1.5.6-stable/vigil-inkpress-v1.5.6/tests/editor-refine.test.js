import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineSegments,markdownHeading,markdownListMarker,markdownTableAt,markdownMathBlockAt,markdownFenceAt}
  from '../src/editor/live-markdown.js';
import {renderMarkdown} from '../src/core/markdown.js';
import {BACKGROUND_PRESETS,normalizeAppearance} from '../src/appearance/settings.js';

test('活动行标记与渲染文本各自拥有可独立装饰的范围',()=>{
  const line='这是 **加粗** 和 _斜体_、`代码`、$x^2$ 以及 [[旧笔记]]';
  const segments=inlineSegments(line);
  for(const type of ['strong','emphasis','code','math','wikilink']){
    assert.ok(segments.some(x=>x.type===type),type);
  }
  const bold=segments.find(x=>x.type==='strong');
  assert.equal(line.slice(bold.from,bold.to),'**加粗**');
  assert.equal(line.slice(bold.innerFrom,bold.innerTo),'加粗');
  assert.ok(segments.every((x,i)=>i===0||x.from>=segments[i-1].to),'不应重叠装饰范围');
});
test('标题列表解析在编辑时保留源码，不修改原文',()=>{
  assert.deepEqual(markdownHeading('## 标题'),{level:2,prefix:3,title:'标题'});
  assert.equal(markdownListMarker('- [x] 已完成').kind,'task');
  assert.equal(markdownListMarker('- [x] 已完成').checked,true);
  assert.equal(markdownListMarker('1. 开始').kind,'ordered');
});
test('公式、表格和代码围栏以完整块索引，不吞并普通段落',()=>{
  const source=['$$','\\frac{a}{b}','$$','', '| 字段 | 内容 |','| --- | --- |','| A | B |','', '```js','a();','```'];
  assert.deepEqual([markdownMathBlockAt(source,0).start,markdownMathBlockAt(source,0).end],[0,2]);
  assert.deepEqual([markdownTableAt(source,4).start,markdownTableAt(source,4).end],[4,6]);
  assert.deepEqual([markdownFenceAt(source,8).start,markdownFenceAt(source,8).end],[8,10]);
});
test('阅读模式压缩源文件的多余空行与软换行，保留有意硬换行',()=>{
  const source='# 标题\n\n\n\n第一句\n第二句\n\n\n\n末尾段落';
  const html=renderMarkdown(source);
  assert.equal((html.match(/<p>/g)||[]).length,2);
  assert.equal((html.match(/<br>/g)||[]).length,0);
  assert.match(html,/第一句 第二句/);
  assert.doesNotMatch(html,/<p>\s*<\/p>|<p><br>/);
  const hard=renderMarkdown('这一行  \n下一行\n\n再一段');
  assert.equal((hard.match(/<br>/g)||[]).length,1);
});
test('代码块内部空行保留，正文空行折叠且公式保留',()=>{
  const source='说明\n\n```js\nconst a=1;\n\nconsole.log(a);\n```\n\n$$\na^2+b^2=c^2\n$$';
  const html=renderMarkdown(source);
  assert.match(html,/const a=1;\n\nconsole\.log/);
  assert.ok(html.includes('math'));
  assert.equal((html.match(/<p>/g)||[]).length,1);
});
test('内置背景全部换为高清或矢量简洁主题，旧版风物背景平滑迁移',()=>{
  const presets=BACKGROUND_PRESETS.map(x=>x.key);
  assert.deepEqual(presets,['paper','mountains','sage','sea','custom','none']);
  assert.equal(normalizeAppearance({background:'plum'}).background,'mountains');
  assert.equal(normalizeAppearance({background:'bamboo'}).background,'sage');
  assert.equal(normalizeAppearance({background:'waves'}).background,'sea');
});
