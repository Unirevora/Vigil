import {icon} from '../icons.js';
import {escapeHtml,humanDate,excerpt,charCount,editorialMonthLabel,isBriefNote} from '../../core/format.js';

export function entriesCards(entries,query='',{editorial=false}={}){
  if(!entries.length) return `<div class="empty"><div class="empty-icon">${icon('book')}</div><h3>${query?'没有找到相关手记':'还没有写下手记'}</h3><p>${query?'试试其他关键词':'从今天开始吧。'}</p><button class="btn btn-primary" data-action="${query?'clear-search':'new'}">${query?'清除筛选':'开始写作'}</button></div>`;
  const monthTotals=new Map();
  if(editorial){
    for(const item of entries){
      const ym=String(item.date||'').slice(0,7);
      monthTotals.set(ym,(monthTotals.get(ym)||0)+1);
    }
  }
  const showDividers=editorial && entries.length>=2;
  let lastMonth='';
  const chunks=[];
  entries.forEach((e,index)=>{
    const ym=String(e.date||'').slice(0,7);
    if(showDividers && ym && ym!==lastMonth){
      lastMonth=ym;
      const label=editorialMonthLabel(ym);
      chunks.push(`<div class="editorial-month-divider" role="separator" aria-label="${escapeHtml(label)}">
        <span class="editorial-month-title">${escapeHtml(label)}</span>
        <span class="editorial-month-rule" aria-hidden="true"></span>
        <small class="editorial-month-count">${monthTotals.get(ym)||0} 篇</small>
      </div>`);
    }
    const lead=editorial && index===0 && entries.length>=2;
    const brief=!lead && isBriefNote(e.content);
    const words=charCount(e.content);
    const summary=excerpt(e.content,lead?165:brief?96:88);
    const classes=['note-card',lead?'note-card-lead':'',brief?'note-card-aphorism':''].filter(Boolean).join(' ');
    chunks.push(`<article class="${classes}" data-entry-card="${escapeHtml(e.id)}">
      <button class="note-link" data-action="read" data-id="${escapeHtml(e.id)}">
        <div class="note-date"><span>${escapeHtml(humanDate(e.date))}</span>${lead?'<span class="note-lead-badge">卷首</span>':''}<span class="note-words">${words} 字</span></div>
        <h3>${escapeHtml(e.title||'未命名手记')}</h3>
        <p>${escapeHtml(summary)}</p>
        <div class="note-tags">${(e.tags||[]).slice(0,lead?5:3).map(tag=>`<span class="pill">${escapeHtml(tag)}</span>`).join('')}
          ${e.mood?`<span class="pill mood">${escapeHtml(e.mood)}</span>`:''}</div>
      </button>
      <button class="favorite-button ${e.favorite?'is-favorite':''}" data-action="favorite" data-id="${escapeHtml(e.id)}" title="${e.favorite?'取消收藏':'收藏手记'}" aria-label="${e.favorite?'取消收藏':'收藏手记'}">${icon('star')}</button>
    </article>`);
  });
  return chunks.join('');
}
