/**
 * Gentle paper-slip entrance motion, using composited transforms only.
 * No element is hidden before JS initialization, preserving no-JS readability.
 * Respects prefers-reduced-motion and avoids rerendering text areas.
 */
let activeObserver=null;
export function motionAllowed(){
  return document.documentElement.dataset.motion!=='off' && typeof matchMedia==='function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Animate the existing editor between measured frames without scaling its text. */
export function animateEditorFrame(page,previous){
  if(!page||!previous||!motionAllowed()||typeof page.animate!=='function')return null;
  const next=page.getBoundingClientRect();
  // Resolve auto margins once: interpolating width must not also recenter the frame.
  const style=getComputedStyle(page);
  const size=rect=>({width:rect.width+'px',maxWidth:rect.width+'px',height:rect.height+'px',
    marginLeft:style.marginLeft,marginRight:style.marginRight});
  const easing=getComputedStyle(document.documentElement).getPropertyValue('--vigil-ease').trim()||'ease-out';
  return page.animate([
    {...size(previous),transform:`translate(${previous.left-next.left}px,${previous.top-next.top}px)`},
    {...size(next),transform:'translate(0,0)'}
  ],{duration:document.documentElement.dataset.motion==='subtle'?220:420,easing});
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
      const subtle=document.documentElement.dataset.motion==='subtle';
      node.animate([
        {offset:0,opacity:subtle?.75:.45,transform:subtle?'translate3d(0,5px,0)':'translate3d(0,14px,0) scale(.989)'},
        {offset:.72,opacity:1,transform:subtle?'translate3d(0,0,0)':'translate3d(0,-2px,0) scale(1.005)'},
        {offset:1,opacity:1,transform:'translate3d(0,0,0) scale(1)'}
      ],{duration:subtle?220:450,delay:Math.min(index,8)*(subtle?15:34),easing:'cubic-bezier(.2,.8,.25,1)'});
    }
  },{threshold:.08,rootMargin:'0px 0px -20px 0px'});
  for(const node of elements)activeObserver.observe(node);
}
