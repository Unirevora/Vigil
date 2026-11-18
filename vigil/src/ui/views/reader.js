import {icon} from '../icons.js';
import {escapeHtml,humanDate,charCount} from '../../core/format.js';
import {sortEntries} from '../../core/entries.js';
import {renderMarkdown} from '../../core/markdown.js';
import {connectionsFromEntries} from '../../insights/insights.js';

const ORNAMENT='<div class="reading-ornament" aria-hidden="true"><span class="ornament-rule"></span><span class="ornament-fleuron">❖</span><span class="ornament-rule"></span></div>';

export function readerView(state) {
  if(state.readerSource==='github'){
    const gh=state.github,note=gh.note;
    if(!gh.connected||!note)return `<div class="empty"><h3>GitHub 文件会话已失效</h3><button class="btn" data-action="github-go-library">返回 GitHub 文库</button></div>`;
    const title=note.path.split('/').at(-1).replace(/\.(md|markdown|mdown)$/i,'');
    return `<div class="reader-top"><button class="text-button" data-action="github-go-library">${icon('back')} 返回 GitHub 手记</button>
      <div class="head-actions"><button class="btn btn-small" data-action="github-refresh-note">${icon('refresh')} 刷新</button>
        <button class="btn btn-primary btn-small" data-action="github-edit-full" ${note.locked?'disabled':''}>${icon('edit')} 编辑手记</button></div></div>
      <article class="reading-paper github-reading-paper"><div class="reading-date">${icon('github')} GitHub · ${escapeHtml(gh.config?.owner||'')}/${escapeHtml(gh.config?.repo||'')}
        ${note.encrypted?`<span class="pill mood">${icon('lock')} git-crypt</span>`:''}</div>
        <h1 class="reading-title">${escapeHtml(title)}</h1>
        <div class="github-reading-path">${escapeHtml(note.path)}</div>
        ${note.locked?`<div class="gh-locked"><h3>这篇手记已加密</h3><p>请导入对应的 git-crypt 密钥后解锁阅读；密钥只保存在本次页面内存。</p>
          <button class="btn btn-primary" data-action="github-key-import">${icon('key')} 导入密钥</button></div>`:
          `${ORNAMENT}<div class="article-content">${renderMarkdown(note.content)}</div>`}
        <footer class="reading-foot"><span>${note.locked?'尚未解锁':`${charCount(note.content)} 字`}</span>
          <span>${gh.hasToken?'可编辑并提交到 GitHub':'匿名只读 · 连接令牌后可提交'}</span></footer>
      </article>`;
  }

  const entry=state.entries.find(e=>e.id===state.selectedId);
  if(!entry)return `<div class="empty"><h3>手记不存在</h3><button class="btn" data-action="nav" data-to="entries">返回列表</button></div>`;
  const sorted=sortEntries(state.entries),index=sorted.findIndex(e=>e.id===entry.id);
  const backlinks=connectionsFromEntries(state.entries).backlinks.get(entry.id)||[];
  const prev=sorted[index-1],next=sorted[index+1];
  return `<div class="reader-top"><button class="text-button" data-action="nav" data-to="entries">${icon('back')} 返回手记</button>
    <div class="head-actions">
      <button class="btn btn-small ${entry.favorite?'btn-accent':''}" data-action="favorite" data-id="${escapeHtml(entry.id)}">${icon('star')} ${entry.favorite?'已收藏':'收藏'}</button>
      <button class="btn btn-small" data-action="edit" data-id="${escapeHtml(entry.id)}">${icon('edit')} 编辑</button>
      <button class="btn btn-small btn-danger" data-action="delete" data-id="${escapeHtml(entry.id)}">${icon('trash')}</button>
    </div></div>
    <article class="reading-paper">
      <div class="reading-date">${escapeHtml(humanDate(entry.date))}${entry.mood?` <span class="dot-sep">·</span> ${escapeHtml(entry.mood)}`:''}</div>
      <h1 class="reading-title">${escapeHtml(entry.title||'未命名手记')}</h1>
      ${entry.tags?.length?`<div class="reading-tags">${entry.tags.map(t=>`<span class="pill">${escapeHtml(t)}</span>`).join('')}</div>`:''}
      ${ORNAMENT}
      <div class="article-content">${renderMarkdown(entry.content)}</div>
      <footer class="reading-foot"><span>${charCount(entry.content)} 字</span><span>不眠手记</span></footer>
    </article>
    <div class="reader-pagination"><div>${prev?`<button class="pagination-card" data-action="read" data-id="${escapeHtml(prev.id)}">${icon('back')} <span><small>上一篇</small>${escapeHtml(prev.title)}</span></button>`:''}</div>
    <div>${next?`<button class="pagination-card align-right" data-action="read" data-id="${escapeHtml(next.id)}"><span><small>下一篇</small>${escapeHtml(next.title)}</span>${icon('chevron')}</button>`:''}</div></div>
    ${backlinks.length?`<section class="reader-backlinks"><h3>回响 · 引用了这篇手记</h3>
       ${backlinks.map(b=>`<button data-action="read" data-id="${escapeHtml(b.from)}">${icon('link')} ${escapeHtml(b.fromTitle)} ${icon('arrow')}</button>`).join('')}</section>`:''}`;
}
