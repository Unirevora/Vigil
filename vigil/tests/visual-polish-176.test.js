import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readStyles,readStyle} from './support/styles.js';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('v1.7.6 视觉打磨：节气罗盘具备夜间墨玉色阶，选中态跟随主题色',()=>{
  const chronicle=readStyle('chronicle');
  assert.match(chronicle,/:root\[data-theme=night\] \.season-dial\{[^}]*radial-gradient/);
  assert.match(chronicle,/:root\[data-theme=night\] \.dial-center\{/);
  assert.match(chronicle,/:root\[data-theme=night\] \.dial-tick-ring\{/);
  assert.match(chronicle,/\.term-node\.selected\{[^}]*var\(--appearance-accent\)/);
  assert.doesNotMatch(chronicle,/#274c41|rgba\(53,93,79/);
});

test('v1.7.6 视觉打磨：水墨暗纹日夜适配，清理残留硬编码色值与桌面无效胶囊规则',()=>{
  const home=readStyle('home');
  const insights=readStyle('insights');
  const dialogs=readStyle('dialogs');
  const base=readStyle('base');
  assert.match(home,/\.heritage-stat::before\{display:block!important/);
  assert.match(home,/:root\[data-theme=night\] :is\(\.heritage-stat,\.season-teaser,\.home-quick-row \.draft-banner\)::before\{[^}]*mix-blend-mode:screen/);
  assert.doesNotMatch(home,/\.heritage-stat::before\{display:none!important\}/);
  assert.doesNotMatch(home,/body\[data-page=home\] \.glass-dock\{display:flex\}/);
  assert.doesNotMatch(insights,/body\[data-page=insights\] \.glass-dock\{display:flex\}/);
  assert.doesNotMatch(insights,/#476d61|#345953/);
  assert.doesNotMatch(dialogs,/#413b43|#615560|#413941/);
  assert.match(dialogs,/:root\[data-theme=night\] \.command-result\.active\{[^}]*var\(--appearance-accent\)/);
  assert.match(base,/:root\[data-theme=night\] \.heritage-copy\{background:transparent!important\}/);
});

test('v1.7.6 视觉打磨：桌面侧栏折叠文字平滑过渡，弹层补齐退场动画，线索页接入纸片入场',()=>{
  const shell=readStyle('shell');
  const dialogs=readStyle('dialogs');
  const motionCss=readStyle('motion');
  const motionJs=read('src/ui/motion.js');
  const passphraseJs=read('src/ui/passphrase.js');
  assert.match(shell,/@media \(min-width:901px\)\{[\s\S]*?\.shell\.sidebar-collapsed \.nav-full\{max-width:0!important;opacity:0!important/);
  assert.doesNotMatch(shell,/^\.shell\.sidebar-collapsed \.nav-full\{display:none\}/m);
  assert.doesNotMatch(readStyle('settings'),/\.appearance-entry :is\(\.nav-full,\.nav-short\)\{display:none\}/);
  assert.match(motionCss,/@keyframes dialog-exit\{/);
  assert.match(dialogs,/\.modal-layer\.is-closing \.modal\{animation:dialog-exit/);
  assert.match(dialogs,/\.command-layer\.is-closing \.command-dialog,\.passphrase-layer\.is-closing \.passphrase-dialog\{animation:dialog-exit/);
  assert.match(passphraseJs,/first\.value='';again\.value='';/);
  for(const selector of ['.insight-metric','.insight-panel','.pagination-card','.reader-backlinks','.empty'])
    assert.ok(motionJs.includes(`'${selector}'`),`${selector} has entrance motion`);
});

test('v1.7.6 视觉打磨：阅读稿纸恢复信笺内框与尾款，回响卡与空状态并入毛玻璃契约',()=>{
  const css=readStyles();
  const plain=css.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.match(plain,/\.main-inner \.reading-paper::after\{[^}]*border:1px solid color-mix\(in srgb,var\(--appearance-accent\)/);
  assert.doesNotMatch(plain,/\.main-inner \.reading-paper::after\{display:none!important\}/);
  assert.match(plain,/\.reading-paper:not\(\.github-reading-paper\) \.reading-foot span:last-child\{[^}]*var\(--appearance-accent\)/);
  const frosted=[...plain.matchAll(/([^{}]+)\{[^{}]*backdrop-filter:var\(--glass-panel-blur\)!important/g)].map(m=>m[1]).join(',');
  for(const surface of ['.reader-backlinks','.empty','.reflection-panel','.pagination-card'])
    assert.ok(frosted.includes(surface),`${surface} is frosted`);
  assert.match(readStyle('controls'),/\.empty-icon\{[^}]*var\(--appearance-accent-soft\)/);
});

test('v1.7.6 视觉打磨：四级圆角标尺、等宽统计数字与不干扰测量的实时块描边',()=>{
  const tokens=readStyle('tokens');
  const editor=readStyle('editor');
  const css=readStyles();
  for(const token of ['--radius-sm:10px','--radius-md:14px','--radius-lg:20px','--radius-pill:999px'])
    assert.ok(tokens.includes(token),token);
  for(const rule of [
    /\.home-layout \.heritage-stat strong\{[^}]*font-variant-numeric:tabular-nums/,
    /\.insight-metric strong\{[^}]*font-variant-numeric:tabular-nums/,
    /\.day-num\{[^}]*font-variant-numeric:tabular-nums/,
    /\.reading-foot\{[^}]*font-variant-numeric:tabular-nums/,
    /\.editor-foot\{[^}]*font-variant-numeric:tabular-nums/
  ]){
    assert.match(css,rule);
  }
  assert.match(editor,/\.refined-editor \.cm-code-widget\{[^}]*box-shadow:inset 0 0 0 1px var\(--stroke\)/);
  assert.match(editor,/border-top:6px solid transparent;border-bottom:6px solid transparent/);
});
