import {icon} from '../icons.js';
import {dateParts,escapeHtml,charCount,excerpt,humanDate} from '../../core/format.js';

export function entriesCards(items,query='') {
  if (!items.length) {
    return `<div class="empty">
      <div class="empty-icon">${icon('book')}</div>
      <div class="empty-no">— NO RECORD —</div>
      <h3>${query?'未找到相关手记':'此处尚未落笔'}</h3>
      <p>${query?'换个词试试，或清除搜索。':'一切故事都从第一张纸开始。'}</p>
      <button class="btn btn-primary" data-action="${query?'clear-search':'new'}">
        ${icon(query?'close':'plus')} ${query?'清除搜索':'开始写一篇'}
      </button>
    </div>`;
  }
  return items.map((entry,index)=>{
    const d=dateParts(entry.date);
    return `<button class="entry-card" type="button" data-action="read" data-id="${escapeHtml(entry.id)}">
      <span class="entry-index" aria-hidden="true">${String(index+1).padStart(2,'0')}</span>
      <span class="entry-date"><span class="entry-day">${d.day}</span><span class="entry-month">${d.month}</span></span>
      <span class="entry-info">
        <span class="entry-title">${escapeHtml(entry.title||'未命名手记')}</span>
        <span class="entry-desc">${escapeHtml(excerpt(entry.content))}</span>
        <span class="entry-meta">
          <span>${charCount(entry.content)} 字</span>
          <i></i>
          <span>${escapeHtml(humanDate(entry.date))}</span>
          ${entry.demo?'<span class="tag">演示</span>':''}
        </span>
      </span>
      <span class="entry-open">${icon('arrow')}</span>
    </button>`;
  }).join('');
}
