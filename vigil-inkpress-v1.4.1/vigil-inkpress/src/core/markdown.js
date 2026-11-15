import { escapeHtml } from './format.js';

// Markdown is escaped before the tiny allowlisted renderer adds tags.
// No raw HTML execution, external Markdown runtime, or unsafe link protocols.

function isSafeLink(url) {
  try { const u = new URL(url); return ['https:','http:','mailto:'].includes(u.protocol); }
  catch { return false; }
}

function inlineMarkdown(text) {
  const chunks = String(text).split(/(`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g);
  return chunks.map(part => {
    if (/^`[^`\n]+`$/.test(part)) return `<code>${escapeHtml(part.slice(1,-1))}</code>`;
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

export function renderMarkdown(source) {
  const lines=String(source||'').replace(/\r\n/g,'\n').split('\n');
  let out='',i=0;
  while (i<lines.length) {
    let line=lines[i];
    if (/^ *```/.test(line)) {
      i++;const code=[];
      while (i<lines.length && !/^ *```/.test(lines[i])) code.push(lines[i++]);
      if (i<lines.length) i++;
      out+=`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`;continue;
    }
    if (!line.trim()) { i++;continue; }
    const heading=line.match(/^ *(#{1,3}) +(.+)$/);
    if (heading) {const n=heading[1].length;out+=`<h${n}>${inlineMarkdown(heading[2])}</h${n}>`;i++;continue;}
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {out+='<hr>';i++;continue;}
    if (/^ *> ?/.test(line)) {
      const buf=[];while(i<lines.length && /^ *> ?/.test(lines[i])) buf.push(lines[i++].replace(/^ *> ?/,''));
      out+=`<blockquote><p>${buf.map(inlineMarkdown).join('<br>')}</p></blockquote>`;continue;
    }
    if (/^ *[-*+] +/.test(line)) {
      const items=[];while(i<lines.length && /^ *[-*+] +/.test(lines[i])) items.push(lines[i++].replace(/^ *[-*+] +/,''));
      out+=`<ul>${items.map(x=>`<li>${inlineMarkdown(x)}</li>`).join('')}</ul>`;continue;
    }
    if (/^ *\d+\. +/.test(line)) {
      const items=[];while(i<lines.length && /^ *\d+\. +/.test(lines[i])) items.push(lines[i++].replace(/^ *\d+\. +/,''));
      out+=`<ol>${items.map(x=>`<li>${inlineMarkdown(x)}</li>`).join('')}</ol>`;continue;
    }
    const buf=[];
    while(i<lines.length && lines[i].trim() && !/^ *(#{1,3}) +|^ *```|^ *> ?|^ *[-*+] +|^ *\d+\. +|^\s*(---+|\*\*\*+|___+)\s*$/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    if (buf.length) out+=`<p>${buf.map(inlineMarkdown).join('<br>')}</p>`;
    else { i++; }
  }
  return out || '<p style="color:#a3aa9e">这一页还是空白的。</p>';
}
