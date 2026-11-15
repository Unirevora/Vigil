/** Sliding underline for every `.vigil-tabs` bar (All notes, Calendar & almanac, Settings).
 *
 * Views are re-rendered with innerHTML, so the newly created active tab is born in its
 * final state and a CSS transition never runs. Each bar therefore gets one indicator
 * element; we remember where it was (per tablist aria-label) and, after a re-render,
 * animate it from the old tab to the new one with the Web Animations API.
 */
const previous=new Map();
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

function measure(bar,tab){
  const inset=parseFloat(getComputedStyle(bar).getPropertyValue('--vigil-tab-inset'))||12;
  return {x:tab.offsetLeft+inset,w:Math.max(10,tab.offsetWidth-inset*2)};
}

export function syncTabIndicators(root=document,{animate=true}={}){
  for(const bar of root.querySelectorAll('.vigil-tabs')){
    const tab=bar.querySelector('.vigil-tab.active,.vigil-tab[aria-selected="true"]');
    let indicator=bar.querySelector(':scope > .vigil-tab-indicator');
    if(!indicator){
      indicator=document.createElement('span');
      indicator.className='vigil-tab-indicator';
      indicator.setAttribute('aria-hidden','true');
      bar.append(indicator);
    }
    bar.classList.add('has-indicator');
    if(!tab){indicator.style.opacity='0';continue;}
    const key=bar.getAttribute('aria-label')||'';
    const next=measure(bar,tab),last=previous.get(key);
    previous.set(key,next);
    indicator.style.opacity='1';
    indicator.style.width=`${next.w}px`;
    indicator.style.transform=`translateX(${next.x}px)`;
    if(animate&&last&&(last.x!==next.x||last.w!==next.w)&&!reducedMotion()&&indicator.animate){
      indicator.animate([
        {transform:`translateX(${last.x}px)`,width:`${last.w}px`},
        {transform:`translateX(${next.x}px)`,width:`${next.w}px`}
      ],{duration:440,easing:'cubic-bezier(.2,.9,.25,1.12)'});
    }
  }
}

/** Re-measure without animating (layout changes: resize, web fonts finished loading). */
export function watchTabIndicatorLayout(){
  let frame=0;
  const settle=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>syncTabIndicators(document,{animate:false}));};
  addEventListener('resize',settle,{passive:true});
  document.fonts?.ready?.then(settle).catch(()=>{});
}
