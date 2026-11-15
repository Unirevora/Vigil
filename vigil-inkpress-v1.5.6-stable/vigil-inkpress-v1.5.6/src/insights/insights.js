/** Meaningful, privacy-preserving journal retrieval. Pure and offline. */
const datePattern=/(?:📅|due:|截止:|期限:|@due\()?\s*(\d{4}-\d{2}-\d{2})/iu;
export function tasksFromEntries(entries){
  const results=[];
  for(const e of entries){
    const lines=e.content.split(/\r?\n/);
    let fenced=false;
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(/^\s*(```|~~~)/.test(line)){fenced=!fenced;continue;}
      if(fenced)continue;
      const match=line.match(/^(\s*(?:[-*+]\s+|\d+\.\s+)\[)([ xX])(\]\s*)(.+)$/u);
      if(!match)continue;
      const raw=match[4].trim();
      const due=raw.match(datePattern)?.[1]||'';
      results.push({id:`${e.id}:${i}`,entryId:e.id,entryTitle:e.title||'未命名手记',
        date:e.date,updatedAt:e.updatedAt,line:i,source:line,
        complete:match[2].toLowerCase()==='x',title:raw.replace(datePattern,'').trim()||raw,
        due,overdue:Boolean(due&&due<new Date().toISOString().slice(0,10))});
    }
  }
  return results.sort((a,b)=>Number(a.complete)-Number(b.complete)||
    (a.due||'9999').localeCompare(b.due||'9999')||b.date.localeCompare(a.date));
}
export function toggleTask(entries,entryId,line,expectedSource){
  const index=entries.findIndex(e=>e.id===entryId);
  if(index===-1)throw new Error('原始手记不存在。');
  const target=entries[index];
  const separator=target.content.includes('\r\n')?'\r\n':'\n';
  const lines=target.content.split(/\r?\n/);
  if(!Number.isInteger(line)||line<0||line>=lines.length||lines[line]!==expectedSource){
    throw new Error('手记已发生变化，请刷新任务列表后再试。');
  }
  const changed=lines[line].replace(/^(\s*(?:[-*+]\s+|\d+\.\s+)\[)([ xX])(\])/u,
    (_,prefix,flag,suffix)=>prefix+(flag===' '?'x':' ')+suffix);
  if(changed===lines[line])throw new Error('对应行不是有效的任务。');
  const updated={...target,content:lines.map((txt,i)=>i===line?changed:txt).join(separator),updatedAt:new Date().toISOString()};
  return entries.map((e,i)=>i===index?updated:e);
}
export function connectionsFromEntries(entries){
  const byTitle=new Map(entries.map(e=>[e.title.trim().toLocaleLowerCase(),e]));
  const edges=[],unresolved=[];
  for(const item of entries){
    for(const match of item.content.matchAll(/\[\[([^\[\]\n]{1,100})\]\]/g)){
      const label=match[1].split('|')[0].trim();
      const target=byTitle.get(label.toLocaleLowerCase());
      if(target){
        if(item.id!==target.id)edges.push({from:item.id,to:target.id,label,fromTitle:item.title,toTitle:target.title});
      }else unresolved.push({entryId:item.id,entryTitle:item.title,label});
    }
  }
  const backlinks=new Map(entries.map(e=>[e.id,[]]));
  for(const edge of edges)backlinks.get(edge.to).push(edge);
  return {edges,backlinks,unresolved};
}
export function reviewMetrics(entries,now=new Date()){
  const dayString=new Date(now).toISOString().slice(0,10);
  const ms=Date.parse(dayString+'T00:00:00Z');
  const active=new Set(entries.map(e=>e.date));
  const words=entries.reduce((sum,e)=>sum+e.content.replace(/\s/g,'').length,0);
  let streak=0;
  for(let i=0;i<1000;i++){
    const day=new Date(ms-i*86400000).toISOString().slice(0,10);
    if(!active.has(day)){
      if(i===0)continue; // no entry yet today: include streak from yesterday
      break;
    }
    streak++;
  }
  const since7=new Date(ms-6*86400000).toISOString().slice(0,10);
  const since30=new Date(ms-29*86400000).toISOString().slice(0,10);
  const counts=new Map();
  for(const e of entries)for(const tag of e.tags||[])counts.set(tag,(counts.get(tag)||0)+1);
  const tags=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,8);
  const taskList=tasksFromEntries(entries);
  return {
    total:entries.length,words,streak,
    week:entries.filter(e=>e.date>=since7&&e.date<=dayString).length,
    month:entries.filter(e=>e.date>=since30&&e.date<=dayString).length,
    pending:taskList.filter(t=>!t.complete).length,complete:taskList.filter(t=>t.complete).length,tags
  };
}
export function promptFromEntries(entries,now=new Date()){
  const ideas=[
    '这周有什么事让你改变了看法？',
    '哪些想法写下来后，真的转化成了行动？',
    '有没有一件事，你想在下周继续推进？',
    '最近反复出现的主题，可能在提醒你什么？',
    '哪篇旧手记值得重新看一遍？'
  ];
  const day=Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000);
  const recent=[...entries].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const text=ideas[((day%ideas.length)+ideas.length)%ideas.length];
  return {text,context:recent?`从「${recent.title}」开始回顾`:'从今天的第一句话开始'};
}
