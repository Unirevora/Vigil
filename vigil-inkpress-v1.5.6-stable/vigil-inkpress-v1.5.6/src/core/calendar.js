import {todayISO} from './format.js';
export function monthStart(value=todayISO()){return `${value.slice(0,7)}-01`;}
export function shiftMonth(month,offset){
  const [y,m]=month.slice(0,7).split('-').map(Number);
  const d=new Date(y,m-1+offset,1,12);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
export function calendarDays(month){
  const [y,m]=month.split('-').map(Number);
  const days=new Date(y,m,0).getDate();
  const offset=(new Date(y,m-1,1).getDay()+6)%7;
  return [...Array(offset).fill(null),...Array.from({length:days},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];
}
export function yearsAgoToday(entries,now=todayISO()){
  return entries.filter(e=>e.date.slice(5)===now.slice(5)&&e.date!==now)
    .sort((a,b)=>b.date.localeCompare(a.date));
}
export function archiveMonths(entries){
  const counts=new Map();
  for(const item of entries){const month=item.date.slice(0,7);counts.set(month,(counts.get(month)||0)+1);}
  return [...counts].sort((a,b)=>b[0].localeCompare(a[0]));
}
