import {icon} from '../icons.js';
import {filterEntries} from '../../core/entries.js';
import {escapeHtml} from '../../core/format.js';
import {entriesCards} from './entry-cards.js';
import {pageHeading} from './page-heading.js';

export function entriesView(state) {
  const f=state.filters||{},items=filterEntries(state.entries,state.query,state.order,f);
  const allTags=[...new Set(state.entries.flatMap(e=>e.tags||[]))].sort((a,b)=>a.localeCompare(b,'zh-CN')).slice(0,24);
  const active=Boolean(state.query?.trim()||f.favorite||f.tag||f.month||f.day||f.recent||f.pending);
  const actions=`<button class="btn btn-primary" data-action="new">${icon('plus')} 新手记</button>`;
  return `${pageHeading({title:'全部手记',count:items.length,description:'搜寻、收藏或重新阅读。',actions})}
    <div class="filter-panel">
      <div class="searchbox">${icon('search')}<input id="searchInput" class="search-input" value="${escapeHtml(state.query)}" placeholder="搜索标题、正文或标签…" aria-label="搜索手记" autocomplete="off"></div>
      <div class="filter-line" role="group" aria-label="快速筛选">
        <button class="filter-chip ${!active?'selected':''}" aria-pressed="${!active}" data-action="filter-all">全部</button>
        <button class="filter-chip ${f.favorite?'selected':''}" aria-pressed="${Boolean(f.favorite)}" data-action="filter-favorite">${icon('star')} 收藏</button>
        <button class="filter-chip ${f.recent?'selected':''}" aria-pressed="${Boolean(f.recent)}" data-action="filter-recent">${icon('calendar')} 最近 7 天</button>
        <button class="filter-chip ${f.pending?'selected':''}" aria-pressed="${Boolean(f.pending)}" data-action="filter-pending">${icon('check')} 有待办</button>
        <button class="filter-chip filter-order" data-action="toggle-order" title="切换日期排序">${state.order==='desc'?'最新优先':'最早优先'} ${icon('clock')}</button>
        ${f.month||f.day?`<button class="filter-chip selected" data-action="clear-filter">${escapeHtml(f.day||f.month)} ${icon('close')}</button>`:''}
        <button class="filter-reset" data-action="reset-list-filters" title="清除所有搜索和筛选" ${active?'':'hidden'}>清除条件</button>
      </div>
      ${allTags.length?`<div class="tag-filters"><button class="tag-option ${!f.tag?'active':''}" data-action="filter-tag" data-tag="">全部标签</button>${allTags.map(tag=>`<button class="tag-option ${f.tag===tag?'active':''}" data-action="filter-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>`:''}
    </div>
    <div class="section-title compact entry-results-head">
      <div><h2>手记列表</h2><span class="muted-count" id="resultCount" aria-live="polite">${items.length} 篇</span></div>
      <button class="text-button export-current" data-action="export-filtered" ${state.corruptStorage||!items.length?'disabled':''} title="仅导出当前筛选到的手记，原文不会改变">${icon('download')} 导出当前结果</button>
    </div>
    <div class="note-grid" id="entryResults">${entriesCards(items,active?'已筛选':'')}</div>`;
}
