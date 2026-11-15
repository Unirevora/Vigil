import {icon} from '../icons.js';
import {escapeHtml,humanDate,excerpt} from '../../core/format.js';

export function entriesCards(entries,query=''){
  if(!entries.length) return `<div class="empty"><div class="empty-icon">${icon('book')}</div><h3>${query?'没有找到相关手记':'还没有写下手记'}</h3><p>${query?'试试其他关键词':'从今天开始吧。'}</p><button class="btn btn-primary" data-action="${query?'clear-search':'new'}">${query?'清除筛选':'开始写作'}</button></div>`;
  return entries.map(e=>`<article class="note-card">
      <button class="note-link" data-action="read" data-id="${escapeHtml(e.id)}">
        <div class="note-date">${escapeHtml(humanDate(e.date))}</div>
        <h3>${escapeHtml(e.title||'未命名手记')}</h3>
        <p>${escapeHtml(excerpt(e.content))}</p>
        <div class="note-tags">${(e.tags||[]).slice(0,3).map(tag=>`<span class="pill">${escapeHtml(tag)}</span>`).join('')}
          ${e.mood?`<span class="pill mood">${escapeHtml(e.mood)}</span>`:''}</div>
      </button>
      <button class="favorite-button ${e.favorite?'is-favorite':''}" data-action="favorite" data-id="${escapeHtml(e.id)}" title="${e.favorite?'取消收藏':'收藏手记'}" aria-label="${e.favorite?'取消收藏':'收藏手记'}">${icon('star')}</button>
    </article>`).join('');
}
