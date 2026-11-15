/**
 * 节气 / 物候计算（无联网依赖）
 * 24 solar terms occur every 15 degrees of the Sun's apparent ecliptic longitude.
 * Meeus-style low-precision solar apparent longitude, solved iteratively in UTC.
 * China/Hong Kong official day convention: UTC+08, NOT the device timezone.
 * Moon synodic phase is an approximation, not an official ephemeris.
 */
export const TERMS = [
  {name:'小寒', season:'冬', month:1, day:5, angle:285, hou:['雁北乡','鹊始巢','雉始雊'], verse:'风收尽旧岁，清寒落一笺。', note:'寒意渐深，候鸟知归。'},
  {name:'大寒', season:'冬', month:1, day:20, angle:300,hou:['鸡始乳','征鸟厉疾','水泽腹坚'],verse:'天寒到极处，炉火照长夜。',note:'一年寒意最浓，宜温养身心。'},
  {name:'立春', season:'春', month:2, day:4, angle:315, hou:['东风解冻','蛰虫始振','鱼陟负冰'],verse:'风从东面来，万物有初声。',note:'春意萌发，冰雪渐融。'},
  {name:'雨水', season:'春', month:2, day:19, angle:330,hou:['獭祭鱼','鸿雁来','草木萌动'],verse:'小雨落青瓦，枝头听春音。',note:'气温回升，雨露润泽。'},
  {name:'惊蛰', season:'春', month:3, day:5, angle:345,hou:['桃始华','仓庚鸣','鹰化为鸠'],verse:'春雷初醒处，花木渐成诗。',note:'雷鸣催醒蛰伏的生灵。'},
  {name:'春分', season:'春', month:3, day:20, angle:0,  hou:['玄鸟至','雷乃发声','始电'],verse:'昼夜平分时，柳色过窗来。',note:'春色正中，昼夜相近。'},
  {name:'清明', season:'春', month:4, day:4, angle:15, hou:['桐始华','田鼠化为鴽','虹始见'],verse:'烟雨轻沾袖，远山是故乡。',note:'草木清和，适宜踏青。'},
  {name:'谷雨', season:'春', month:4, day:20, angle:30,hou:['萍始生','鸣鸠拂其羽','戴胜降于桑'],verse:'一夜春雨足，新绿满田畴。',note:'暮春雨润，百谷生长。'},
  {name:'立夏', season:'夏', month:5, day:5, angle:45, hou:['蝼蝈鸣','蚯蚓出','王瓜生'],verse:'青阴渐满院，初夏入书窗。',note:'夏日开启，生机繁盛。'},
  {name:'小满', season:'夏', month:5, day:21,angle:60, hou:['苦菜秀','靡草死','麦秋至'],verse:'麦穗盈而未满，正是好时光。',note:'麦粒渐饱，万物未至极盛。'},
  {name:'芒种', season:'夏', month:6, day:5, angle:75, hou:['螳螂生','鵙始鸣','反舌无声'],verse:'人间多耕作，风里有麦香。',note:'忙于播种与收获的时节。'},
  {name:'夏至', season:'夏', month:6, day:21,angle:90, hou:['鹿角解','蜩始鸣','半夏生'],verse:'白昼长如许，荷风满池塘。',note:'白昼一年中最长的一段时间。'},
  {name:'小暑', season:'夏', month:7, day:7, angle:105,hou:['温风至','蟋蟀居宇','鹰始鸷'],verse:'树影斑驳处，蝉声送午晴。',note:'热意渐盛，蝉声初起。'},
  {name:'大暑', season:'夏', month:7, day:23,angle:120,hou:['腐草为萤','土润溽暑','大雨时行'],verse:'深夏蝉声远，星河落庭前。',note:'暑热深浓，雷雨频仍。'},
  {name:'立秋', season:'秋', month:8, day:7, angle:135,hou:['凉风至','白露降','寒蝉鸣'],verse:'一叶传秋信，清风过小楼。',note:'暑意未尽，秋声已起。'},
  {name:'处暑', season:'秋', month:8, day:23,angle:150,hou:['鹰乃祭鸟','天地始肃','禾乃登'],verse:'蝉声渐轻处，晚云带微凉。',note:'暑热渐退，禾谷渐熟。'},
  {name:'白露', season:'秋', month:9, day:7, angle:165,hou:['鸿雁来','玄鸟归','群鸟养羞'],verse:'露白风初起，桂香入月中。',note:'清晨生露，早晚渐凉。'},
  {name:'秋分', season:'秋', month:9, day:23,angle:180,hou:['雷始收声','蛰虫坯户','水始涸'],verse:'秋色分明处，山河入晚晴。',note:'昼夜平分，秋意正盛。'},
  {name:'寒露', season:'秋', month:10,day:8, angle:195,hou:['鸿雁来宾','雀入大水为蛤','菊有黄华'],verse:'寒露沾衣角，秋菊照篱边。',note:'露气寒凉，菊花渐开。'},
  {name:'霜降', season:'秋', month:10,day:23,angle:210,hou:['豺乃祭兽','草木黄落','蛰虫咸俯'],verse:'霜染千山色，暮秋入纸来。',note:'气温渐低，草木黄落。'},
  {name:'立冬', season:'冬', month:11,day:7, angle:225,hou:['水始冰','地始冻','雉入大水为蜃'],verse:'北风敲夜窗，静候一炉暖。',note:'冬日始立，水土渐寒。'},
  {name:'小雪', season:'冬', month:11,day:22,angle:240,hou:['虹藏不见','天气上升地气下降','闭塞而成冬'],verse:'薄雪落瓦上，轻寒过窗纱。',note:'冬气渐重，天气愈寒。'},
  {name:'大雪', season:'冬', month:12,day:7, angle:255,hou:['鹖鴠不鸣','虎始交','荔挺出'],verse:'千山藏素色，万籁入深冬。',note:'隆冬气象渐盛，雪意渐浓。'},
  {name:'冬至', season:'冬', month:12,day:21,angle:270,hou:['蚯蚓结','麋角解','水泉动'],verse:'长夜深处，正有新阳生。',note:'白昼最短，阳气渐长。'}
];
export const TERM_NAMES=TERMS.map(t=>t.name);
export const DAYS_OF_WEEK=['一','二','三','四','五','六','日'];
const MS_DAY=86400000;
const DEG=Math.PI/180;
const normalize360=n=>(n%360+360)%360;
const diffDegrees=(a,b)=>((a-b+540)%360+360)%360-180;

