import {charCount, todayISO, uuid, isValidDate} from './format.js';

export function sortEntries(entries, order='desc') {
  const result = [...entries].sort((a,b) =>
    String(b.date).localeCompare(String(a.date)) ||
    String(b.updatedAt).localeCompare(String(a.updatedAt)) ||
    String(a.id).localeCompare(String(b.id))
  );
  return order === 'asc' ? result.reverse() : result;
}
/** Determine whether a note has an open Markdown task outside a fenced code block.
 * Pure read-only calculation; it never changes the note's Markdown source.
 */
export function hasOpenTasks(content='') {
  let fence=null;
  for(const line of String(content).split(/\r?\n/)){
    const marker=line.match(/^\s*(`{3,}|~{3,})/);
    if(marker){
      const kind=marker[1][0];
      if(!fence)fence={kind,length:marker[1].length};
      else if(fence.kind===kind && marker[1].length>=fence.length)fence=null;
      continue;
    }
    if(fence)continue;
    if(/^\s*(?:[-*+]\s+|\d+\.\s+)\[ \]\s+\S/u.test(line))return true;
  }
  return false;
}

/** `referenceDate` supports deterministic filtering across timezones and tests. */
export function filterEntries(entries, query='', order='desc',filters={},referenceDate=todayISO()) {
  const q = query.trim().toLocaleLowerCase();
  const since=filters.recent
    ?new Date(Date.parse(`${referenceDate}T12:00:00Z`)-6*86400000).toISOString().slice(0,10)
    :'';
  return sortEntries(entries.filter(e =>
    (!q || e.title.toLocaleLowerCase().includes(q) ||
      e.content.toLocaleLowerCase().includes(q) ||
      (e.tags||[]).some(tag=>tag.toLocaleLowerCase().includes(q))) &&
    (!filters.favorite || e.favorite===true) &&
    (!filters.tag || (e.tags||[]).includes(filters.tag)) &&
    (!filters.month || e.date.slice(0,7)===filters.month) &&
    (!filters.day || e.date===filters.day) &&
    (!filters.recent || (e.date>=since && e.date<=referenceDate)) &&
    (!filters.pending || hasOpenTasks(e.content))
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
    demo:false,
    tags:Array.isArray(draft.tags)?[...new Set(draft.tags.map(s=>String(s).trim()).filter(Boolean))].slice(0,8).map(t=>t.slice(0,24)):[],
    mood:['平静','喜悦','疲惫','思考','灵感'].includes(draft.mood)?draft.mood:'',
    favorite:old?.favorite===true
  };
}
