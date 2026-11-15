import {sortEntries} from '../../core/entries.js';
import {escapeHtml,humanDate,todayISO,excerpt} from '../../core/format.js';

export function heroPaper(state) {
  const latest=sortEntries(state.entries,state.order)[0];
  return `<div class="hero-art" aria-hidden="true"><div class="paper-preview">
    <div class="paper-top"><span>${escapeHtml(latest ? humanDate(latest.date) : humanDate(todayISO()))}</span><span>手记 · 第 ${Math.max(state.entries.length,1)} 页</span></div>
    <div class="paper-rule"></div>
    <div class="paper-heading">${escapeHtml(latest?.title || '写下今天的第一句话')}</div>
    <div class="paper-text">${escapeHtml(latest ? excerpt(latest.content) : '让文字，成为留给时间的一束微光。')}</div>
    <div class="paper-seal">留<br>白</div>
  </div></div>`;
}
