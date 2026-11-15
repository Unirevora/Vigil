import {icon} from '../icons.js';
import {escapeHtml} from '../../core/format.js';
import {TERMS,almanacForDate,termRingModel} from '../../core/almanac.js';

export function almanacView(state,{embedded=false}={}){
  const date=state.almanacDate;
  const info=almanacForDate(date),ring=termRingModel(date);
  const formattedDate=`${date.slice(0,4)} 年 ${Number(date.slice(5,7))} 月 ${Number(date.slice(8))} 日`;
  const isPreview=state.almanacPreview===true;
  const nodes=TERMS.map((term,index)=>{
    const radians=(((index-ring.index-ring.progress)*15)-90)*Math.PI/180;
    const left=(50+42.5*Math.cos(radians)).toFixed(3);
    const top=(50+42.5*Math.sin(radians)).toFixed(3);
    return `<button type="button" class="term-node ${index===ring.index?'selected':''} ${term.season===info.selected.season?'same-season':''}"
      data-term-index="${index}" title="${term.name}" aria-label="预览${term.name}"
      style="left:${left}%;top:${top}%">${term.name}</button>`;
  }).join('');
  return `<section class="almanac-page">
    ${embedded?'':`<header class="page-head">
      <div><div class="page-eyebrow">风物志 · SEASONS</div><h1>廿四节气</h1><p>循岁时而行，观四季风物。</p></div>
      <button class="btn btn-quiet" data-action="almanac-reset">${icon('refresh')} 回到今天</button>
    </header>`}
    <div class="almanac-layout">
      <div class="dial-panel vintage-panel">
        <div class="dial-panel-top"><span>四时轮转</span><span id="dial-top-date">${formattedDate}</span></div>
        <div class="dial-frame">
          <div class="season-dial" id="seasonDial" tabindex="0" role="slider"
             aria-label="风物节气盘。可拖动、滚轮或方向键预览日期"
             aria-valuemin="0" aria-valuemax="365" aria-valuenow="${Number(date.slice(5,7))}"
             aria-valuetext="${formattedDate} ${info.selected.name}">
            <div class="dial-tick-ring" id="dialTickRing" style="transform:rotate(${-ring.angle*1}deg)"></div>
            <div class="dial-inner-ring" aria-hidden="true"></div>
            <div class="term-nodes" id="termNodes">${nodes}</div>
            <div class="dial-center" id="dialCenter">
              <span class="dial-center-minor">公历 ${date.slice(0,4)}</span>
              <span class="dial-center-term" id="dialTermName">${info.selected.name}</span>
              <span class="dial-center-date" id="dialLunar">${escapeHtml(info.lunar)}</span>
              <span class="dial-center-moon" id="dialMoon">${info.moon.symbol} ${info.moon.name}</span>
            </div>
            <span class="dial-pointer" aria-hidden="true"></span>
          </div>
        </div>
        <div class="dial-controls"><button class="btn btn-small" data-action="almanac-day" data-days="-1">${icon('back')} 前一日</button>
          <span id="dial-current-date">${formattedDate}</span>
          <button class="btn btn-small" data-action="almanac-day" data-days="1">后一日 ${icon('chevron')}</button></div>
        <p class="dial-hint">拖动节气盘或使用滚轮、方向键漫游；选择会保留，点击「回到今天」重置。</p>
      </div>
      <div class="season-notes">
        <div class="season-current vintage-panel">
          <div class="season-current-top"><span id="almanac-season-tag">二十四节气 · ${info.selected.season}</span><span class="seal-mini">时</span></div>
          <h2 id="almanac-term-title">${info.selected.name}</h2>
          <div class="term-times"><span id="almanac-term-range">${info.selected.chinaDate} 起</span><span id="almanac-next-term">下节 · ${info.next?.name||''}</span></div>
          <p id="almanac-term-note">${info.note}</p>
          <div class="lunar-meta"><span id="almanac-lunar-info">${escapeHtml(info.lunar)}</span><span id="almanac-phase-info">${info.moon.symbol} ${info.moon.name} <small>· 示意</small></span></div>
        </div>
        <div class="hou-panel vintage-panel">
          <div class="hou-heading"><h3>节气三候</h3><span>每候约五日</span></div>
          <div class="hou-list" id="almanacHouList">${info.selected.hou.map((hou,index)=>`<div class="hou-item ${index===info.houIndex?'active':''}">
            <span class="hou-index">${['初候','二候','三候'][index]}</span><strong>${hou}</strong></div>`).join('')}</div>
        </div>
      </div>
    </div>
    <div class="season-verse vintage-panel">
      <div class="season-verse-overline">节令短笺</div><blockquote id="almanacVerse">「${info.verse}」</blockquote>
      <p>为风物界面创作的短句 · 非古诗引文</p>
    </div>
    <div class="almanac-footnote">节气日期依据太阳视黄经估算，按北京时间（UTC+8）显示；月相为近似示意，非天文历表。</div>
  </section>`;
}