export function sunApparentLongitude(timestamp) {
  const T=(timestamp/86400000+2440587.5-2451545)/36525;
  const L0=normalize360(280.46646+36000.76983*T+.0003032*T*T);
  const M=normalize360(357.52911+35999.05029*T-.0001537*T*T);
  const C=(1.914602-.004817*T-.000014*T*T)*Math.sin(M*DEG)
    +(.019993-.000101*T)*Math.sin(2*M*DEG)
    +.000289*Math.sin(3*M*DEG);
  const omega=125.04-1934.136*T;
  return normalize360(L0+C-.00569-.00478*Math.sin(omega*DEG));
}
const cache=new Map();
export function solarTermsForYear(year) {
  if(!Number.isInteger(year)||year<1900||year>2100)throw new Error('节气计算支持 1900–2100 年');
  if(cache.has(year))return cache.get(year);
  const result=TERMS.map((term,index)=>{
    let t=Date.UTC(year,term.month-1,term.day,4,0);
    for(let i=0;i<10;i++){
      const remaining=diffDegrees(sunApparentLongitude(t),term.angle);
      t-=remaining/.98564736*MS_DAY;
      if(Math.abs(remaining)<.000001)break;
    }
    const date=new Date(t);
    const chinaDate=new Date(t+8*3600000).toISOString().slice(0,10);
    return {...term,index,date,chinaDate,instant:t};
  });
  cache.set(year,result);
  return result;
}
export function solarTermOn(date){
  const year=Number(date.slice(0,4));
  return solarTermsForYear(year).find(t=>t.chinaDate===date)||null;
}
export function almanacForDate(date) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('日期格式无效');
  const y=Number(date.slice(0,4));
  if(y<1901||y>2099)throw new Error('风物日历支持 1901–2099 年');
  const nearby=[...solarTermsForYear(y-1),...solarTermsForYear(y),...solarTermsForYear(y+1)];
  const selected=nearby.filter(t=>t.chinaDate<=date).at(-1)||nearby[0];
  const next=nearby.find(t=>t.instant>selected.instant);
  const dayUTC=Date.parse(date+'T00:00:00.000Z');
  const termUTC=Date.parse(selected.chinaDate+'T00:00:00.000Z');
  const age=Math.max(0,Math.floor((dayUTC-termUTC)/MS_DAY));
  const houIndex=Math.min(2,Math.floor(age/5));
  const moon=moonPhaseForDate(date);
  return {
    date,year:y,selected,next,age,houIndex,
    hou:selected.hou[houIndex],
    verse:selected.verse,note:selected.note,
    moon,lunar:lunarLabel(date)
  };
}
export function almanacCalendarDay(date) {
  if(!date||Number(date.slice(0,4))<1900||Number(date.slice(0,4))>2100)return null;
  return solarTermOn(date);
}
export function lunarLabel(date){
  try{
    // Chinese-calendar formatting is a convenience; unsupported Intl falls back gracefully.
    const [y,m,day]=date.split('-').map(Number);
    const parts=new Intl.DateTimeFormat('zh-CN-u-ca-chinese',{
      month:'long',day:'numeric',timeZone:'Asia/Shanghai'
    }).formatToParts(new Date(Date.UTC(y,m-1,day,12)));
    const month=parts.find(p=>p.type==='month')?.value||'';
    const dayText=parts.find(p=>p.type==='day')?.value||'';
    const n=Number(dayText);
    if(!month||!Number.isInteger(n)||n<1||n>30)return month+dayText;
    const digit=['','一','二','三','四','五','六','七','八','九'];
    let label;
    if(n<=10)label='初'+(n===10?'十':digit[n]);
    else if(n<20)label='十'+digit[n-10];
    else if(n===20)label='二十';
    else if(n<30)label='廿'+digit[n-20];
    else label='三十';
    return `农历${month}${label}`;
  }catch{return '';}
}
export function addChinaDays(date,number){
  return new Date(Date.parse(date+'T00:00:00.000Z')+number*MS_DAY).toISOString().slice(0,10);
}
export function moonPhaseForDate(date){
  // Mean synodic cycle, indicative only; true astronomical phases can vary by ~1 day.
  const meanNewMoon=Date.UTC(2000,0,6,18,14);
  const day=Date.parse(date+'T12:00:00.000Z');
  const cycle=29.530588853;
  const fraction=((day-meanNewMoon)/MS_DAY/cycle%1+1)%1;
  const index=Math.floor((fraction+1/16)*8)%8;
  const phases=[
    ['新月','🌑'],['娥眉月','🌒'],['上弦月','🌓'],['盈凸月','🌔'],
    ['满月','🌕'],['亏凸月','🌖'],['下弦月','🌗'],['残月','🌘']
  ];
  return {name:phases[index][0],symbol:phases[index][1],fraction};
}
export function termRingModel(date) {
  const info=almanacForDate(date);
  const index=info.selected.index;
  const next=info.next;
  const total=next?Math.max(1,(Date.parse(next.chinaDate)-Date.parse(info.selected.chinaDate))/MS_DAY):15;
  const progress=Math.min(1,info.age/total);
  return {index,progress,angle:(index+progress)*15,entries:TERMS};
}
