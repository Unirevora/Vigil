/**
 * Document-safe formatting primitives for the common Markdown toolbar.
 * They only operate on the lines the user selected, never on rendered HTML.
 */
import {inlineSegments} from './live-markdown.js';

export const BLOCK_FORMATS=new Set([
  'heading1','heading','heading3','heading4','heading5','heading6',
  'list','orderedList','task','quote'
]);

const prefixes={
  heading1:'# ',heading:'## ',heading3:'### ',heading4:'#### ',
  heading5:'##### ',heading6:'###### ',list:'- ',task:'- [ ] ',quote:'> '
};
const startToken=/^(?:#{1,6}[ \t]+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/;
function sameBlockStyle(marker,kind){
  if(kind==='list')return /^[-*+]\s+$/.test(marker);
  if(kind==='orderedList')return /^\d+[.)]\s+$/.test(marker);
  if(kind==='task')return /^[-*+]\s+\[[ xX]\]\s+$/.test(marker);
  if(kind==='quote')return /^>\s?$/.test(marker);
  return marker.trim()===prefixes[kind]?.trim();
}

/** Preserve indentation and text, replacing exactly one block marker. */
export function formatBlockLine(text,kind,{index=0,emptyPlaceholder=false,toggle=true}={}){
  if(!BLOCK_FORMATS.has(kind))return text;
  const original=String(text);
  const indentation=original.match(/^[ \t]*/)[0];
  const visible=original.slice(indentation.length);
  const marker=visible.match(startToken)?.[0]||'';
  const bare=marker?visible.slice(marker.length):visible;
  const prefix=kind==='orderedList'?`${index+1}. `:prefixes[kind];
  if(!bare.trim()&&!emptyPlaceholder)return original;
  // Clicking the same style a second time returns it to a normal paragraph.
  if(toggle&&sameBlockStyle(marker,kind))return indentation+bare;
  const contents=bare||({task:'待办事项',quote:'引用内容',list:'列表项',orderedList:'列表项'}[kind]||'小标题');
  return indentation+prefix+contents;
}

/**
 * Format multiple selected lines consistently; empty gaps remain paragraphs.
 * Numbering increments within this selection, without touching adjacent text.
 */
export function formatBlockSelection(lines,kind){
  let index=0;
  const one=lines.length===1;
  const populated=lines.filter(line=>line.trim());
  const toggle=populated.length>0&&populated.every(line=>
    sameBlockStyle(line.trimStart().match(startToken)?.[0]||'',kind));
  return lines.map(line=>{
    const nonblank=line.trim()!=='';
    const next=formatBlockLine(line,kind,{index,emptyPlaceholder:one,toggle});
    if(nonblank)index++;
    return next;
  });
}

export const INLINE_WRAPS={
  bold:['**','**','加粗文字'],
  italic:['*','*','斜体文字'],
  strike:['~~','~~','删除文字'],
  code:['`','`','代码'],
  inlineMath:['$','$','\\frac{a}{b}'],
  link:['[','](https://)','链接文字']
};
const inlineTypes={bold:'strong',italic:'emphasis',strike:'strike',code:'code',inlineMath:'math',link:'link'};
function inlineBounds(part,source){
  if(part.type!=='math')return [part.innerFrom,part.innerTo];
  const size=source.startsWith('\\(',part.from)?2:1;
  return [part.from+size,part.to-size];
}

export function formatInlineSelection(selection,kind){
  if(!INLINE_WRAPS[kind])return null;
  const [before,after,placeholder]=INLINE_WRAPS[kind];
  const selected=String(selection);
  const styled=inlineSegments(selected).find(part=>part.type===inlineTypes[kind]&&part.from===0&&part.to===selected.length);
  if(styled){
    const [start,end]=inlineBounds(styled,selected);
    const unwrapped=selected.slice(start,end);
    return {text:unwrapped,caretFrom:0,caretTo:unwrapped.length};
  }
  const middle=selected||placeholder;
  return {text:before+middle+after,caretFrom:before.length,caretTo:before.length+middle.length};
}

/** Toggle the enclosing source span, including syntax outside the CM selection. */
export function formatInlineRange(source,from,to,kind){
  if(!INLINE_WRAPS[kind])return null;
  const [open,close]=INLINE_WRAPS[kind];
  // The toolbar keeps the inner text selected. Remove its immediate pair first,
  // even when that text contains another style (e.g. italic around bold).
  if(from<to&&source.slice(Math.max(0,from-open.length),from)===open&&source.slice(to,to+close.length)===close){
    const run=(at,step)=>{let count=0;while(source[at]===open[0]){count++;at+=step;}return count;};
    const valid=kind==='italic'?(run(from-1,-1)%2===1&&run(to,1)%2===1):
      kind==='inlineMath'?(source[from-2]!=='$'&&source[to+1]!=='$'):true;
    if(valid)return {from:from-open.length,to:to+close.length,text:source.slice(from,to),
      selectionFrom:from-open.length,selectionTo:to-open.length};
  }
  const lineStart=from===0?0:source.lastIndexOf('\n',from-1)+1;
  const lineEnd=source.indexOf('\n',to);
  const line=source.slice(lineStart,lineEnd<0?source.length:lineEnd);
  for(const part of inlineSegments(line)){
    if(part.type!==inlineTypes[kind])continue;
    const [innerFrom,innerTo]=inlineBounds(part,line);
    const start=from-lineStart,end=to-lineStart;
    if((start>=innerFrom&&end<=innerTo)||(start===part.from&&end===part.to)){
      const replaceFrom=lineStart+part.from;
      const clamp=value=>Math.max(0,Math.min(innerTo-innerFrom,value-innerFrom));
      return {from:replaceFrom,to:lineStart+part.to,text:line.slice(innerFrom,innerTo),
        selectionFrom:replaceFrom+clamp(start),selectionTo:replaceFrom+clamp(end)};
    }
  }
  const insertion=formatInlineSelection(source.slice(from,to),kind);
  return {from,to,text:insertion.text,selectionFrom:from+insertion.caretFrom,selectionTo:from+insertion.caretTo};
}

export const INSERT_TEMPLATES={
  blockMath:'$$\n\\sum_{i=1}^{n} i\n$$',
  codeBlock:'```text\n在此输入代码\n```',
  table:'| 项目 | 内容 |\n| --- | --- |\n| 名称 | 说明 |',
  rule:'---'
};

/** Code/math are toggled wrappers; tables and rules remain insertion commands. */
export function formatTemplateSelection(selection,kind,{startOfLine=true}={}){
  if(!INSERT_TEMPLATES[kind])return null;
  const selected=String(selection),trimmed=selected.trim();
  if(kind==='codeBlock'){
    const fence=trimmed.match(/^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1$/);
    if(fence)return fence[2];
  }
  if(kind==='blockMath'){
    const math=trimmed.match(/^\$\$\n([\s\S]*?)\n\$\$$|^\\\[\n([\s\S]*?)\n\\\]$/);
    if(math)return math[1]??math[2];
  }
  const template=kind==='codeBlock'&&selected?'```text\n'+selected+'\n```':
    kind==='blockMath'&&selected?'$$\n'+selected+'\n$$':INSERT_TEMPLATES[kind];
  return (startOfLine?'':'\n')+template+'\n';
}
