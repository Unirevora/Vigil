import { escapeHtml } from './format.js';
import {renderInlineMathSafe,renderBlockMath} from './math.js';

// Markdown is escaped before the tiny allowlisted renderer adds tags.
// No raw HTML execution, external Markdown runtime, or unsafe link protocols.

function isSafeLink(url) {
  try { const u = new URL(url); return ['https:','http:','mailto:'].includes(u.protocol); }
  catch { return false; }
}

function inlinePlain(text) {
  const chunks = String(text).split(/(`[^`\n]+`|\[[^\]]+\]\([^)]+\)|\[\[[^\]\n]+\]\])/g);
  return chunks.map(part => {
    if (/^`[^`\n]+`$/.test(part)) return `<code>${escapeHtml(part.slice(1,-1))}</code>`;
    const wikilink=part.match(/^\[\[([^\]\n]+)\]\]$/);
    if(wikilink)return `<button type="button" class="wiki-link" data-action="wiki-open" data-title="${escapeHtml(wikilink[1])}">${escapeHtml(wikilink[1])}</button>`;
    const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return isSafeLink(link[2]) ? `<a href="${escapeHtml(link[2])}" target="_blank" rel="noopener noreferrer">${escapeHtml(link[1])}</a>` : escapeHtml(link[1]);
    return escapeHtml(part)
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/__(.+?)__/g,'<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
      .replace(/_([^_\n]+)_/g,'<em>$1</em>')
      .replace(/~~(.+?)~~/g,'<del>$1</del>');
  }).join('');
}

function splitTableRow(line){
  return line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(c=>c.trim().replace(/\\\|/g,'|'));
}
function tableSeparator(text){
  return /^\s*\|?[ \t]*:?-{3,}:?(?:[ \t]*\|[ \t]*:?-{3,}:?)*[ \t]*\|?\s*$/.test(text);
}
function inlineMarkdown(text){
  // Code spans must stay literal; math is only evaluated outside backticks.
  return String(text).split(/(`[^`\n]*`)/g).map(part=>
    part.startsWith('`')&&part.endsWith('`')
      ? `<code>${escapeHtml(part.slice(1,-1))}</code>`
      : renderInlineMathSafe(part,inlinePlain)
  ).join('');
}

export function renderMarkdown(source) {
  const lines=String(source||'').replace(/\r\n/g,'\n').split('\n');
  let out='',i=0;
  while (i<lines.length) {
    let line=lines[i];
    const mathOpening=line.trim();
    if(mathOpening==='$$' || mathOpening==='\\['){
      const close=mathOpening==='$$'?'$$':'\\]';
      const start=i+1,buf=[];
      i++;
      while(i<lines.length && lines[i].trim()!==close)buf.push(lines[i++]);
      if(i<lines.length){i++;out+=renderBlockMath(buf.join('\n'));continue;}
      // Unclosed formula is source text, not a destructive half-render.
      i=start-1;out+=`<p>${escapeHtml(lines[i++])}</p>`;continue;
    }
    if(/^\s*\$\$.+\$\$\s*$/.test(line)){
      out+=renderBlockMath(line.trim().slice(2,-2));i++;continue;
    }
    if(i+1<lines.length && line.includes('|') && tableSeparator(lines[i+1])){
      const header=splitTableRow(line),sep=splitTableRow(lines[i+1]);
      if(header.length>1 && header.length===sep.length){
        i+=2;
        let rows='';
        while(i<lines.length && lines[i].includes('|') && lines[i].trim()){
          const cells=splitTableRow(lines[i++]);
          rows+=`<tr>${header.map((_,index)=>`<td>${inlineMarkdown(cells[index]||'')}</td>`).join('')}</tr>`;
        }
        out+=`<table><thead><tr>${header.map(cell=>`<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
        continue;
      }
    }
    if (/^ *```/.test(line)) {
      i++;const code=[];
      while (i<lines.length && !/^ *```/.test(lines[i])) code.push(lines[i++]);
      if (i<lines.length) i++;
      out+=`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`;continue;
    }
    if (!line.trim()) { i++;continue; }
    const heading=line.match(/^ *(#{1,6}) +(.+)$/);
    if (heading) {const n=heading[1].length;out+=`<h${n}>${inlineMarkdown(heading[2])}</h${n}>`;i++;continue;}
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {out+='<hr>';i++;continue;}
    if (/^ *> ?/.test(line)) {
      const buf=[];while(i<lines.length && /^ *> ?/.test(lines[i])) buf.push(lines[i++].replace(/^ *> ?/,''));
      out+=`<blockquote><p>${buf.map(inlineMarkdown).join('<br>')}</p></blockquote>`;continue;
    }
    if (/^ *[-*+] +/.test(line)) {
      const items=[];while(i<lines.length && /^ *[-*+] +/.test(lines[i])) items.push(lines[i++].replace(/^ *[-*+] +/,''));
      const tasks=items.some(x=>/^\[[ xX]\] /.test(x));
      out+=`<ul${tasks?' class="task-list"':''}>${items.map(x=>{
        const match=x.match(/^\[([ xX])\] (.*)$/);
        return match?`<li><label><input type="checkbox" disabled ${match[1].toLowerCase()==='x'?'checked':''}>${inlineMarkdown(match[2])}</label></li>`:`<li>${inlineMarkdown(x)}</li>`;
      }).join('')}</ul>`;continue;
    }
    if (/^ *\d+\. +/.test(line)) {
      const items=[];while(i<lines.length && /^ *\d+\. +/.test(lines[i])) items.push(lines[i++].replace(/^ *\d+\. +/,''));
      out+=`<ol>${items.map(x=>`<li>${inlineMarkdown(x)}</li>`).join('')}</ol>`;continue;
    }
    const buf=[];
    while(i<lines.length && lines[i].trim() && !/^ *(#{1,6}) +|^ *```|^ *> ?|^ *[-*+] +|^ *\d+\. +|^\s*\$\$|^\s*\\\[|^\s*(---+|\*\*\*+|___+)\s*$/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    if (buf.length) out+=`<p>${buf.map(inlineMarkdown).join('<br>')}</p>`;
    else { i++; }
  }
  return out || '<p style="color:#a3aa9e">这一页还是空白的。</p>';
}
