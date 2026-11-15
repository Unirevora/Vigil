/**
 * One-pane, three-mode Markdown composer powered by CodeMirror 5.
 * Live mode decorates non-active Markdown syntax and replaces completed formulas
 * with genuine KaTeX MathML widgets. Active source lines remain raw, so cursor,
 * selection, IME, undo and history remain CodeMirror's own data model.
 * Reader mode uses the very same pane, but renders a read-only HTML view.
 */
import {mathToHtml,findInlineMath} from '../core/math.js';
import {renderMarkdown} from '../core/markdown.js';
export const EDITOR_MODES=['live','reading','source'];
const MODE_KEY='vigil-editor-mode-v142';

export function readEditorMode(storage){
  try{const value=storage.getItem(MODE_KEY);return EDITOR_MODES.includes(value)?value:'live';}
  catch{return 'live';}
}
export function persistEditorMode(storage,mode){
  if(!EDITOR_MODES.includes(mode))return false;
  try{storage.setItem(MODE_KEY,mode);return true;}catch{return false;}
}
function mathWidget(latex,display,cm,position){
  const node=document.createElement(display?'div':'span');
  node.className=display?'cm-math-display':'cm-math-inline';
  node.setAttribute('aria-label','KaTeX 数学公式，点击查看源码');
  node.setAttribute('title','点击编辑公式源码');
  node.innerHTML=mathToHtml(latex,{displayMode:display});
  node.addEventListener('mousedown',e=>e.preventDefault());
  node.addEventListener('click',e=>{
    e.stopPropagation();cm.setCursor(position);cm.focus();
  });
  return node;
}
function richWidget(markup,cm,position,className='cm-block-widget'){
  const node=document.createElement('div');node.className=className;
  node.innerHTML=markup;
  node.title='点击修改这段 Markdown 源码';
  node.addEventListener('mousedown',event=>event.preventDefault());
  node.addEventListener('click',()=>{cm.setCursor(position);cm.focus();});
  return node;
}
function parseTable(lines,i){
  if(!lines[i]?.includes('|')||!lines[i+1])return null;
  const headers=lines[i].split('|').filter(Boolean).length;
  if(headers<2||!/^\s*\|?[\s:-]*-{3,}[\s|:-]*$/.test(lines[i+1]))return null;
  let end=i+1;
  while(end+1<lines.length&&lines[end+1].trim()&&lines[end+1].includes('|'))end++;
  return {start:i,end,source:lines.slice(i,end+1).join('\n')};
}
function parseBlockMath(lines,i){
  const line=lines[i],trim=line.trim();
  if(/^\$\$.+\$\$$/.test(trim))return {start:i,end:i,latex:trim.slice(2,-2)};
  if(trim!=='$$'&&trim!=='\\[')return null;
  const close=trim==='$$'?'$$':'\\]';
  const gathered=[];
  for(let j=i+1;j<Math.min(lines.length,i+90);j++){
    if(lines[j].trim()===close)return {start:i,end:j,latex:gathered.join('\n')};
    gathered.push(lines[j]);
  }
  return null;
}
export function mountUnifiedEditor({host,reader,onInput,initial,mode='live',minHeight=510}){
  if(!globalThis.CodeMirror)throw new Error('CodeMirror 未加载，请检查 vendor 目录');
  const cm=new globalThis.CodeMirror(host,{
    value:String(initial||''),mode:'markdown',lineNumbers:false,lineWrapping:true,
    viewportMargin:18,indentUnit:2,tabSize:2,indentWithTabs:false,
    smartIndent:true,autofocus:false,dragDrop:false,inputStyle:'textarea',
    extraKeys:{'Enter':'newlineAndIndentContinueMarkdownList',
      'Ctrl-B':()=>format('bold'),'Cmd-B':()=>format('bold'),
      'Ctrl-I':()=>format('italic'),'Cmd-I':()=>format('italic')}
  });
  const wrapper=cm.getWrapperElement();
  wrapper.classList.add('vigil-codemirror');
  wrapper.setAttribute('aria-label','Markdown 编辑区');
  wrapper.style.minHeight=`${minHeight}px`;
  reader.classList.add('unified-reader');
  let activeMode='source',decorations=[],lineClasses=[],frame=null,destroyed=false,updating=false;
  let previousActive='';

  function clearDecorations(){
    if(decorations.length===0&&lineClasses.length===0)return;
    cm.operation(()=>{
      for(const marker of decorations)marker.clear();
      decorations=[];
      for(const [line,cl] of lineClasses)cm.removeLineClass(line,'wrap',cl);
      lineClasses=[];
    });
  }
  const mark=(from,to,config)=>{
    if(from.line===to.line&&from.ch>=to.ch)return;
    const m=cm.markText(from,to,config);decorations.push(m);return m;
  };
  function hide(line,from,to){mark({line,ch:from},{line,ch:to},{collapsed:true,inclusiveLeft:false,inclusiveRight:false,clearOnEnter:true});}
  function addLine(line,className){cm.addLineClass(line,'wrap',className);lineClasses.push([line,className]);}
  function markInline(line,text){
    const covered=[];
    const inlineMath=findInlineMath(text);
    for(const math of inlineMath){
      if(!math.latex.trim())continue;
      const widget=mathWidget(math.latex,false,cm,{line,ch:math.from+1});
      mark({line,ch:math.from},{line,ch:math.to},{replacedWith:widget,clearOnEnter:true});
      covered.push([math.from,math.to]);
    }
    const occupied=(start,end)=>covered.some(([a,b])=>start<b&&end>a);
    const pattern=/(\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|`([^`\n]+)`|\*([^*\n]+)\*|_([^_\n]+)_|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\[\[([^\]\n]+)\]\])/g;
    for(const match of text.matchAll(pattern)){
      const full=match[0],from=match.index,to=from+full.length;
      if(occupied(from,to))continue;
      let prefix=0,suffix=0,className='';
      if(match[2]||match[3]){prefix=2;suffix=2;className='cm-live-bold';}
      else if(match[4]){prefix=2;suffix=2;className='cm-live-strike';}
      else if(match[5]){prefix=1;suffix=1;className='cm-live-code';}
      else if(match[6]||match[7]){prefix=1;suffix=1;className='cm-live-italic';}
      else if(match[8]){prefix=1;suffix=full.length-1-match[8].length;className='cm-live-link';}
      else if(match[10]){prefix=2;suffix=2;className='cm-live-link';}
      if(!className||to-prefix-suffix<=from)continue;
      hide(line,from,from+prefix);
      hide(line,to-suffix,to);
      mark({line,ch:from+prefix},{line,ch:to-suffix},{className});
      covered.push([from,to]);
    }
  }
  function activeLines(){
    const ranges=cm.listSelections(),set=new Set();
    for(const range of ranges){
      const start=Math.min(range.anchor.line,range.head.line);
      const end=Math.max(range.anchor.line,range.head.line);
      for(let i=start;i<=Math.min(end,start+80);i++)set.add(i);
    }
    return set;
  }
  function decorateNow(){
    if(destroyed||activeMode!=='live'||updating)return;
    updating=true;
    try{
      const lines=cm.getValue().split('\n');
      const active=activeLines();
      const vp=cm.getViewport();
      const from=Math.max(0,vp.from-16),to=Math.min(lines.length,vp.to+16);
      cm.operation(()=>{
        clearDecorations();
        let inFence=false;
        for(let j=0;j<from;j++)if(/^\s*```/.test(lines[j]))inFence=!inFence;
        for(let line=from;line<to;line++){
          const text=lines[line];
          if(/^\s*```/.test(text)){
            addLine(line,'cm-live-fence');inFence=!inFence;continue;
          }
          if(inFence){addLine(line,'cm-live-codeblock');continue;}
          const table=parseTable(lines,line);
          if(table && table.end<to &&
             !Array.from({length:table.end-line+1},(_,i)=>line+i).some(i=>active.has(i))){
            mark({line,ch:0},{line:table.end,ch:lines[table.end].length},{
              replacedWith:richWidget(renderMarkdown(table.source),cm,{line,ch:0},'cm-table-widget'),clearOnEnter:true});
            line=table.end;continue;
          }
          const block=parseBlockMath(lines,line);
          if(block && block.end<to){
            const editable=Array.from({length:block.end-line+1},(_,i)=>line+i).some(i=>active.has(i));
            if(!editable){
              mark({line,ch:0},{line:block.end,ch:lines[block.end].length},{
                replacedWith:mathWidget(block.latex,true,cm,{line,ch:2}),clearOnEnter:true});
              line=block.end;continue;
            }
          }
          if(active.has(line)){
            addLine(line,'cm-live-active-line');continue;
          }
          const heading=text.match(/^(\s*)(#{1,6})\s+(.+)$/);
          if(heading){
            const number=heading[2].length;
            addLine(line,`cm-live-heading cm-live-h${number}`);
            hide(line,0,heading[1].length+number+1);
          }else if(/^\s*>\s/.test(text)){
            addLine(line,'cm-live-quote');
            const prefix=text.match(/^\s*>\s/)[0].length;
            hide(line,0,prefix);
          }else if(/^\s*[-*+]\s/.test(text)){
            addLine(line,'cm-live-list');
            const task=text.match(/^(\s*[-*+]\s+)\[([ xX])\]\s/);
            if(task){
              const checkbox=document.createElement('input');
              checkbox.type='checkbox';checkbox.className='cm-live-task';
              checkbox.checked=task[2].toLowerCase()==='x';
              checkbox.title=checkbox.checked?'标记为未完成':'标记为完成';
              checkbox.addEventListener('mousedown',e=>e.stopPropagation());
              checkbox.addEventListener('click',e=>e.stopPropagation());
              checkbox.addEventListener('change',()=>{
                cm.replaceRange(task[1]+'['+(checkbox.checked?'x':' ')+'] ',
                  {line,ch:0},{line,ch:task[0].length});
              });
              mark({line,ch:0},{line,ch:task[0].length},{replacedWith:checkbox,clearOnEnter:true});
            }
          }
          markInline(line,text);
        }
      });
      previousActive=[...active].join(',');
    }finally{updating=false;}
  }
  function scheduleDecorate(){
    if(destroyed||activeMode!=='live'||frame!==null)return;
    frame=requestAnimationFrame(()=>{frame=null;decorateNow();});
  }
  function onChanges(){
    if(destroyed)return;
    onInput(cm.getValue());
    if(activeMode==='reading')reader.innerHTML=renderMarkdown(cm.getValue());
    scheduleDecorate();
  }
  function onCursor(){
    if(destroyed||activeMode!=='live'||updating)return;
    const next=[...activeLines()].join(',');
    if(next!==previousActive)scheduleDecorate();
  }
  function setMode(mode){
    if(!EDITOR_MODES.includes(mode))return;
    if(frame!==null){cancelAnimationFrame(frame);frame=null;}
    const old=activeMode;activeMode=mode;
    wrapper.hidden=mode==='reading';
    reader.hidden=mode!=='reading';
    host.dataset.mode=mode;
    if(mode==='reading'){
      clearDecorations();
      reader.innerHTML=renderMarkdown(cm.getValue());
    }else{
      if(mode==='source')clearDecorations();
      if(mode==='live')scheduleDecorate();
      if(old==='reading')requestAnimationFrame(()=>cm.refresh());
    }
  }
  function getValue(){return cm.getValue();}
  function format(kind){
    if(activeMode==='reading')setMode('live');
    const opts={
      bold:['**','**','加粗文字'],italic:['*','*','斜体文字'],
      heading:['## ','','小标题'],list:['- ','','列表项'],quote:['> ','','引用内容'],
      code:['`','`','代码'],link:['[','](https://example.com)','链接文字'],
      inlineMath:['$','$','\\frac{a}{b}'],blockMath:['$$\n','\n$$','\\sum_{i=1}^{n} i'],
      strike:['~~','~~','删除文字'],
      task:['- [ ] ','','待办事项'],
      table:['| 项目 | 内容 |\n| --- | --- |\n| ',' | 说明 |','第一项']
    };
    const [prefix,suffix,placeholder]=opts[kind]||opts.bold;
    const selected=cm.getSelection();
    cm.replaceSelection(prefix+(selected||placeholder)+suffix,'around');
    cm.focus();
  }
  function findNext(query,{reverse=false}={}){
    const term=String(query||'');if(!term)return false;
    if(activeMode==='reading')setMode('live');
    const text=cm.getValue(),lower=text.toLocaleLowerCase(),needle=term.toLocaleLowerCase();
    const sel=cm.getDoc().listSelections()[0];
    let position=cm.indexFromPos(reverse?sel.from():sel.to());
    let match=reverse?lower.lastIndexOf(needle,Math.max(0,position-1)):lower.indexOf(needle,position);
    if(match===-1)match=reverse?lower.lastIndexOf(needle):lower.indexOf(needle);
    if(match===-1)return false;
    cm.setSelection(cm.posFromIndex(match),cm.posFromIndex(match+term.length));
    cm.scrollIntoView({from:cm.posFromIndex(match),to:cm.posFromIndex(match+term.length)},110);
    cm.focus();return true;
  }
  function replaceMatch(query,replacement){
    const selected=cm.getSelection();
    if(selected&&selected.toLocaleLowerCase()===String(query).toLocaleLowerCase()){
      cm.replaceSelection(String(replacement));return true;
    }
    return false;
  }
  function replaceAll(query,replacement){
    if(!query)return 0;
    const value=cm.getValue(),find=String(query),lower=value.toLocaleLowerCase(),target=find.toLocaleLowerCase();
    let at=0,count=0,parts=[],index;
    while((index=lower.indexOf(target,at))!==-1){
      parts.push(value.slice(at,index),String(replacement));count++;at=index+find.length;
      if(count>20000)break;
    }
    if(!count)return 0;
    parts.push(value.slice(at));
    const final=parts.join('');
    const last=cm.lineCount()-1;
    cm.replaceRange(final,{line:0,ch:0},{line:last,ch:cm.getLine(last).length});
    return count;
  }
  function focus(){cm.focus();}
  function destroy(){
    destroyed=true;
    if(frame!==null){cancelAnimationFrame(frame);frame=null;}
    clearDecorations();
    cm.off('changes',onChanges);cm.off('cursorActivity',onCursor);
    cm.off('viewportChange',scheduleDecorate);
    wrapper.remove();
  }
  cm.on('changes',onChanges);
  cm.on('cursorActivity',onCursor);
  cm.on('viewportChange',scheduleDecorate);
  setMode(mode);
  return {getValue,setMode,getMode:()=>activeMode,format,findNext,replaceMatch,replaceAll,focus,destroy,cm,refresh:()=>cm.refresh()};
}
