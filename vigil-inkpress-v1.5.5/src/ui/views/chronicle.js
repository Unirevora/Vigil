import {icon} from '../icons.js';
import {calendarView} from './calendar.js';
import {almanacView} from './almanac.js';
import {todayISO} from '../../core/format.js';
import {almanacForDate} from '../../core/almanac.js';
import {pageHeading} from './page-heading.js';

/** A shared date context, two complementary views: writing history and seasonal history. */
export function chronicleView(state){
  const selected=state.seasonTab==='almanac'?'almanac':'calendar';
  const date=selected==='almanac'?state.almanacDate:state.calendarSelected;
  const info=almanacForDate(date);
  const tabs=[
    ['calendar','日历归档','calendar'],
    ['almanac','节气风物','spark']
  ];
  return `<section class="chronicle-page">
    ${pageHeading({title:'日历与风物',description:'从手记的日子，走进四时的节令。',className:'chronicle-page-head',actions:`<button class="btn btn-quiet chronicle-return" data-action="chronicle-today">${icon('refresh')} 回到今天</button>`})}
    <div class="chronicle-navigation">
      <div class="chronicle-tabs" role="tablist" aria-label="岁时视图">
        ${tabs.map(([key,label,symbol])=>`<button type="button" id="chronicle-tab-${key}" data-action="season-tab" data-tab="${key}"
          class="chronicle-tab ${selected===key?'active':''}" role="tab" aria-controls="chronicle-tabpanel"
          aria-selected="${selected===key}" tabindex="${selected===key?'0':'-1'}">${icon(symbol)} ${label}</button>`).join('')}
      </div>
      <div class="chronicle-current" aria-live="off"><strong id="chronicleDateLabel">${date}</strong><span id="chronicleTermLabel">${info.selected.name} · ${info.hou}</span></div>
    </div>
    <div id="chronicle-tabpanel" class="chronicle-content" role="tabpanel" tabindex="0"
      aria-labelledby="chronicle-tab-${selected}">
      ${selected==='calendar'?calendarView(state,{embedded:true}):almanacView(state,{embedded:true})}
    </div>
    <p class="chronicle-note">节气按北京时间估算；传统三候与月相为风物参考，不代替精密天文历表。</p>
  </section>`;
}
