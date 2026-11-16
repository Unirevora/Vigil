/** One pointer listener, one scheduled update, one set of shared 3D variables.
 * Float complete surfaces, never both a surface and its children. No wrappers,
 * pointer-time geometry reads, per-card listeners or perpetual rendering loop. */
const SURFACES=[
  '.page-head','.heritage-hero','.heritage-stat','.illustrated-slip','.season-teaser',
  '.home-quick-row','.home-recent-head','.note-card','.filter-panel','.vintage-panel',
  '.season-current','.hou-panel','.dial-panel','.season-verse','.surface','.link-panel','.topic-panel',
  '.reading-paper','.editor-stage','.editor-topline','.calendar-card','.archive-mini-card',
  '.insight-metric','.insight-panel','.settings-hub-panel','.github-connect','.github-files',
  '.github-detail','.notebook-unlinked','.notebook-repo-strip','.data-action-card',
  '.data-summary','.secure-backup-strip','.vigil-tabs','.pagination-card','.modal',
  '.command-dialog','.passphrase-dialog','.vigil-select-popup','.toast','.glass-dock',
  '.btn','.icon-button','.settings-reset'
].join(',');
const EXCLUDED='.sidebar,.topbar';
const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:.5));
export function floatingPose(x,y,subtle=false,intensity=50){
  const nx=clamp(x)*2-1,ny=clamp(y)*2-1;
  const distance=Math.hypot(nx,ny);
  return {axisX:distance?-ny/distance:0,axisY:distance?nx/distance:1,
    angle:Math.min(1,distance)*(subtle?.35:.85)*clamp(intensity/100)*2};
}

export function createFloatingSurfaces(root=document.documentElement){
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer=window.matchMedia('(hover: hover) and (pointer: fine)');
  let enabled=true,motion='standard',intensity=50,active=false,frame=0,scan=0,x=.5,y=.5,destroyed=false;
  let surfaces=[],scenes=[];
  function clear(){
    for(const node of surfaces){node.removeAttribute('data-floating-surface');node.style.removeProperty('--float-existing-transition');}
    for(const node of scenes)node.removeAttribute('data-floating-scene');
    surfaces=[];scenes=[];
  }
  function refresh(){
    scan=0;if(!active||destroyed)return;
    const next=[...document.querySelectorAll(SURFACES)].filter(node=>
      !node.closest(EXCLUDED)&&!node.parentElement?.closest(SURFACES));
    for(const node of surfaces)if(!next.includes(node)){node.removeAttribute('data-floating-surface');node.style.removeProperty('--float-existing-transition');}
    for(const node of next)if(!node.hasAttribute('data-floating-surface')){
      const transition=getComputedStyle(node).transition;
      node.style.setProperty('--float-existing-transition',transition.startsWith('none')?'transform 0s':transition);
    }
    surfaces=next;
    const parents=[...new Set(next.map(node=>node.parentElement).filter(node=>node&&node!==document.body))];
    for(const node of scenes)if(!parents.includes(node))node.removeAttribute('data-floating-scene');
    scenes=parents;
    for(const node of scenes)node.setAttribute('data-floating-scene','');
    for(const node of surfaces)node.setAttribute('data-floating-surface','');
  }
  function paint(){
    frame=0;if(!active)return;
    const pose=floatingPose(x,y,motion==='subtle',intensity);
    root.style.setProperty('--float-axis-x',String(pose.axisX));
    root.style.setProperty('--float-axis-y',String(pose.axisY));
    root.style.setProperty('--float-angle',pose.angle.toFixed(4)+'deg');
    root.style.setProperty('--float-depth',(intensity/50*3).toFixed(2)+'px');
  }
  function queue(){if(active&&!frame)frame=requestAnimationFrame(paint);}
  function move(event){
    if(!active||event.pointerType==='touch'||event.buttons)return;
    x=event.clientX/Math.max(1,window.innerWidth);y=event.clientY/Math.max(1,window.innerHeight);queue();
  }
  function rest(){x=.5;y=.5;queue();}
  function update(){
    const next=enabled&&motion!=='off'&&!reduced.matches&&pointer.matches&&!document.hidden;
    active=next;root.dataset.floating=String(active);
    if(!active){
      if(frame)cancelAnimationFrame(frame);frame=0;
      if(scan)cancelAnimationFrame(scan);scan=0;
      clear();root.style.removeProperty('--float-axis-x');root.style.removeProperty('--float-axis-y');
      root.style.removeProperty('--float-angle');root.style.removeProperty('--float-depth');return;
    }
    refresh();queue();
  }
  const observer=new MutationObserver(records=>{
    if(!active||scan)return;
    if(!records.some(record=>!record.target.closest?.('.CodeMirror,.unified-reader')&&
      [...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&
        (node.matches(SURFACES)||node.querySelector(SURFACES)))))return;
    scan=requestAnimationFrame(refresh);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('pointermove',move,{passive:true});
  document.documentElement.addEventListener('pointerleave',rest,{passive:true});
  window.addEventListener('blur',rest);
  document.addEventListener('visibilitychange',update);
  reduced.addEventListener('change',update);pointer.addEventListener('change',update);
  return {refresh,setOptions(options={}){
    const nextIntensity=Number.isFinite(options.intensity)?Math.max(0,Math.min(100,options.intensity)):50;
    const same=enabled===(options.enabled!==false)&&motion===(options.motion||'standard')&&intensity===nextIntensity;
    enabled=options.enabled!==false;motion=options.motion||'standard';
    intensity=nextIntensity;
    if(!same||root.dataset.floating===undefined)update();
  },destroy(){
    destroyed=true;enabled=false;update();observer.disconnect();
    document.removeEventListener('pointermove',move);
    document.documentElement.removeEventListener('pointerleave',rest);window.removeEventListener('blur',rest);
    document.removeEventListener('visibilitychange',update);
    reduced.removeEventListener('change',update);pointer.removeEventListener('change',update);
  }};
}
