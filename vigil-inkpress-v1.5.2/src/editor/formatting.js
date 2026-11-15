/**
 * Document-safe formatting primitives for the common Markdown toolbar.
 * They only operate on the lines the user selected, never on rendered HTML.
 */
export const BLOCK_FORMATS=new Set([
  'heading1','heading','heading3','heading4','heading5','heading6',
  'list','orderedList','task','quote'
]);

const prefixes={
  heading1:'# ',heading:'## ',heading3:'### ',heading4:'#### ',
  heading5:'##### ',heading6:'###### ',list:'- ',task:'- [ ] ',quote:'> '
};
const startToken=/^(?:#{1,6}[ \t]+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/;

/** Preserve indentation and text, replacing exactly one block marker. */
export function formatBlockLine(text,kind,{index=0,emptyPlaceholder=false}={}){
  if(!BLOCK_FORMATS.has(kind))return text;
  const original=String(text);
  const indentation=original.match(/^[ \t]*/)[0];
  const visible=original.slice(indentation.length);
  const marker=visible.match(startToken)?.[0]||'';
  const bare=marker?visible.slice(marker.length):visible;
  const prefix=kind==='orderedList'?`${index+1}. `:prefixes[kind];
  if(!bare.trim()&&!emptyPlaceholder)return original;
  // Clicking the same style a second time returns it to a normal paragraph.
  if(marker===prefix)return indentation+bare;
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
  return lines.map(line=>{
    const nonblank=line.trim()!=='';
    const next=formatBlockLine(line,kind,{index,emptyPlaceholder:one});
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

export function formatInlineSelection(selection,kind){
  if(!INLINE_WRAPS[kind])return null;
  const [before,after,placeholder]=INLINE_WRAPS[kind];
  const selected=String(selection);
  if(selected.startsWith(before)&&selected.endsWith(after)&&selected.length>before.length+after.length){
    const unwrapped=selected.slice(before.length,selected.length-after.length);
    return {text:unwrapped,caretFrom:0,caretTo:unwrapped.length};
  }
  const middle=selected||placeholder;
  return {text:before+middle+after,caretFrom:before.length,caretTo:before.length+middle.length};
}

export const INSERT_TEMPLATES={
  blockMath:'$$\n\\sum_{i=1}^{n} i\n$$',
  codeBlock:'```text\n在此输入代码\n```',
  table:'| 项目 | 内容 |\n| --- | --- |\n| 名称 | 说明 |',
  rule:'---'
};
