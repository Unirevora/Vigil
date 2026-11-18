import {TERMS,almanacForDate,addChinaDays,termRingModel,solarTermsForYear} from '../core/almanac.js';
import {todayISO} from '../core/format.js';

const DAY_MS=86400000;
const chop=(s,max)=>String(s).slice(0,max);
const titleDate=iso=>`${iso.slice(0,4)} 年 ${Number(iso.slice(5,7))} 月 ${Number(iso.slice(8))} 日`;
const angleAt=(event,element)=>{
  const r=element.getBoundingClientRect();
  return Math.atan2(event.clientY-(r.top+r.height/2),event.clientX-(r.left+r.width/2));
};
const safeDate=date=>typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number(date.slice(0,4))>=1901 && Number(date.slice(0,4))<=2099;
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;

export function mountAlmanac(state) {
  const dial=document.querySelector('#seasonDial');
  if(!dial)return null;
  let timer=null,drag=null,disposed=false,lastRotation=null;
  const $=id=>document.getElementById(id);
  const nodes=[...dial.querySelectorAll('.term-node')];

  function paint(date){
    if(disposed||!safeDate(date))return false;
    state.almanacDate=date;
    const info=almanacForDate(date),ring=termRingModel(date);
    const mergedDate=$('chronicleDateLabel');
    const mergedTerm=$('chronicleTermLabel');
    if(mergedDate)mergedDate.textContent=date;
    if(mergedTerm)mergedTerm.textContent=`${info.selected.name} · ${info.hou}`;
    const printedDate=titleDate(date);
    $('dial-top-date').textContent=printedDate;
    $('dial-current-date').textContent=printedDate;
    $('dialTermName').textContent=info.selected.name;
    $('dialLunar').textContent=info.lunar;
    $('dialMoon').textContent=`${info.moon.symbol} ${info.moon.name}`;
    $('almanac-season-tag').textContent=`二十四节气 · ${info.selected.season}`;
    $('almanac-term-title').textContent=info.selected.name;
    const verticalSlip=$('almanac-vertical-slip');
    if(verticalSlip)verticalSlip.textContent=`${info.selected.season}令 · ${info.hou}`;
    $('almanac-term-range').textContent=`${info.selected.chinaDate} 起`;
    $('almanac-next-term').textContent=`下节 · ${info.next?.name||''}`;
    $('almanac-term-note').textContent=info.note;
    $('almanac-lunar-info').textContent=info.lunar;
    $('almanac-phase-info').textContent=`${info.moon.symbol} ${info.moon.name} · 示意`;
    $('almanacVerse').textContent=`「${info.verse}」`;
    dial.setAttribute('aria-valuetext',`${printedDate} · ${info.selected.name}`);
    const start=Date.UTC(Number(date.slice(0,4)),0,1);
    const current=Date.parse(date+'T00:00:00Z');
    dial.setAttribute('aria-valuenow',String(Math.floor((current-start)/DAY_MS)));
    const candidate=-ring.angle;
    const rotation=lastRotation===null?candidate:
      candidate+Math.round((lastRotation-candidate)/360)*360;
    lastRotation=rotation;
    $('dialTickRing').style.transform=`rotate(${rotation}deg)`;
    nodes.forEach((node,i)=>{
      const rad=(((i-ring.index-ring.progress)*15)-90)*Math.PI/180;
      node.style.left=`${50+42.5*Math.cos(rad)}%`;
      node.style.top=`${50+42.5*Math.sin(rad)}%`;
      node.classList.toggle('selected',i===ring.index);
      node.classList.toggle('same-season',TERMS[i].season===info.selected.season);
      node.setAttribute('aria-pressed',String(i===ring.index));
    });
    const houItems=document.querySelectorAll('#almanacHouList .hou-item');
    [...houItems].forEach((node,i)=>{
      node.classList.toggle('active',i===info.houIndex);
      const strong=node.querySelector('strong');
      if(strong)strong.textContent=info.selected.hou[i];
    });
    state.almanacPreview=date!==todayISO();
    return true;
  }
  function autoReset(){
    clearTimeout(timer);
    if(state.almanacDate!==todayISO()){
      timer=setTimeout(()=>{
        if(disposed)return;
        dial.classList.add('returning');
        paint(todayISO());
        timer=setTimeout(()=>dial.classList.remove('returning'),600);
      },3000);
    }
  }
  function preview(date,{returnAutomatically=false}={}){
    if(!paint(date))return false;
    if(returnAutomatically)autoReset();
    return true;
  }
  function reset(){
    clearTimeout(timer);
    dial.classList.toggle('returning',!reduced());
    paint(todayISO());
    timer=setTimeout(()=>dial.classList.remove('returning'),610);
  }
  function onWheel(event){
    event.preventDefault();
    // The wheel turns in the same visual direction as the solar term labels.
    const days=event.deltaY>0?-1:1;
    preview(addChinaDays(state.almanacDate,days));
  }
  function onKey(event){
    const keys=['ArrowLeft','ArrowRight','PageUp','PageDown','Home','Escape'];
    if(!keys.includes(event.key))return;
    event.preventDefault();
    if(event.key==='Home'||event.key==='Escape'){reset();return;}
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      preview(addChinaDays(state.almanacDate,event.key==='ArrowRight'?1:-1));
      return;
    }
    const info=almanacForDate(state.almanacDate);
    if(event.key==='PageDown'&&info.next)preview(info.next.chinaDate);
    if(event.key==='PageUp'){
      if(state.almanacDate>info.selected.chinaDate)preview(info.selected.chinaDate);
      else preview(addChinaDays(info.selected.chinaDate,-1));
    }
  }
  function onPointerDown(event){
    if(event.button!==0||event.target.closest('button'))return;
    const rect=dial.getBoundingClientRect();
    const dx=event.clientX-(rect.left+rect.width/2);
    const dy=event.clientY-(rect.top+rect.height/2);
    // Keep the central text interactive without accidental wheel-drag.
    if(Math.hypot(dx,dy)<rect.width*.16)return;
    drag={startAngle:angleAt(event,dial),startDate:state.almanacDate};
    clearTimeout(timer);
    dial.classList.add('is-dragging');
    dial.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event){
    if(!drag)return;
    const radians=angleAt(event,dial)-drag.startAngle;
    const wrapped=((radians+Math.PI*3)%(Math.PI*2))-Math.PI;
    // Dragging the rim clockwise moves the labels clockwise (earlier dates).
    const days=-Math.round(wrapped/(2*Math.PI)*365.2422);
    paint(addChinaDays(drag.startDate,days));
  }
  function endPointer(){
    if(!drag)return;
    drag=null;
    dial.classList.remove('is-dragging');
  }
  function onTermClick(event){
    const node=event.target.closest('[data-term-index]');
    if(!node)return;
    const year=Number(state.almanacDate.slice(0,4));
    const term=solarTermsForYear(year)[Number(node.dataset.termIndex)];
    if(term)preview(term.chinaDate);
  }
  dial.addEventListener('wheel',onWheel,{passive:false});
  dial.addEventListener('keydown',onKey);
  dial.addEventListener('pointerdown',onPointerDown);
  dial.addEventListener('pointermove',onPointerMove);
  dial.addEventListener('pointerup',endPointer);
  dial.addEventListener('pointercancel',endPointer);
  dial.addEventListener('click',onTermClick);
  paint(state.almanacDate);
  return {
    preview,reset,
    destroy(){
      disposed=true;clearTimeout(timer);drag=null;
      dial.removeEventListener('wheel',onWheel);
      dial.removeEventListener('keydown',onKey);
      dial.removeEventListener('pointerdown',onPointerDown);
      dial.removeEventListener('pointermove',onPointerMove);
      dial.removeEventListener('pointerup',endPointer);
      dial.removeEventListener('pointercancel',endPointer);
      dial.removeEventListener('click',onTermClick);
    }
  };
}
