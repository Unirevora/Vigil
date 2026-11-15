/**
 * Gentle paper-slip entrance motion, using composited transforms only.
 * No element is hidden before JS initialization, preserving no-JS readability.
 * Respects prefers-reduced-motion and avoids rerendering text areas.
 */
let activeObserver=null;
export function motionAllowed(){
  return typeof matchMedia==='function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function playEntranceMotion(container){
  activeObserver?.disconnect();
  activeObserver=null;
  if(!container||!motionAllowed()||typeof IntersectionObserver==='undefined')return;
  const elements=[...container.querySelectorAll([
    '.heritage-hero','.heritage-stat','.season-teaser','.draft-banner',
    '.home-recent-head','.note-card','.filter-panel',
    '.reading-paper','.editor-paper','.archive-mini-card','.calendar-card',
    '.dial-panel','.season-current','.hou-panel','.season-verse',
    '.github-files','.github-detail','.github-connect','.data-action-card',
    '.secure-backup-strip','.data-summary > div'
  ].join(','))].slice(0,30);
  activeObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const node=entry.target;
      activeObserver?.unobserve(node);
      if(!node.isConnected || typeof node.animate!=='function')continue;
      const index=Math.max(0,elements.indexOf(node));
      // One lightweight overshoot, rather than bouncing every descendant.
      node.animate([
        {offset:0,opacity:.45,transform:'translate3d(0,14px,0) scale(.989)'},
        {offset:.72,opacity:1,transform:'translate3d(0,-2px,0) scale(1.005)'},
        {offset:1,opacity:1,transform:'translate3d(0,0,0) scale(1)'}
      ],{duration:450,delay:Math.min(index,8)*34,easing:'cubic-bezier(.2,.8,.25,1)'});
    }
  },{threshold:.08,rootMargin:'0px 0px -20px 0px'});
  for(const node of elements)activeObserver.observe(node);
}
