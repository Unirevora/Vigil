import {icon} from '../icons.js';
import {calendarDays,archiveMonths,yearsAgoToday} from '../../core/calendar.js';
import {escapeHtml,todayISO} from '../../core/format.js';

export function calendarView(state) {
  const month=state.calendarMonth;
  const monthLabel=month.replace('-','年')+'月';
  const dates=calendarDays(month),count=new Map();
  state.entries.forEach(e=>count.set(e.date,(count.get(e.date)||0)+1));
  const archives=archiveMonths(state.entries);
  const memories=yearsAgoToday(state.entries);
  return `<div class="page-head"><div><h1>日历与归档</h1><p>在时间里找回过去的文字。</p></div>
    <button class="btn" data-action="nav" data-to="entries">查看全部 ${icon('arrow')}</button></div>
    <div class="archive-layout">
      <section class="calendar-card">
        <div class="calendar-top"><h2>${escapeHtml(monthLabel)}</h2><div class="head-actions">
          <button class="icon-button" aria-label="上个月" data-action="calendar-shift" data-offset="-1">${icon('back')}</button>
          <button class="btn btn-small" data-action="calendar-today">本月</button>
          <button class="icon-button" aria-label="下个月" data-action="calendar-shift" data-offset="1">${icon('chevron')}</button>
        </div></div>
        <div class="calendar-grid weekday">${['一','二','三','四','五','六','日'].map(x=>`<span>${x}</span>`).join('')}</div>
        <div class="calendar-grid days">${dates.map(day=>day?
          `<button class="day ${count.has(day)?'has-notes':''} ${day===todayISO()?'today':''}" data-action="calendar-day" data-date="${day}" title="${count.get(day)||0} 篇手记">${Number(day.slice(8))}${count.has(day)?'<i></i>':''}</button>`
          :'<span class="day blank"></span>').join('')}</div>
        <p class="calendar-tip">有圆点的日期表示写过手记。点击日期查看对应记录。</p>
      </section>
      <aside class="archive-sidebar">
        <div class="archive-mini-card"><h3>月份归档</h3>${archives.length?archives.map(([m,n])=>`<button class="archive-month" data-action="calendar-month" data-month="${m}"><span>${escapeHtml(m.replace('-','年'))}月</span><span>${n} 篇 ${icon('chevron')}</span></button>`).join(''):'<p class="quiet">暂无手记</p>'}</div>
        <div class="archive-mini-card"><h3>往年今日</h3>${memories.length?memories.map(e=>`<button class="memory-link" data-action="read" data-id="${escapeHtml(e.id)}"><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(e.date)}</small></button>`).join(''):'<p class="quiet">过去的今天，还没有留下手记。</p>'}</div>
      </aside>
    </div>`;
}
