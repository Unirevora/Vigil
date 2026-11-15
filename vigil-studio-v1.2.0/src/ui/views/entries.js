import {icon} from '../icons.js';
import {filterEntries} from '../../core/entries.js';
import {escapeHtml} from '../../core/format.js';
import {entriesCards} from './entry-cards.js';

export function entriesView(state) {
  const f=state.filters||{},items=filterEntries(state.entries,state.query,state.order,f);
  const allTags=[...new Set(state.entries.flatMap(e=>e.tags||[]))].sort((a,b)=>a.localeCompare(b,'zh-CN')).slice(0,24);
  return `<div class="page-head"><div><h1>全部手记 <span class="count-small">${items.length}</span></h1><p>搜寻、收藏或重新阅读。</p></div>
    <button class="btn btn-primary" data-action="new">${icon('plus')} 新手记</button></div>
    <div class="filter-panel">
      <div class="searchbox">${icon('search')}<input id="searchInput" class="search-input" value="${escapeHtml(state.query)}" placeholder="搜索标题、正文或标签…" aria-label="搜索手记" autocomplete="off"></div>
      <div class="filter-line">
        <button class="filter-chip ${!f.favorite?'selected':''}" data-action="filter-all">全部</button>
        <button class="filter-chip ${f.favorite?'selected':''}" data-action="filter-favorite">${icon('star')} 收藏</button>
        <button class="filter-chip" data-action="toggle-order">${state.order==='desc'?'最新优先':'最早优先'} ${icon('clock')}</button>
        ${f.month||f.day?`<button class="filter-chip selected" data-action="clear-filter">${escapeHtml(f.day||f.month)} ${icon('close')}</button>`:''}
      </div>
      ${allTags.length?`<div class="tag-filters"><button class="tag-option ${!f.tag?'active':''}" data-action="filter-tag" data-tag="">全部标签</button>${allTags.map(tag=>`<button class="tag-option ${f.tag===tag?'active':''}" data-action="filter-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>`:''}
    </div>
    <div class="section-title compact"><h2>手记列表</h2><span class="muted-count" id="resultCount">${items.length} 篇</span></div>
    <div class="note-grid" id="entryResults">${entriesCards(items,state.query)}</div>`;
}
