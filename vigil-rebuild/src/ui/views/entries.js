import {icon} from '../icons.js';
import {filterEntries} from '../../core/entries.js';
import {escapeHtml} from '../../core/format.js';
import {entriesCards} from './entry-cards.js';

export function entriesView(state) {
  const results=filterEntries(state.entries,state.query,state.order);
  return `<div class="heading-row">
    <div><div class="kicker divider-kicker">YOUR COLLECTION</div><h1 class="page-title">全部手记</h1><p class="page-lead">那些认真生活过的日子，都在这里。</p></div>
    <button class="btn btn-primary" data-action="new">${icon('plus')} 新建手记</button>
  </div>
  <div class="search-row">
    <div class="searchbox">${icon('search')}<input class="search-input" id="searchInput" aria-label="搜索手记" value="${escapeHtml(state.query)}" placeholder="搜索标题或正文中的字句…" autocomplete="off"></div>
    <button class="btn" data-action="toggle-order">${icon('clock')} <span id="sortLabel">${state.order==='desc' ? '最新在前':'最早在前'}</span></button>
  </div>
  <div class="search-count" id="resultCount">共 ${results.length} 篇手记${state.query ? ' · 搜索结果' : ''}</div>
  <div class="entry-list" id="entryResults">${entriesCards(results,state.query)}</div>
  <p class="footer-note">WRITE TO REMEMBER · 每一页都是自己的时间</p>`;
}
