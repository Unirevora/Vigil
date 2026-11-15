/**
 * VIGIL optical material renderer.
 * The SVG feDisplacementMap is the default filter for supporting browsers.
 * Because SVG backdrop filters are inconsistently composited, we ALSO paint a
 * scene-aligned, edge-displaced Canvas layer (not a blur) as a stable backdrop.
 * The image sample shifts only in a curved 8–24px border; the center is flat.
 * Text, input and focus ring remain completely independent of the optical layer.
 */
const selector='[data-liquid-glass]';
let active=[],frame=0,scene=null,sceneURL='',loading='';
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion:reduce)').matches;
function supportsSVG(){return typeof CSS!=='undefined'&&CSS.supports('filter','url(#vigil-glass-bend)')&&typeof SVGFilterElement!=='undefined';}
function sceneName(){
  const css=getComputedStyle(document.documentElement).getPropertyValue('--glass-scene-url').trim();
  const match=css.match(/^url\(["']?(.*?)["']?\)$/);
  return match?.[1]||'/assets/landscape-ink-hd.webp';
}
function prepareScene(){
  const candidate=sceneName();
  if(candidate===sceneURL)return;
  sceneURL=candidate;scene=null;
  const picture=new Image();loading=candidate;
  picture.onload=()=>{if(loading!==candidate)return;scene=picture;schedule();};
  picture.onerror=()=>{if(loading!==candidate)return;scene=null;};
  picture.src=candidate;
}
function opticalPaint(item,rect){
  if(!scene||rect.width<10||rect.height<10||rect.right<=0||rect.bottom<=0||rect.left>=innerWidth||rect.top>=innerHeight)return;
  const cvs=item.canvas;
  const density=Math.min(devicePixelRatio||1,1.5);
  const w=Math.max(1,Math.round(rect.width*density)),h=Math.max(1,Math.round(rect.height*density));
  if(cvs.width!==w||cvs.height!==h){cvs.width=w;cvs.height=h;}
  const ctx=cvs.getContext('2d',{willReadFrequently:true});if(!ctx)return;
  ctx.clearRect(0,0,w,h);
  const vw=innerWidth,vh=innerHeight;
  const scale=Math.max(vw/scene.naturalWidth,vh/scene.naturalHeight);
  const imageWidth=scene.naturalWidth*scale,imageHeight=scene.naturalHeight*scale;
  const offX=(imageWidth-vw)/2,offY=(imageHeight-vh)/2;
  const sx=(rect.left+offX)/scale,sy=(rect.top+offY)/scale;
  const sw=rect.width/scale,sh=rect.height/scale;
  ctx.drawImage(scene,sx,sy,sw,sh,0,0,w,h);
  let before;
  try{before=ctx.getImageData(0,0,w,h);}catch{return;}
  const original=before.data,output=new Uint8ClampedArray(original.length);
  const radius=Math.min(w,h)/2-1;
  const band=Math.max(8,Math.min(24*density,h*.36));
  const maxShift=8*density;
  for(let y=0;y<h;y++){
    const yy=y+.5-h/2,ay=Math.abs(yy),qy=ay-(h/2-radius);
    for(let x=0;x<w;x++){
      const xx=x+.5-w/2,ax=Math.abs(xx),qx=ax-(w/2-radius);
      const dx=Math.max(qx,0),dy=Math.max(qy,0);
      const sdf=Math.hypot(dx,dy)+Math.min(Math.max(qx,qy),0)-radius;
      const t=sdf<0?Math.max(0,1-Math.abs(sdf)/band):0;
      const strength=t*t*(3-2*t);
      let nx=0,ny=0;
      if(qx>0&&qy>0){const len=Math.hypot(qx,qy)||1;nx=Math.sign(xx)*qx/len;ny=Math.sign(yy)*qy/len;}
      else if(qx>qy)nx=Math.sign(xx);else ny=Math.sign(yy);
      const px=Math.max(0,Math.min(w-1,Math.round(x+nx*strength*maxShift)));
      const py=Math.max(0,Math.min(h-1,Math.round(y+ny*strength*maxShift)));
      const i=(y*w+x)*4,j=(py*w+px)*4;
      output[i]=original[j];output[i+1]=original[j+1];output[i+2]=original[j+2];output[i+3]=original[j+3];
    }
  }
  ctx.putImageData(new ImageData(output,w,h),0,0);
  item.host.classList.add('glass-scene-ready');
}
function redraw(){
  frame=0;prepareScene();
  active=active.filter(row=>row.host.isConnected);
  for(const row of active){
    const rect=row.host.getBoundingClientRect();
    row.layer.style.setProperty('--lens-left',(-rect.left)+'px');
    row.layer.style.setProperty('--lens-top',(-rect.top)+'px');
    row.layer.style.setProperty('--lens-width',innerWidth+'px');
    row.layer.style.setProperty('--lens-height',innerHeight+'px');
    if(!reduced())opticalPaint(row,rect);
  }
}
function schedule(){if(!frame)frame=requestAnimationFrame(redraw);}
function setup(host){
  if(host.dataset.lensMounted)return;
  host.dataset.lensMounted='1';host.classList.add('liquid-glass');
  const lens=document.createElement('span');lens.className='glass-lens-underlay';lens.setAttribute('aria-hidden','true');
  const layer=document.createElement('span');layer.className='glass-lens-scene';
  const canvas=document.createElement('canvas');canvas.className='glass-lens-canvas';
  lens.append(layer,canvas);host.insertBefore(lens,host.firstChild);
  active.push({host,layer,canvas});
  host.addEventListener('pointerdown',()=>{if(!reduced())host.classList.add('glass-pressed');});
  for(const type of ['pointerup','pointercancel','pointerleave'])host.addEventListener(type,()=>host.classList.remove('glass-pressed'));
  if(!reduced()&&supportsSVG())host.classList.add('glass-optics-on');
  schedule();
}
export function mountLiquidGlass(root=document){
  if(!root?.querySelectorAll)return;
  active=active.filter(row=>row.host.isConnected);
  for(const element of root.querySelectorAll(selector))setup(element);
  schedule();
}
export function initLiquidGlass(){
  mountLiquidGlass(document);
  window.addEventListener('scroll',schedule,{passive:true,capture:true});
  window.addEventListener('resize',schedule,{passive:true});
  matchMedia('(prefers-reduced-motion:reduce)').addEventListener?.('change',event=>{
    for(const row of active)row.host.classList.toggle('glass-optics-on',!event.matches&&supportsSVG());
    schedule();
  });
  return {refresh:()=>mountLiquidGlass(document),isSupported:supportsSVG};
}
