import {icon} from '../icons.js';
import {getMetrics,sortEntries} from '../../core/entries.js';
import {entriesCards} from './entry-cards.js';
import {heroPaper} from './hero-paper.js';

export function homeView(state) {
  const m=getMetrics(state.entries); const recents=sortEntries(state.entries,state.order).slice(0,3);
  return `<section class="hero">
    <div class="hero-copy">
      <div class="kicker divider-kicker">A QUIET PLACE TO WRITE</div>
      <h1>让每一个平凡的<br>日子，<em>都有回声。</em></h1>
      <p>把日常的微光、心事与远方，轻轻安放在这里。只为自己写，不必着急。</p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-action="new">${icon('pen')} 开始写作</button>
        <button class="btn" data-action="nav" data-to="entries">翻阅手记 ${icon('arrow')}</button>
      </div>
    </div>${heroPaper(state)}
  </section>
  <div class="stats">
    <div class="stat"><div class="stat-value">${m.total}<small>篇</small></div><div class="stat-label">已写手记</div></div>
    <div class="stat"><div class="stat-value">${m.thisMonth}<small>篇</small></div><div class="stat-label">本月记录</div></div>
    <div class="stat"><div class="stat-value">${m.words.toLocaleString('zh-CN')}<small>字</small></div><div class="stat-label">留下的文字</div></div>
  </div>
  <div class="section-heading">
    <div class="row"><h2>最近手记</h2><span class="sect-sub">RECENT MOMENTS</span></div>
    <button class="btn-link" data-action="nav" data-to="entries">查看全部 ${icon('arrow')}</button>
  </div>
  <div class="entry-list">${entriesCards(recents)}</div>
  <div class="demo-note">${state.entries.some(e=>e.demo) ? '当前包含示例手记，均可阅读、修改或删除。你可以在「门与数据」清除所有示例。' : '所有内容保存在当前浏览器的本地存储中。'}</div>
  <p class="footer-note">VIGIL / 日子不必宏大，值得记下就好。</p>`;
}
