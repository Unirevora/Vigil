import {icon} from '../icons.js';
import {dateParts,escapeHtml,charCount,excerpt,humanDate} from '../../core/format.js';

export function entriesCards(items, query = '') {
  if (!items.length) return `<div class="empty">
    <div class="empty-icon">${icon('book')}</div><h3>${query ? '没有找到相应手记' : '还没有手记'}</h3>
    <p>${query ? '试试更短的关键词，或换一种说法。' : '空白的第一张纸，正等着你落笔。'}</p>
    ${query ? '<button class="btn" data-action="clear-search">清除搜索</button>' : `<button class="btn btn-primary" data-action="new">${icon('plus')} 新建手记</button>`}
  </div>`;
  return items.map(e => {
    const d=dateParts(e.date);
    return `<button type="button" class="entry-card" data-action="read" data-id="${escapeHtml(e.id)}">
      <div class="entry-date"><span class="entry-day">${d.day}</span><span class="entry-month">${d.month}</span></div>
      <div class="entry-info">
        <div class="entry-title">${escapeHtml(e.title || '未命名手记')}</div>
        <div class="entry-desc">${escapeHtml(excerpt(e.content))}</div>
        <div class="entry-meta"><span>${charCount(e.content)} 字</span>${e.demo ? '<span class="tag">示例手记</span>' : ''}<span>·</span><span>${escapeHtml(humanDate(e.date))}</span></div>
      </div>${icon('arrow','entry-arrow')}
    </button>`;
  }).join('');
}
