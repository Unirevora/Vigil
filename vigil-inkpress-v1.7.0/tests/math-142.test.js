import test from 'node:test';
import assert from 'node:assert/strict';
import {KATEX_VERSION,mathToHtml,findInlineMath} from '../src/core/math.js';
import {renderMarkdown} from '../src/core/markdown.js';

test('KaTeX 原生 MathML 行内与块级输出真实渲染标记',()=>{
  assert.match(KATEX_VERSION,/^0\.\d+\.\d+/);
  assert.match(mathToHtml('E=mc^2'),/<math/);
  assert.match(mathToHtml('\\frac{a}{b}',{displayMode:true}),/<mfrac/);
  assert.match(renderMarkdown('行内 $E=mc^2$ 公式'),/class="math-inline"[^>]*>.*<math/s);
  assert.match(renderMarkdown('$$\n\\frac{a}{b}\n$$'),/class="math-display"[^>]*>.*<math/s);
  assert.match(renderMarkdown('\\[\n\\sum_{i=1}^n i\n\\]'),/class="math-display"[^>]*>.*<math/s);
});
test('数学公式扫描跳过转义符与货币、识别 \\( ... \\)',()=>{
  const found=findInlineMath('价格 \\$5；$E=mc^2$ 与 \\(x+y\\)');
  assert.deepEqual(found.map(x=>x.latex),['E=mc^2','x+y']);
});
test('数学渲染不将 HTML 和不可信 KaTeX 指令当脚本执行',()=>{
  const malicious='<script>alert("x")</script>';
  const html=renderMarkdown(`${malicious}\n\n$\\href{javascript:alert(1)}{bad}$`);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!mathToHtml('\\htmlClass{evil}{a}').includes('class="evil"'));
});
test('Markdown 阅读模式包含表格、任务复选框与内部手记链接',()=>{
  const html=renderMarkdown('| 名称 | 数值 |\n| --- | --- |\n| 记录 | $x^2$ |\n\n- [x] 完成\n- [ ] 未完\n\n[[一封家书]]');
  assert.match(html,/<table>/);
  assert.match(html,/<math/);
  assert.match(html,/type="checkbox" disabled checked/);
  assert.match(html,/class="wiki-link"/);
});
