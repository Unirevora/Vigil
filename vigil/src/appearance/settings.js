/* Visual settings are independent from the user's journals and backups. */
export const APPEARANCE_KEY='vigil-appearance-v142';
export const DEFAULT_APPEARANCE=Object.freeze({
  accent:'#a83f2a',background:'paper',backgroundOpacity:24,
  surfaceOpacity:91,bodyFontSize:16,lineHeight:1.8,contentWidth:1460,
  texture:true,heroMode:'original',theme:'paper',fontFamily:'heritage',
  sidebarTone:'accent',sidebarGlass:74,sidebarBlur:24,glassTint:72,motionMode:'standard',
  spectralDrape:false,drapeIntensity:48,floating:true,floatingIntensity:50
});
export const COLOR_PRESETS=[
  {name:'朱砂',color:'#a83f2a'}, {name:'松绿',color:'#375d4f'},
  {name:'黛蓝',color:'#49687c'}, {name:'铜金',color:'#8a6535'},
  {name:'梅紫',color:'#795269'}, {name:'墨青',color:'#326c70'}
];
export const BACKGROUND_PRESETS=[
  {key:'paper',name:'晴岚',description:'高清远景 · 极简'},
  {key:'mountains',name:'薄雾',description:'柔灰山水 · 高清'},
  {key:'sage',name:'素岸',description:'淡彩湖岸 · 高清'},
  {key:'sea',name:'月汐',description:'宽幅夜景 · 高清'},
  {key:'custom',name:'我的背景',description:'自选图片'},
  {key:'none',name:'纯色',description:'无背景'}
];
const LEGACY_BACKGROUND={plum:'mountains',bamboo:'sage',waves:'sea'};
export function normalizeAppearance(input){
  const a={...DEFAULT_APPEARANCE};
  if(!input||typeof input!=='object'||Array.isArray(input))return a;
  if(typeof input.accent==='string'&&/^#[0-9a-fA-F]{6}$/.test(input.accent))a.accent=input.accent.toLowerCase();
  const selected=LEGACY_BACKGROUND[input.background]||input.background;
  if(BACKGROUND_PRESETS.some(x=>x.key===selected))a.background=selected;
  if(['original','custom'].includes(input.heroMode))a.heroMode=input.heroMode;
  if(['paper','night'].includes(input.theme))a.theme=input.theme;
  if(['heritage','song','sans','kai'].includes(input.fontFamily))a.fontFamily=input.fontFamily;
  if(['accent','ink'].includes(input.sidebarTone))a.sidebarTone=input.sidebarTone;
  if(['standard','subtle','off'].includes(input.motionMode))a.motionMode=input.motionMode;
  for(const [key,min,max] of [['backgroundOpacity',0,85],['surfaceOpacity',50,100],
    ['bodyFontSize',13,22],['lineHeight',1.45,2.5],['contentWidth',860,1740],
    ['sidebarGlass',55,96],['sidebarBlur',0,36],['glassTint',28,92],['drapeIntensity',15,85],['floatingIntensity',0,100]]){
    if(typeof input[key]==='number'&&Number.isFinite(input[key]))a[key]=Math.min(max,Math.max(min,input[key]));
  }
  if(typeof input.texture==='boolean')a.texture=input.texture;
  if(typeof input.spectralDrape==='boolean')a.spectralDrape=input.spectralDrape;
  if(typeof input.floating==='boolean')a.floating=input.floating;
  return a;
}
export function readAppearance(storage){
  try{
    const raw=storage.getItem(APPEARANCE_KEY);
    return normalizeAppearance(raw?JSON.parse(raw):null);
  }catch{return {...DEFAULT_APPEARANCE};}
}
export function writeAppearance(storage,previous,patch){
  const value=normalizeAppearance({...previous,...patch});
  storage.setItem(APPEARANCE_KEY,JSON.stringify(value));
  return value;
}
export const isValidHex=value=>/^#[\da-fA-F]{6}$/.test(String(value||''));
export function hexToRgb(hex){
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
}
export function mixHex(hex,other,ratio){
  const a=hexToRgb(hex),b=hexToRgb(other);
  return '#'+a.map((value,i)=>Math.round(value*(1-ratio)+b[i]*ratio).toString(16).padStart(2,'0')).join('');
}
export function contrastInk(hex){
  const s=hexToRgb(hex).map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
  return s[0]*.2126+s[1]*.7152+s[2]*.0722>.33?'#222d28':'#fff7e7';
}

/** Side navigation shades derived from the active user color, never fixed green.
 * The traditional ink tone is offered explicitly as an optional preference. */
export function sidebarPalette(accent,mode='accent',night=false){
  if(!isValidHex(accent))accent=DEFAULT_APPEARANCE.accent;
  if(night){
    // Neutral charcoal is independent of the day palette; the active mark may
    // still inherit the user's vermilion, indigo, or custom accent.
    return {top:'#26272c',bottom:'#191a1f',
      active:mixHex(accent,'#ede9e3',.90),edge:'#87858b'};
  }
  const source=mode==='ink'?'#34544d':accent;
  const dark='#192827';
  return {
    top:mixHex(source,dark,.50),bottom:mixHex(source,dark,.70),
    active:mixHex(source,'#f8faf6',.87),edge:mixHex(source,'#c4d0ca',.68)
  };
}
