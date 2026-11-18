/**
 * VIGIL manuscript compositor · editable Markdown, live typography, one DOM.
 *
 * Live preview is not a second window. CodeMirror 5 owns the source, cursor,
 * selection, IME, and undo stack. Decorations only modify its presentation.
 * The active line retains visible syntax while its TEXT ALREADY HAS the final
 * typography. Inactive lines hide syntax; math/table/code may use safe widgets.
 *
 * Raw Markdown is ALWAYS the only persisted content.
 */
import {mathToHtml} from '../core/math.js';
import {renderMarkdown} from '../core/markdown.js';
import {BLOCK_FORMATS,formatBlockSelection,INLINE_WRAPS,formatInlineRange,INSERT_TEMPLATES,formatTemplateSelection} from './formatting.js';
import {
  inlineSegments,markdownHeading,markdownListMarker,markdownRule,markdownTableAt,
  markdownMathBlockAt,markdownFenceAt,markdownQuoteAt,markdownSafeStart
} from './live-markdown.js';

// Repaint window around the rendered viewport, and how close the viewport may
// get to the window edge before it is repainted. Scrolling inside the window
// never rebuilds decorations, so nothing flickers or changes height mid-drag.
const PAINT_PAD=70,PAINT_TRIGGER=18;

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
function mathNode(latex,display){
  const node=document.createElement(display?'div':'span');
  node.className=display?'cm-math-display':'cm-math-inline';
  node.innerHTML=mathToHtml(latex,{displayMode:display});
  node.setAttribute('aria-label','公式渲染结果');
  return node;
}
function renderedBlock(html,className='cm-rendered-block'){
  const node=document.createElement('div');
  node.className=className;
  node.innerHTML=html;
  return node;
}
function visualMarker(kind,number){
  const node=document.createElement('span');
  node.className='cm-rendered-marker';
  node.setAttribute('aria-hidden','true');
  node.textContent=kind==='bullet'?'•':kind==='ordered'?String(number)+'.':'›';
  return node;
}

