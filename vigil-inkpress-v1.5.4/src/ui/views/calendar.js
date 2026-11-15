import {icon} from '../icons.js';
import {calendarDays,archiveMonths,yearsAgoToday} from '../../core/calendar.js';
import {almanacForDate,solarTermOn} from '../../core/almanac.js';
import {escapeHtml,todayISO,humanDate} from '../../core/format.js';

export function calendarView(state,{embedded=false}={}) {
  const month=state.calendarMonth;
  const date=state.calendarSelected?.slice(0,7)===month
    ?state.calendarSelected
    :(todayISO().startsWith(month)?todayISO():`${month}-01`);
  const selected=almanacForDate(date);
  const monthLabel=month.replace('-','年')+'月';
  const days=calendarDays(month),byDate=new Map();
  for(const item of state.entries){
    if(!byDate.has(item.date))byDate.set(item.date,[]);
    byDate.get(item.date).push(item);
  }
  const archives=archiveMonths(state.entries),memories=yearsAgoToday(state.entries);
  const notes=byDate.get(date)||[];
  return `${embedded?'':`<div class="page-head">
    <div><div class="page-eyebrow">岁时日历 · CALENDAR</div><h1>日历与归档</h1><p>记住某一天，也记住那天的季节。</p></div>
    <button class="btn btn-quiet" data-action="nav" data-to="almanac">${icon('spark')} 风物志 ${icon('arrow')}</button>
  </div>`}
  <div class="archive-layout">
    <section class="calendar-card vintage-panel">
      <div class="calendar-top"><h2>${escapeHtml(monthLabel)}</h2><div class="head-actions">
        <button class="icon-button" aria-label="上个月" data-action="calendar-shift" data-offset="-1">${icon('back')}</button>
        <button class="btn btn-small" data-action="calendar-today">今天</button>
        <button class="icon-button" aria-label="下个月" data-action="calendar-shift" data-offset="1">${icon('chevron')}</button>
      </div></div>
      <div class="calendar-grid weekday">${['一','二','三','四','五','六','日'].map(v=>`<span>${v}</span>`).join('')}</div>
      <div class="calendar-grid days">${days.map(day=>{
        if(!day)return '<span class="day blank"></span>';
        const term=solarTermOn(day);
        const count=(byDate.get(day)||[]).length;
        return `<button type="button" class="day ${count?'has-notes':''} ${day===todayISO()?'today':''} ${day===date?'selected':''} ${term?'is-term':''}"
            data-action="calendar-day" data-date="${day}" aria-label="${day} ${term?.name||''} ${count} 篇手记">
          <span class="day-num">${Number(day.slice(8))}</span>
          ${term?`<span class="day-term">${term.name}</span>`:count?'<i></i>':''}
          </button>`;
      }).join('')}</div>
      <p class="calendar-tip">朱砂标记为节气 · 有墨点的日期写过手记</p>
    </section>
    <aside class="archive-sidebar">
      <div class="archive-mini-card vintage-panel day-details">
        <div class="side-card-head"><span>所选日期</span><span>${selected.moon.symbol}</span></div>
        <h3>${escapeHtml(humanDate(date))}</h3>
        <p class="day-lunar">${escapeHtml(selected.lunar)} · ${selected.selected.name}</p>
        <div class="day-details-verse">${selected.verse}</div>
        ${notes.length?`<div class="selected-notes">
          ${notes.map(item=>`<button data-action="read" data-id="${escapeHtml(item.id)}">${icon('book')} ${escapeHtml(item.title||'未命名手记')} ${icon('chevron')}</button>`).join('')}
          </div>`:`<p class="day-empty">这一天还没有留下手记。</p>`}
        <div class="day-details-actions"><button class="text-button" data-action="calendar-open-term" data-date="${date}">查看节令 ${icon('arrow')}</button>
          <button class="text-button" data-action="calendar-date-list" data-date="${date}">筛选手记 ${icon('chevron')}</button></div>
      </div>
      <div class="archive-mini-card vintage-panel month-archive">
        <h3>月份归档</h3>
        ${archives.length?archives.map(([m,n])=>`<button class="archive-month" data-action="calendar-month" data-month="${m}">
          <span>${escapeHtml(m.replace('-','年'))}月</span><span>${n} 篇 ${icon('chevron')}</span></button>`).join(''):'<p class="quiet">暂无手记</p>'}
      </div>
      ${memories.length?`<div class="archive-mini-card vintage-panel">
        <h3>往年今日</h3>
        ${memories.slice(0,4).map(x=>`<button class="memory-link" data-action="read" data-id="${escapeHtml(x.id)}">
          <strong>${escapeHtml(x.title)}</strong><small>${escapeHtml(x.date)}</small></button>`).join('')}
      </div>`:''}
    </aside>
  </div>`;
}
