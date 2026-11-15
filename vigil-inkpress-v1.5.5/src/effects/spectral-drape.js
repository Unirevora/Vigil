/**
 * VIGIL Spectral Drape
 * A small, dependency-free Canvas interpretation of a glowing dotted surface
 * folding in perspective. It is inspired by the visual brief, not copied from
 * the React Bits Pro package and does not require its registry or license.
 *
 * Performance: 30fps cap, DPR <= 1.5, adaptive grid, pauses when hidden,
 * and renders a still frame when the OS requests reduced motion.
 */
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export const spectralEnabled=prefs=>prefs?.spectralDrape===true;
export const drapeStrength=prefs=>{
  const value=Number(prefs?.drapeIntensity);
  return Number.isFinite(value)?clamp(value,15,85):48;
};
const parseHex=value=>{
  const s=String(value||'#a85745').replace('#','');
  if(!/^[\da-f]{6}$/i.test(s))return [168,87,69];
  return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];
};
const blend=(a,b,t)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));
const rgba=(rgb,alpha)=>`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(alpha,0,1).toFixed(3)})`;

export function createSpectralDrape(canvas){
  if(!canvas)return {setOptions(){},destroy(){}};
  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  if(!ctx)return {setOptions(){},destroy(){}};
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const mobile=window.matchMedia?.('(max-width: 700px)');
  let options={enabled:false,intensity:.42,accent:'#a85745',night:false};
  let width=0,height=0,dpr=1,raf=0,lastFrame=0,startTime=0,destroyed=false;
  let cols=84,rows=28;

  function resize(){
    if(destroyed)return;
    width=Math.max(1,window.innerWidth||canvas.clientWidth||1);
    height=Math.max(1,window.innerHeight||canvas.clientHeight||1);
    dpr=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);
    canvas.height=Math.round(height*dpr);
    canvas.style.width='100%';canvas.style.height='100%';
    cols=mobile?.matches?58:Math.round(clamp(width/15.5,72,116));
    rows=mobile?.matches?22:Math.round(clamp(height/24,24,38));
    draw(0);
  }
  function draw(time){
    if(destroyed||!ctx)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,width,height);
    if(!options.enabled)return;
    const baseAccent=parseHex(options.accent);
    const accent=options.night?blend(baseAccent,[239,222,214],.34):blend(baseAccent,[48,77,77],.10);
    const secondary=blend(accent,options.night?[207,220,220]:[77,112,111],options.night?.48:.62);
    const intensity=clamp(options.intensity,.1,.8);
    const t=time*.00024;
    const cx=width*.53,cy=height*.47;
    const light=options.night?[235,243,235]:[255,255,255];
    ctx.globalCompositeOperation=options.night?'screen':'multiply';
    ctx.lineCap='round';
    const glowPoints=[];
    for(let row=0;row<rows;row++){
      const v=row/(rows-1);
      const verticalFade=Math.pow(Math.sin(Math.PI*v),.44);
      for(let col=0;col<cols;col++){
        const u=(col/(cols-1)-.5)*2.5;
        const phase=u*2.32+v*3.62+t;
        const foldA=Math.sin(phase)*.285;
        const foldB=Math.cos(u*4.15-v*2.9-t*.72)*.115;
        const fold=foldA+foldB;
        const depth=Math.cos(phase*.72+v*.86)*.68+Math.sin(u*3.15-t*.55)*.20;
        const perspective=1+depth*.125;
        const x=cx+u*width*.39*perspective+fold*width*.12;
        const y=cy+(v-.5)*height*.72+depth*height*.15+fold*height*.16;
        const ridge=clamp(.5+.5*Math.sin(phase*1.15+depth*2.4),0,1);
        const edgeFade=clamp(1-Math.abs(u)/1.42,0,1);
        const alpha=(.16+ridge*.37)*verticalFade*edgeFade*intensity;
        if(alpha<.012)continue;
        const color=(col+row)%6===0?secondary:accent;
        const radius=.82+ridge*1.02+(depth+.8)*.17;
        ctx.beginPath();ctx.fillStyle=rgba(color,alpha);ctx.arc(x,y,Math.max(.5,radius),0,Math.PI*2);ctx.fill();
        if((col*3+row*5)%13===0&&alpha>.085)glowPoints.push({x,y,r:radius*3.35,a:alpha,color});
      }
    }
    // A few restrained luminous beads create the spectral glint without neon haze.
    ctx.globalCompositeOperation=options.night?'screen':'multiply';
    for(const point of glowPoints){
      const gradient=ctx.createRadialGradient(point.x,point.y,0,point.x,point.y,point.r);
      gradient.addColorStop(0,rgba(light,point.a*.78));
      gradient.addColorStop(.24,rgba(point.color,point.a*.48));
      gradient.addColorStop(1,rgba(point.color,0));
      ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(point.x,point.y,point.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
  }
  function stop(){if(raf){cancelAnimationFrame(raf);raf=0;}lastFrame=0;}
  function tick(now){
    if(destroyed||!options.enabled||document.hidden){stop();return;}
    if(now-lastFrame>=1000/30){draw(now-startTime);lastFrame=now;}
    raf=requestAnimationFrame(tick);
  }
  function start(){
    stop();
    if(!options.enabled||destroyed)return;
    startTime=performance.now();
    if(reduced?.matches){draw(0);return;}
    raf=requestAnimationFrame(tick);
  }
  function setOptions(next={}){
    options={...options,...next};
    options.intensity=clamp(Number(options.intensity)||.42,.1,.8);
    options.accent=/^#[\da-f]{6}$/i.test(String(options.accent||''))?options.accent:'#a85745';
    canvas.classList.toggle('is-active',Boolean(options.enabled));
    canvas.hidden=!options.enabled;
    canvas.dataset.enabled=String(Boolean(options.enabled));
    canvas.setAttribute('aria-hidden','true');
    if(!options.enabled){stop();ctx.clearRect(0,0,canvas.width,canvas.height);return;}
    start();
  }
  const onResize=()=>{resize();if(options.enabled)start();};
  const onVisibility=()=>{if(document.hidden)stop();else start();};
  const onMotion=()=>start();
  window.addEventListener('resize',onResize,{passive:true});
  document.addEventListener('visibilitychange',onVisibility);
  reduced?.addEventListener?.('change',onMotion);
  mobile?.addEventListener?.('change',onResize);
  resize();
  return {
    setOptions,
    destroy(){
      destroyed=true;stop();window.removeEventListener('resize',onResize);
      document.removeEventListener('visibilitychange',onVisibility);
      reduced?.removeEventListener?.('change',onMotion);
      mobile?.removeEventListener?.('change',onResize);
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }
  };
}
