/**
 * KaTeX 0.x math rendering in native MathML: no external fonts required.
 * The parser/renderer is vendored locally, not loaded from the network.
 */
import katex from '../../vendor/katex/katex.mjs';
import {escapeHtml} from './format.js';

export const KATEX_VERSION=katex.version;
const OPTIONS=Object.freeze({output:'mathml',trust:false,throwOnError:false,strict:'ignore',maxExpand:500,maxSize:10});
export function mathToHtml(latex,{displayMode=false}={}){
  const raw=String(latex??'');
  if(raw.length>12000)return `<span class="math-error" title="公式过长">${escapeHtml(raw.slice(0,100))}…</span>`;
  try{
    return katex.renderToString(raw,{...OPTIONS,displayMode});
  }catch(error){
    return `<span class="math-error" title="${escapeHtml(String(error?.message||'公式无法解析'))}">${escapeHtml(raw)}</span>`;
  }
}
/** Scan inline math spans without crossing newlines. Skip escaped dollars and
 * currency such as "$5 and $10" (requires no whitespace next to delimiters).
 */
export function findInlineMath(text){
  const s=String(text||''),spans=[];
  let i=0;
  while(i<s.length){
    if(s[i]==='\\'&&s[i+1]==='('){
      const close=s.indexOf('\\)',i+2);
      if(close!==-1&&!s.slice(i+2,close).includes('\n')){
        spans.push({from:i,to:close+2,latex:s.slice(i+2,close),display:false});
        i=close+2;continue;
      }
    }
    if(s[i]==='\\'){i+=2;continue;}
    if(s[i]==='$' && s[i+1]!=='$' && i+1<s.length && !/\s/.test(s[i+1])){
      let j=i+1,found=false;
      while(j<s.length){
        if(s[j]==='\\'){j+=2;continue;}
        if(s[j]==='\n')break;
        if(s[j]==='$'&&s[j-1]!=='$'&&!/\s/.test(s[j-1])){
          spans.push({from:i,to:j+1,latex:s.slice(i+1,j),display:false});
          i=j+1;found=true;break;
        }
        j++;
      }
      if(found)continue;
    }
    i++;
  }
  return spans;
}
export function renderInlineMathSafe(text,renderOrdinary){
  let out='',from=0;
  for(const piece of findInlineMath(text)){
    if(piece.from<from)continue;
    out+=renderOrdinary(text.slice(from,piece.from));
    out+=`<span class="math-inline" data-math="inline">${mathToHtml(piece.latex)}</span>`;
    from=piece.to;
  }
  out+=renderOrdinary(text.slice(from));
  return out;
}
export function renderBlockMath(latex){
  return `<div class="math-display" data-math="block">${mathToHtml(latex,{displayMode:true})}</div>`;
}
