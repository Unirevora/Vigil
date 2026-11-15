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

/**
 * Reading typography follows normal Markdown soft-line-break semantics:
 * ordinary newlines within a paragraph become spaces. Only two trailing
 * spaces or a trailing backslash produce a hard break. Multiple empty source
 * lines therefore never turn into stacked <br> nodes or empty paragraphs.
 * Code fences and display math retain their exact internal newlines.
 */
function renderParagraph(lines){
  return '<p>'+lines.map((raw,index)=>{
    const hard=/(?: {2,}|\\)\s*$/.test(raw);
    const content=raw.replace(/(?: {2,}|\\)\s*$/,'').trim();
    const suffix=index<lines.length-1?(hard?'<br>':' '):'';
    return inlineMarkdown(content)+suffix;
  }).join('')+'</p>';
}
function codeFence(line){return String(line).match(/^\s*(`{3,}|~{3,})([^\n]*)$/);}
function isBlockAt(lines,i){
  const line=lines[i]||'';
  return /^\s*(?:#{1,6}[ \t]+|>\s?|[-*+]\s+|\d+[.)]\s+|\$\$|\\\[)/.test(line)
    || /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)
    || Boolean(codeFence(line))
    || (i+1<lines.length&&line.includes('|')&&tableSeparator(lines[i+1]));
}
export function renderMarkdown(source){
  const lines=String(source||'').replace(/\r\n?/g,'\n').split('\n');
  const html=[];
  let i=0;
  while(i<lines.length){
    let line=lines[i];
    if(!line.trim()){i++;continue;}
    const mathOpening=line.trim();
    if(mathOpening==='$$'||mathOpening==='\\['){
      const close=mathOpening==='$$'?'$$':'\\]';
      const begin=i,buf=[];
      i++;
      while(i<lines.length&&lines[i].trim()!==close)buf.push(lines[i++]);
      if(i<lines.length){
        i++;html.push(renderBlockMath(buf.join('\n')));
      }else{
        i=begin+1;
        html.push('<p>'+escapeHtml(line.trim())+'</p>');
      }
      continue;
    }
    if(/^\s*\$\$.+\$\$\s*$/.test(line)){
      html.push(renderBlockMath(line.trim().slice(2,-2)));i++;continue;
    }
    if(i+1<lines.length&&line.includes('|')&&tableSeparator(lines[i+1])){
      const header=splitTableRow(line),sep=splitTableRow(lines[i+1]);
      if(header.length>1&&header.length===sep.length){
        i+=2;const rows=[];
        while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){
          const cells=splitTableRow(lines[i++]);
          rows.push('<tr>'+header.map((_,k)=>'<td>'+inlineMarkdown(cells[k]||'')+'</td>').join('')+'</tr>');
        }
        html.push('<table><thead><tr>'+header.map(v=>'<th>'+inlineMarkdown(v)+'</th>').join('')+
          '</tr></thead><tbody>'+rows.join('')+'</tbody></table>');
        continue;
      }
    }
    const fence=codeFence(line);
    if(fence){
      const character=fence[1][0],length=fence[1].length,code=[];
      i++;
      while(i<lines.length){
        const close=codeFence(lines[i]);
        if(close&&close[1][0]===character&&close[1].length>=length&&
           !close[2].trim()){i++;break;}
        code.push(lines[i++]);
      }
      html.push('<pre><code>'+escapeHtml(code.join('\n'))+'</code></pre>');continue;
    }
    const heading=line.match(/^\s*(#{1,6})[ \t]+(.+)$/);
    if(heading){const level=heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);i++;continue;}
    if(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)){
      html.push('<hr>');i++;continue;
    }
    if(/^\s*>/.test(line)){
      const linesInQuote=[];
      while(i<lines.length&&/^\s*>/.test(lines[i])){
        linesInQuote.push(lines[i++].replace(/^\s*>\s?/,''));
      }
      html.push('<blockquote>'+renderParagraph(linesInQuote)+'</blockquote>');continue;
    }
    if(/^\s*[-*+]\s+/.test(line)){
      const items=[];
      while(i<lines.length&&/^\s*[-*+]\s+/.test(lines[i])){
        items.push(lines[i++].replace(/^\s*[-*+]\s+/,''));
      }
      const tasks=items.some(v=>/^\[[ xX]\]\s/.test(v));
      html.push(`<ul${tasks?' class="task-list"':''}>`+items.map(item=>{
        const match=item.match(/^\[([ xX])\]\s+(.*)$/);
        return match?'<li><label><input type="checkbox" disabled'+
          (match[1].toLowerCase()==='x'?' checked':'')+'>'+inlineMarkdown(match[2])+'</label></li>':
          '<li>'+inlineMarkdown(item)+'</li>';
      }).join('')+'</ul>');continue;
    }
    if(/^\s*\d+[.)]\s+/.test(line)){
      const items=[];
      while(i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i])){
        items.push(lines[i++].replace(/^\s*\d+[.)]\s+/,''));
      }
      html.push('<ol>'+items.map(item=>'<li>'+inlineMarkdown(item)+'</li>').join('')+'</ol>');continue;
    }
    const paragraph=[];
    while(i<lines.length&&lines[i].trim()&&(!paragraph.length||!isBlockAt(lines,i))){
      paragraph.push(lines[i++]);
    }
    if(paragraph.length){html.push(renderParagraph(paragraph));continue;}
    // Handles unsupported constructs without locking the parser in a loop.
    html.push(renderParagraph([lines[i++]]));
  }
  return html.join('')||'<p class="markdown-empty">这一页还是空白的。</p>';
}
