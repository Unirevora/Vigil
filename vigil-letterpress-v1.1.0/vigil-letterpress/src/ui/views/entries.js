import {icon} from '../icons.js';
import {filterEntries} from '../../core/entries.js';
import {escapeHtml} from '../../core/format.js';
import {entriesCards} from './entry-cards.js';

export function entriesView(state) {
  const results=filterEntries(state.entries,state.query,state.order);
  return `<div class="page-header">
    <div class="page-heading"><div class="kicker"><span class="kicker-line"></span>THE INDEX / 诸日目录</div>
      <h1 class="page-title">手记索引<span class="heading-punctuation">。</span></h1>
      <p class="page-lead">从每一篇文字里，认出曾经的自己。</p>
    </div>
    <button class="btn btn-primary" data-action="new">${icon('plus')} 另启新页</button>
  </div>
  <section class="index-search" aria-label="查询手记">
    <div class="searchbox">${icon('search')}<input id="searchInput" class="search-input" aria-label="搜索手记" autocomplete="off"
      value="${escapeHtml(state.query)}" placeholder="检索标题、正文中的一段话……"></div>
    <button class="btn btn-sort" data-action="toggle-order">${icon('clock')} ${state.order==='desc'?'日期：新到旧':'日期：旧到新'}</button>
  </section>
  <div class="index-legend"><span id="resultCount">存档 ${results.length} 篇 ${state.query?'· 搜索结果':''}</span><span>DATE / SUBJECT / CONTENT</span></div>
  <div class="entry-list" id="entryResults">${entriesCards(results,state.query)}</div>
  <div class="footer-note"><span>— 每一份平凡，都在此留有一页 —</span><span>CATALOGUE / VIGIL</span></div>`;
}
