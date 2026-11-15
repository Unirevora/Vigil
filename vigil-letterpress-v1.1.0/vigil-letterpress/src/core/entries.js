import {charCount, todayISO, uuid, isValidDate} from './format.js';

export function sortEntries(entries, order='desc') {
  const result = [...entries].sort((a,b) =>
    String(b.date).localeCompare(String(a.date)) ||
    String(b.updatedAt).localeCompare(String(a.updatedAt)) ||
    String(a.id).localeCompare(String(b.id))
  );
  return order === 'asc' ? result.reverse() : result;
}
export function filterEntries(entries, query='', order='desc') {
  const q = query.trim().toLocaleLowerCase();
  return sortEntries(entries.filter(e =>
    !q || e.title.toLocaleLowerCase().includes(q) ||
    e.content.toLocaleLowerCase().includes(q)
  ),order);
}
export function getMetrics(entries, currentDate=todayISO()) {
  const month=currentDate.slice(0,7);
  return {
    total:entries.length,
    thisMonth:entries.filter(e=>e.date.slice(0,7)===month).length,
    words:entries.reduce((sum,e)=>sum+charCount(e.content),0)
  };
}
export function buildEntry(draft, old=null, now=new Date().toISOString()) {
  if (!isValidDate(draft.date)) throw new Error('请填写有效日期');
  const title=String(draft.title??'').trim().slice(0,200);
  return {
    id:old?.id ?? uuid(),
    title:title || '未命名手记',
    content:String(draft.content ?? ''),
    date:draft.date,
    createdAt:old?.createdAt ?? now,
    updatedAt:now,
    ...(old?.legacy ? {legacy:old.legacy}:{}),
    demo:false
  };
}