export function mountUnifiedEditor({host,reader,onInput,initial,mode='live',minHeight=0}){
  if(!globalThis.CodeMirror)throw new Error('CodeMirror 未加载，请检查 vendor 目录');
  const cm=new globalThis.CodeMirror(host,{
    value:String(initial||''),mode:'markdown',lineNumbers:false,lineWrapping:true,
    viewportMargin:20,indentUnit:2,tabSize:2,indentWithTabs:false,
    smartIndent:true,autofocus:false,dragDrop:false,inputStyle:'textarea',
    extraKeys:{'Enter':'newlineAndIndentContinueMarkdownList',
      'Ctrl-B':()=>format('bold'),'Cmd-B':()=>format('bold'),
      'Ctrl-I':()=>format('italic'),'Cmd-I':()=>format('italic')}
  });
  const wrapper=cm.getWrapperElement();
  wrapper.classList.add('vigil-codemirror');
  wrapper.setAttribute('aria-label','Markdown 编辑区');
  if(minHeight>0)wrapper.style.minHeight=`${minHeight}px`;
  reader.classList.add('unified-reader');
  const input=cm.getInputField();
  let activeMode='source',decorations=[],lineClasses=[],lineWidgets=[];
  let lowerCache='';
  let frame=null,destroyed=false,painting=false,composing=false,activeFingerprint='';
  let lastReaderSource=null,painted=null;

  function clearDecorations(){
    painted=null;
    for(const marker of decorations)marker.clear();
    decorations=[];
    for(const widget of lineWidgets)widget.clear();
    lineWidgets=[];
    for(const [line,cl] of lineClasses)cm.removeLineClass(line,'wrap',cl);
    lineClasses=[];
  }
  function mark(from,to,options){
    if(from.line===to.line&&from.ch>=to.ch)return null;
    const result=cm.markText(from,to,options);
    decorations.push(result);return result;
  }
  function hide(line,from,to){
    if(to>from)mark({line,ch:from},{line,ch:to},
      {collapsed:true,inclusiveLeft:false,inclusiveRight:false,clearOnEnter:true});
  }
  function style(line,from,to,className){
    if(to>from)mark({line,ch:from},{line,ch:to},{className,clearOnEnter:false});
  }
  function addClass(line,cl){cm.addLineClass(line,'wrap',cl);lineClasses.push([line,cl]);}
  function replaceRange(start,end,node){
    mark({line:start,ch:0},{line:end,ch:cm.getLine(end).length},{
      replacedWith:node,clearOnEnter:true,handleMouseEvents:false
    });
    node.addEventListener('mousedown',e=>e.preventDefault());
    node.addEventListener('click',()=>{cm.setCursor({line:start,ch:0});cm.focus();});
  }
  function previewUnderLine(end,node){
    node.classList.add('cm-active-block-preview');
    node.addEventListener('mousedown',event=>event.preventDefault());
    // The slot owns the vertical spacing as padding. Margins on a line widget
    // are not counted by CodeMirror's height measurement and skew every line below.
    const slot=document.createElement('div');
    slot.className='cm-preview-slot';
    slot.appendChild(node);
    lineWidgets.push(cm.addLineWidget(end,slot,{coverGutter:false,noHScroll:true,above:false}));
  }
  function selectionLines(){
    const set=new Set();
    for(const range of cm.listSelections()){
      const a=Math.min(range.anchor.line,range.head.line),b=Math.max(range.anchor.line,range.head.line);
      for(let i=a;i<=Math.min(b,a+400);i++)set.add(i);
    }
    return set;
  }
  function paintInline(line,text,active){
    const segs=inlineSegments(text);
    for(const seg of segs){
      if(seg.type==='math'){
        const widget=mathNode(seg.latex,false);
        if(active){
          // The actual TeX source remains editable and the rendered formula
          // sits directly after it ON THE SAME LINE. A bookmark changes only
          // the display, not text or undo history.
          style(line,seg.from,seg.to,'cm-live-math-source');
          widget.classList.add('cm-math-active-inline');
          const bookmark=cm.setBookmark({line,ch:seg.to},{widget,insertLeft:false,handleMouseEvents:false});
          decorations.push(bookmark);
        }else{
          mark({line,ch:seg.from},{line,ch:seg.to},{replacedWith:widget,clearOnEnter:true});
          widget.title='点击编辑公式';
          widget.addEventListener('mousedown',e=>e.preventDefault());
          widget.addEventListener('click',()=>{cm.setCursor({line,ch:seg.from+1});cm.focus();});
        }
        continue;
      }
      if(seg.type==='styled'){
        // CSS comes from the same restricted typography sanitizer as Reader.
        const names=['cm-live-styled',...seg.classes.split(/\s+/).filter(Boolean)];
        const marker=cm.markText({line,ch:seg.innerFrom},{line,ch:seg.innerTo},
          {className:names.join(' '),css:seg.css,clearOnEnter:false});
        decorations.push(marker);
        if(active){
          style(line,seg.from,seg.innerFrom,'cm-live-syntax');
          style(line,seg.innerTo,seg.to,'cm-live-syntax');
        }else{
          hide(line,seg.innerTo,seg.to);
          hide(line,seg.from,seg.innerFrom);
        }
        continue;
      }
      const name={strong:'cm-live-bold',emphasis:'cm-live-italic',strike:'cm-live-strike',
        code:'cm-live-code',link:'cm-live-link',wikilink:'cm-live-link'}[seg.type];
      if(!name)continue;
      // Markdown markers are visible while editing the current line, but
      // its text is ALREADY visually bold/italic/struck/linked.
      style(line,seg.innerFrom,seg.innerTo,name);
      if(active){
        style(line,seg.from,seg.innerFrom,'cm-live-syntax');
        style(line,seg.innerTo,seg.to,'cm-live-syntax');
      }else{
        hide(line,seg.innerTo,seg.to);
        hide(line,seg.from,seg.innerFrom);
      }
    }
  }
  function paintSimpleLine(line,text,active){
    const heading=markdownHeading(text);
    if(heading){
      addClass(line,`cm-live-heading cm-live-h${heading.level}`);
      if(active)style(line,0,heading.prefix,'cm-live-syntax');
      else hide(line,0,heading.prefix);
    }else if(markdownRule(text)){
      addClass(line,'cm-live-rule');
      if(!active){
        const hr=document.createElement('span');
        hr.className='cm-live-hr';hr.setAttribute('aria-hidden','true');
        mark({line,ch:0},{line,ch:text.length},{replacedWith:hr,clearOnEnter:true});
      }
    }else if(/^\s*>\s?/.test(text)){
      addClass(line,/^\s*>\s?\[![a-z]/i.test(text)?'cm-live-quote cm-live-callout':'cm-live-quote');
      const prefix=text.match(/^\s*>\s?/)[0].length;
      if(active)style(line,0,prefix,'cm-live-syntax');
      else hide(line,0,prefix);
    }else{
      const marker=markdownListMarker(text);
      if(marker){
        addClass(line,'cm-live-list');
        if(active){
          style(line,0,marker.prefix,'cm-live-syntax');
        }else if(marker.kind==='task'){
          const check=document.createElement('input');
          check.type='checkbox';check.className='cm-live-task';check.checked=marker.checked;
          check.setAttribute('aria-label',marker.checked?'标记为未完成':'标记为完成');
          check.addEventListener('mousedown',e=>e.stopPropagation());
          check.addEventListener('click',e=>e.stopPropagation());
          check.addEventListener('change',()=>{
            const value=cm.getLine(line),old=markdownListMarker(value);
            if(!old||old.kind!=='task')return;
            const next=value.slice(0,old.prefix).replace(/\[([ xX])\]/,'['+(check.checked?'x':' ')+']');
            cm.replaceRange(next,{line,ch:0},{line,ch:old.prefix});cm.focus();
          });
          mark({line,ch:0},{line,ch:marker.prefix},{replacedWith:check,clearOnEnter:true});
        }else if(marker.kind==='bullet'){
          mark({line,ch:0},{line,ch:marker.prefix},
            {replacedWith:visualMarker('bullet'),clearOnEnter:true});
        }else{
          // Keep numbers visible and meaningful, but de-emphasize punctuation.
          style(line,0,marker.prefix,'cm-live-syntax');
        }
      }
    }
    paintInline(line,text,active);
  }
  function decorateNow(){
    if(destroyed||activeMode!=='live'||painting||composing)return;
    painting=true;
    try{
      const active=selectionLines(),viewport=cm.getViewport();
      const gen=cm.changeGeneration(),fingerprint=[...active].join(',');
      const total=cm.lineCount();
      if(painted&&painted.gen===gen&&painted.fingerprint===fingerprint&&painted.total===total&&
         (painted.from===0||viewport.from>=painted.from+PAINT_TRIGGER)&&
         (painted.to>=total||viewport.to<=painted.to-PAINT_TRIGGER))return;
      const lines=cm.getValue().split('\n');
      // Window edges never fall inside a fence/math/table/quote, otherwise the
      // cut-off lines would be painted as ordinary prose and change on scroll.
      const begin=markdownSafeStart(lines,Math.max(0,viewport.from-PAINT_PAD));
      let end=Math.min(lines.length,viewport.to+PAINT_PAD);
      while(end<lines.length&&end-viewport.to<PAINT_PAD+300&&lines[end].trim())end++;
      // Window coordinates keep the anchor tied to the visible line even when
      // CodeMirror's virtual viewport has a non-zero viewOffset.
      const scroll=cm.getScrollInfo();
      let anchor=null;
      if(scroll.top>0){
        const viewportTop=cm.getScrollerElement().getBoundingClientRect().top;
        const position=cm.coordsChar({left:0,top:viewportTop},'window');
        const line=Math.max(0,Math.min(total-1,position.line));
        anchor={line,offset:viewportTop-cm.charCoords({line,ch:0},'window').top};
      }
      cm.operation(()=>{
        clearDecorations();
        for(let i=begin;i<end;i++){
          const text=lines[i],editable=active.has(i);
          // Excess blank lines are source text, but Live Preview only needs
          // one visual paragraph gap. Collapse the remainder reversibly;
          // entering that range restores normal CodeMirror editing.
          if(!text.trim()){
            let blankEnd=i;
            while(blankEnd+1<end&&!lines[blankEnd+1].trim())blankEnd++;
            let _anyActiveBlank=false;for(let _kb=i;_kb<=blankEnd;_kb++)if(active.has(_kb)){_anyActiveBlank=true;break;}
            if(blankEnd>i && !_anyActiveBlank){
              const from={line:i+1,ch:0};
              const to=blankEnd+1<lines.length?{line:blankEnd+1,ch:0}:{line:blankEnd,ch:0};
              if(to.line>from.line)mark(from,to,{collapsed:true,clearOnEnter:true});
              i=blankEnd;continue;
            }
          }
          const fence=markdownFenceAt(lines,i);
          const math=markdownMathBlockAt(lines,i);
          const table=markdownTableAt(lines,i);
          const quote=markdownQuoteAt(lines,i);
          const block=fence||math||table||quote;
          if(block&&block.end>=end&&block.end-i<400)end=Math.min(lines.length,block.end+1);
          if(block&&block.end<end){
            let inSelection=false;for(let _ki=i;_ki<=block.end;_ki++)if(active.has(_ki)){inSelection=true;break;}
            if(!inSelection){
              const node=math?mathNode(math.latex,true):renderedBlock(renderMarkdown(block.source),
                fence?'cm-code-widget':quote?'cm-quote-widget':'cm-table-widget');
              replaceRange(i,block.end,node);
              i=block.end;continue;
            }
            // Keep the real source while the cursor is inside; render a real
            // preview on this same sheet, after the last source line.
            for(let line=i;line<=block.end;line++){
              addClass(line,fence?'cm-live-codeblock':math?'cm-live-formula-source':quote?'cm-live-quote-source':'cm-live-table-source');
            }
            const node=math?mathNode(math.latex,true):renderedBlock(renderMarkdown(block.source),
              fence?'cm-code-widget':quote?'cm-quote-widget':'cm-table-widget');
            previewUnderLine(block.end,node);
            i=block.end;continue;
          }
          paintSimpleLine(i,text,editable);
        }
      });
      if(anchor){
        const viewportTop=cm.getScrollerElement().getBoundingClientRect().top;
        const offset=viewportTop-cm.charCoords({line:anchor.line,ch:0},'window').top;
        const top=cm.getScrollInfo().top+anchor.offset-offset;
        if(Math.abs(top-cm.getScrollInfo().top)>.5)cm.scrollTo(null,top);
      }
      activeFingerprint=fingerprint;
      painted={from:begin,to:end,gen,fingerprint,total};
    }finally{painting=false;}
  }
  function scheduleDecorate(){
    if(destroyed||activeMode!=='live'||composing||frame!==null)return;
    frame=requestAnimationFrame(()=>{frame=null;decorateNow();});
  }
  function updateReading(){
    const source=cm.getValue();
    if(lastReaderSource===source)return;
    reader.innerHTML=renderMarkdown(source);
    lastReaderSource=source;
  }
  function onChanges(){
    if(destroyed)return;
    onInput(cm.getValue());
    lowerCache='';// invalidate case-insensitive cache on content change
    if(activeMode==='reading')updateReading();
    scheduleDecorate();
  }
  function onCursor(){
    if(destroyed||activeMode!=='live'||painting||composing)return;
    const current=[...selectionLines()].join(',');
    if(current!==activeFingerprint)scheduleDecorate();
  }
  function onCompositionStart(){composing=true;}
  function onCompositionEnd(){composing=false;scheduleDecorate();}
  function setMode(mode){
    if(!EDITOR_MODES.includes(mode))return;
    if(frame!==null){cancelAnimationFrame(frame);frame=null;}
    const old=activeMode;
    activeMode=mode;
    wrapper.hidden=mode==='reading';reader.hidden=mode!=='reading';
    host.dataset.mode=mode;
    const pane=host.closest('.unified-manuscript');
    if(pane)pane.dataset.mode=mode;
    if(mode==='reading'){
      cm.operation(clearDecorations);
      updateReading();
    }else{
      if(mode==='source')cm.operation(clearDecorations);
      if(mode==='live')scheduleDecorate();
      if(old==='reading')requestAnimationFrame(()=>{if(!destroyed)cm.refresh();});
    }
  }
  function getValue(){return cm.getValue();}
  function format(kind){
    if(activeMode==='reading')setMode('live');
    if(BLOCK_FORMATS.has(kind)){
      const doc=cm.getDoc(),begin=doc.getCursor('from'),end=doc.getCursor('to');
      const last=end.line>begin.line&&end.ch===0?end.line-1:end.line;
      const first=Math.min(begin.line,last),finish=Math.max(first,last);
      const original=[];
      for(let line=first;line<=finish;line++)original.push(cm.getLine(line));
      const transformed=formatBlockSelection(original,kind);
      const from={line:first,ch:0},to={line:finish,ch:cm.getLine(finish).length};
      const oldLength=original[0].length,newLength=transformed[0].length;
      cm.replaceRange(transformed.join('\n'),from,to,'+format');
      if(finish===first){
        const delta=newLength-oldLength;
        cm.setCursor({line:first,ch:Math.max(0,Math.min(newLength,begin.ch+delta))});
      }else{
        cm.setSelection({line:first,ch:0},{line:finish,ch:transformed.at(-1).length});
      }
      cm.focus();return;
    }
    if(INLINE_WRAPS[kind]){
      const insertion=formatInlineRange(cm.getValue(),cm.indexFromPos(cm.getCursor('from')),
        cm.indexFromPos(cm.getCursor('to')),kind);
      cm.replaceRange(insertion.text,cm.posFromIndex(insertion.from),cm.posFromIndex(insertion.to),'+format');
      cm.setSelection(cm.posFromIndex(insertion.selectionFrom),cm.posFromIndex(insertion.selectionTo));
      cm.focus();return;
    }
    if(INSERT_TEMPLATES[kind]){
      const selected=cm.getSelection(),cursor=cm.getCursor('from');
      const text=formatTemplateSelection(selected,kind,{startOfLine:cursor.ch===0});
      cm.replaceSelection(text,'around','+format');
      cm.focus();return;
    }
  }
  function findNext(query,{reverse=false}={}){
    const term=String(query||'');if(!term)return false;
    if(activeMode==='reading')setMode('live');
    const text=cm.getValue();
    if(!lowerCache)lowerCache=text.toLocaleLowerCase();
    const lower=lowerCache,needle=term.toLocaleLowerCase();
    const sel=cm.getDoc().listSelections()[0];
    const position=cm.indexFromPos(reverse?sel.from():sel.to());
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
    const final=parts.join(''),last=cm.lineCount()-1;
    cm.replaceRange(final,{line:0,ch:0},{line:last,ch:cm.getLine(last).length});
    return count;
  }
  function getOutline(){
    const headings=[];
    cm.eachLine(line=>{
      const parsed=markdownHeading(line.text);
      if(parsed)headings.push({...parsed,line:cm.getLineNumber(line)});
    });
    return headings;
  }
  function goToLine(line){
    if(activeMode==='reading')setMode('live');
    const target=Math.max(0,Math.min(cm.lineCount()-1,Number(line)||0));
    cm.setCursor(target,0);cm.scrollIntoView({line:target,ch:0},120);cm.focus();
  }
  function focus(){cm.focus();}
  // Web fonts that arrive after first paint change glyph metrics; CodeMirror must
  // re-measure or the caret, selection and hidden-syntax boundaries drift off their text.
  function onFontsLoaded(){if(!destroyed&&activeMode!=='reading')cm.refresh();}
  function destroy(){
    destroyed=true;
    if(frame!==null){cancelAnimationFrame(frame);frame=null;}
    cm.operation(clearDecorations);
    cm.off('changes',onChanges);cm.off('cursorActivity',onCursor);
    cm.off('viewportChange',scheduleDecorate);
    globalThis.document?.fonts?.removeEventListener?.('loadingdone',onFontsLoaded);
    input.removeEventListener('compositionstart',onCompositionStart);
    input.removeEventListener('compositionend',onCompositionEnd);
    wrapper.remove();
  }
  input.addEventListener('compositionstart',onCompositionStart);
  input.addEventListener('compositionend',onCompositionEnd);
  cm.on('changes',onChanges);
  cm.on('cursorActivity',onCursor);
  cm.on('viewportChange',scheduleDecorate);
  globalThis.document?.fonts?.addEventListener?.('loadingdone',onFontsLoaded);
  globalThis.document?.fonts?.ready?.then(onFontsLoaded).catch(()=>{});
  setMode(mode);
  return {getValue,setMode,getMode:()=>activeMode,format,findNext,replaceMatch,
    replaceAll,focus,destroy,getOutline,goToLine,
    undo:()=>cm.undo(),redo:()=>cm.redo(),cm,refresh:()=>cm.refresh()};
}
