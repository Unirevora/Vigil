/**
 * Pure syntax segments for the inline manuscript compositor.
 * Selection and text mutations remain entirely inside CodeMirror; this module
 * never edits text and is independently testable in Node.
 */
import {findInlineMath} from '../core/math.js';
import {quoteBlockEnd} from '../core/markdown.js';
import {sanitizeStyledTag} from '../core/safe-html.js';

const patterns=[
  {type:'code',regex:/`([^`\n]+)`/g,prefix:1,suffix:1},
  {type:'strong',regex:/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g,prefix:2,suffix:2},
  {type:'strike',regex:/~~([^~\n]+)~~/g,prefix:2,suffix:2},
  {type:'link',regex:/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,prefix:1,suffix:'link'},
  {type:'wikilink',regex:/\[\[([^\]\n]+)\]\]/g,prefix:2,suffix:2},
  {type:'emphasis',regex:/(?<!\*)\*([^*\n]+)\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)/g,prefix:1,suffix:1},
];
export function inlineSegments(text){
  const source=String(text);
  const candidates=[];
  // Earliest source spans get priority; syntax nesting is handled by the CM
  // highlighting fallback when nested constructs are too complex.
  for(const rule of patterns){
    for(const match of source.matchAll(rule.regex)){
      const start=match.index,end=start+match[0].length;
      const suffix=rule.suffix==='link'?match[0].length-1-match[1].length:rule.suffix;
      candidates.push({type:rule.type,from:start,to:end,
        innerFrom:start+rule.prefix,innerTo:end-suffix,
        prefix:rule.prefix,suffix});
    }
  }
  // Typography-tag support: preserve raw HTML in CodeMirror's source, but
  // apply the allowlisted font style/class directly to its visible text.
  for(const match of source.matchAll(/<(span|u|small|mark)\b([^<>]*)>([^<>\n]+)<\/\1>/gi)){
    const opener=match[0].slice(0,match[0].indexOf('>')+1);
    const safe=sanitizeStyledTag(opener);
    if(!safe)continue;
    const from=match.index,to=from+match[0].length;
    const css=safe.match(/style="([^"]*)"/)?.[1]?.replace(/&quot;/g,'"')||'';
    const classes=safe.match(/class="([^"]*)"/)?.[1]||'';
    candidates.push({type:'styled',from,to,innerFrom:from+opener.length,
      innerTo:to-`</${match[1]}>`.length,prefix:opener.length,
      suffix:`</${match[1]}>`.length,css,classes,htmlTag:match[1].toLowerCase()});
  }
  for(const math of findInlineMath(source)){
    if(math.latex.trim())candidates.push({type:'math',from:math.from,to:math.to,latex:math.latex});
  }
  candidates.sort((a,b)=>a.from-b.from||b.to-a.to||
    ((a.type==='code'?-1:0)-(b.type==='code'?-1:0)));
  const taken=[];
  for(const part of candidates){
    if(part.from>0&&source[part.from-1]==='\\')continue;
    if(taken.some(p=>part.from<p.to&&part.to>p.from))continue;
    taken.push(part);
  }
  return taken.sort((a,b)=>a.from-b.from);
}
export function markdownHeading(line){
  const match=String(line).match(/^(\s*)(#{1,6})([ \t]+)(.*)$/);
  if(!match||!match[4].trim())return null;
  return {level:match[2].length,prefix:match[1].length+match[2].length+match[3].length,
    title:match[4]};
}
export function markdownListMarker(line){
  const task=String(line).match(/^(\s*)([-*+])(\s+)\[([ xX])\]([ \t]+)/);
  if(task)return {kind:'task',prefix:task[0].length,checked:task[4].toLowerCase()==='x',
    indent:task[1].length};
  const bullet=String(line).match(/^(\s*)([-*+])([ \t]+)/);
  if(bullet)return {kind:'bullet',prefix:bullet[0].length,indent:bullet[1].length};
  const ordered=String(line).match(/^(\s*)(\d+[.)])([ \t]+)/);
  if(ordered)return {kind:'ordered',prefix:ordered[0].length,indent:ordered[1].length,
    number:ordered[2].slice(0,-1)};
  return null;
}
export function markdownTableAt(lines,index){
  if(!lines[index]?.includes('|')||!lines[index+1])return null;
  const separator=lines[index+1].trim();
  if(!/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(separator))return null;
  let end=index+1;
  while(end+1<lines.length&&lines[end+1].trim()&&lines[end+1].includes('|'))end++;
  return {start:index,end,source:lines.slice(index,end+1).join('\n')};
}
export function markdownMathBlockAt(lines,index){
  const trimmed=String(lines[index]||'').trim();
  if(/^\$\$.+\$\$$/.test(trimmed))return {start:index,end:index,latex:trimmed.slice(2,-2)};
  if(trimmed!=='$$'&&trimmed!=='\\[')return null;
  const close=trimmed==='$$'?'$$':'\\]';
  const buf=[];
  for(let j=index+1;j<Math.min(index+200,lines.length);j++){
    if(lines[j].trim()===close)return {start:index,end:j,latex:buf.join('\n')};
    buf.push(lines[j]);
  }
  return null;
}
export function markdownFenceAt(lines,index){
  const first=String(lines[index]||'').match(/^\s*(`{3,}|~{3,})([^\n]*)$/);
  if(!first)return null;
  const marker=first[1][0],length=first[1].length;
  for(let j=index+1;j<Math.min(lines.length,index+300);j++){
    const close=lines[j].match(/^\s*(`{3,}|~{3,})\s*$/);
    if(close&&close[1][0]===marker&&close[1].length>=length){
      return {start:index,end:j,source:lines.slice(index,j+1).join('\n')};
    }
  }
  return null;
}

/** Full quote/callout group in a CodeMirror document. Pure, source-preserving. */
export function markdownQuoteAt(lines,index){
  if(!/^\s*>/.test(lines[index]||''))return null;
  const end=quoteBlockEnd(lines,index);
  const first=(lines[index]||'').replace(/^\s*>\s?/,'').trim();
  const callout=first.match(/^\[!([a-z][\w-]{0,30})\]([+-])?(?:\s+.*)?$/i);
  return {start:index,end,source:lines.slice(index,end+1).join('\n'),
    isCallout:Boolean(callout),type:callout?.[1]?.toLowerCase()||''};
}

/**
 * First line of a repaint window that never starts inside a fenced/math block
 * or the middle of a table/quote/paragraph: the closest blank line at or before
 * `target` that lies outside every fence/math block. Pure; O(target).
 */
export function markdownSafeStart(lines,target,maxBack=400){
  let i=0,safe=0;
  const limit=Math.min(target,lines.length);
  while(i<limit){
    const line=lines[i];
    if(!line.trim()){safe=i;i++;continue;}
    if(/^\s*(?:`{3,}|~{3,}|\$\$|\\\[)/.test(line)){
      const block=markdownFenceAt(lines,i)||markdownMathBlockAt(lines,i);
      if(block&&block.end>=i){i=block.end+1;continue;}
    }
    i++;
  }
  return limit-safe>maxBack?limit:safe;
}
