/** Cached point sprites, bounded backing pixels and a sleeping 30fps scheduler.
 * Static preferences / hidden tabs never keep an animation loop alive. */
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export const spectralEnabled=prefs=>prefs?.spectralDrape===true;
export const drapeStrength=prefs=>{
  const value=Number(prefs?.drapeIntensity);
  return Number.isFinite(value)?clamp(value,15,85):48;
};
export const drapeResolution=(width,height,dpr=1)=>Math.min(dpr||1,1,Math.sqrt(1600000/Math.max(1,width*height)));
const parseHex=value=>[1,3,5].map(at=>parseInt(value.slice(at,at+2),16));
const blend=(a,b,t)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));
const rgba=(rgb,alpha)=>`rgba(${rgb.join(',')},${alpha})`;

export function createSpectralDrape(canvas){
  if(!canvas)return {setOptions(){},destroy(){}};
  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  if(!ctx)return {setOptions(){},destroy(){}};
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let options={enabled:false,intensity:.42,accent:'#a85745',night:false,motion:'standard'};
  let width=0,height=0,dpr=1,raf=0,timer=0,resizeFrame=0,startTime=0,destroyed=false;
  let points=[],atlas=null,frameGap=1000/30;
  canvas.width=canvas.height=1;
  function sprites(){
    atlas=document.createElement('canvas');atlas.width=64;atlas.height=16;
    const paint=atlas.getContext('2d');
    const base=parseHex(options.accent);
    const accent=options.night?blend(base,[239,222,214],.34):blend(base,[48,77,77],.10);
    const secondary=blend(accent,options.night?[207,220,220]:[77,112,111],options.night?.48:.62);
    for(let tile=0;tile<4;tile++){
      const color=tile%2?secondary:accent,x=tile*16+8;
      if(tile>=2){
        const glow=paint.createRadialGradient(x,8,0,x,8,7.5);
        glow.addColorStop(0,rgba(color,.8));glow.addColorStop(.35,rgba(color,.25));glow.addColorStop(1,rgba(color,0));
        paint.fillStyle=glow;paint.fillRect(tile*16,0,16,16);
      }
      paint.beginPath();paint.fillStyle=rgba(color,1);paint.arc(x,8,3.2,0,Math.PI*2);paint.fill();
    }
  }
  function prepare(){
    width=Math.max(1,window.innerWidth||canvas.clientWidth||1);
    height=Math.max(1,window.innerHeight||canvas.clientHeight||1);
    dpr=drapeResolution(width,height,window.devicePixelRatio);
    canvas.width=Math.max(1,Math.floor(width*dpr));canvas.height=Math.max(1,Math.floor(height*dpr));
    canvas.style.width='100%';canvas.style.height='100%';
    const cols=width<=700?32:Math.round(clamp(width/25,40,72));
    const rows=width<=700?18:Math.round(clamp(height/35,16,26));
    points=[];
    for(let row=1;row<rows-1;row++)for(let col=0;col<cols;col++){
      const v=row/(rows-1),u=(col/(cols-1)-.5)*2.5;
      const a=u*2.32+v*3.62,b=u*4.15-v*2.9,c=a*.72+v*.86,e=u*3.15;
      points.push({u,v,a,sa:Math.sin(a),ca:Math.cos(a),cb:Math.cos(b),sb:Math.sin(b),
        cc:Math.cos(c),sc:Math.sin(c),se:Math.sin(e),ce:Math.cos(e),
        fade:Math.pow(Math.sin(Math.PI*v),.44)*clamp(1-Math.abs(u)/1.42,0,1),
        tile:((col+row)%6===0?1:0)+((col*3+row*5)%13===0?2:0)});
    }
  }
  function draw(time){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const t=time*.00024*(options.motion==='subtle'?.6:1);
    const st=Math.sin(t),ct=Math.cos(t),s72=Math.sin(t*.72),c72=Math.cos(t*.72),s55=Math.sin(t*.55),c55=Math.cos(t*.55);
    for(const p of points){
      const fold=(p.sa*ct+p.ca*st)*.285+(p.cb*c72+p.sb*s72)*.115;
      const depth=(p.cc*c72-p.sc*s72)*.68+(p.se*c55-p.ce*s55)*.20;
      const x=width*.53+p.u*width*.39*(1+depth*.125)+fold*width*.12;
      const y=height*.47+(p.v-.5)*height*.72+depth*height*.15+fold*height*.16;
      const ridge=.5+.5*Math.sin((p.a+t)*1.15+depth*2.4);
      const alpha=(.16+ridge*.37)*p.fade*options.intensity;
      if(alpha<.012)continue;
      const radius=.82+ridge*1.02+(depth+.8)*.17,size=radius*5;
      ctx.globalAlpha=alpha;
      ctx.drawImage(atlas,p.tile*16,0,16,16,x-size/2,y-size/2,size,size);
    }
    ctx.globalAlpha=1;
  }
  function stop(){
    if(raf)cancelAnimationFrame(raf);if(timer)clearTimeout(timer);raf=timer=0;
  }
  function moving(){return !reduced?.matches&&options.motion!=='off';}
  function schedule(delay=frameGap){
    timer=setTimeout(()=>{timer=0;raf=requestAnimationFrame(tick);},Math.max(0,delay));
  }
  function tick(now){
    raf=0;if(destroyed||!options.enabled||document.hidden||!moving()){stop();return;}
    const before=performance.now();draw(now-startTime);const cost=performance.now()-before;
    frameGap=cost>8?1000/20:1000/30;
    schedule(frameGap-cost);
  }
  function start(){
    stop();if(destroyed||!options.enabled||document.hidden)return;
    startTime=performance.now();draw(0);
    if(moving())schedule();
  }
  function setOptions(next={}){
    if(destroyed)return;
    const value={...options,...next};
    value.enabled=value.enabled===true;value.night=value.night===true;
    value.intensity=clamp(Number(value.intensity)||.42,.1,.8);
    value.accent=/^#[\da-f]{6}$/i.test(String(value.accent||''))?value.accent:'#a85745';
    value.motion=['standard','subtle','off'].includes(value.motion)?value.motion:'standard';
    if(Object.keys(value).every(key=>value[key]===options[key]))return;
    const colors=value.accent!==options.accent||value.night!==options.night;
    const wasEnabled=options.enabled;options=value;
    canvas.classList.toggle('is-active',options.enabled);canvas.hidden=!options.enabled;
    canvas.dataset.enabled=String(options.enabled);canvas.setAttribute('aria-hidden','true');
    if(!options.enabled){
      stop();if(resizeFrame)cancelAnimationFrame(resizeFrame);resizeFrame=0;
      canvas.width=canvas.height=1;return;
    }
    if(!wasEnabled||width!==window.innerWidth||height!==window.innerHeight)prepare();
    if(!atlas||colors||!wasEnabled)sprites();start();
  }
  const onResize=()=>{
    if(!options.enabled||destroyed||resizeFrame)return;
    resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(options.enabled&&!destroyed){prepare();start();}});
  };
  const onVisibility=()=>{if(document.hidden)stop();else start();};
  const onMotion=()=>start();
  window.addEventListener('resize',onResize,{passive:true});document.addEventListener('visibilitychange',onVisibility);
  reduced?.addEventListener?.('change',onMotion);
  return {setOptions,destroy(){
    destroyed=true;stop();if(resizeFrame)cancelAnimationFrame(resizeFrame);
    window.removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisibility);
    reduced?.removeEventListener?.('change',onMotion);canvas.width=canvas.height=1;atlas=null;points=[];
  }};
}
