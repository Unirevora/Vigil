import {icon} from '../icons.js';
import {escapeHtml,humanDate,charCount} from '../../core/format.js';
import {renderMarkdown} from '../../core/markdown.js';

export function readerView(state) {
  const e=state.entries.find(x=>x.id===state.selectedId);
  if (!e) return `<div class="empty"><h3>这篇手记已不在</h3><button class="btn" data-action="nav" data-to="entries">返回全部手记</button></div>`;
  return `<div class="reader-toolbar">
    <button class="back-link" data-action="nav" data-to="entries">${icon('back')} 返回全部手记</button>
    <div class="reader-tools">
      <button class="btn btn-small" data-action="edit" data-id="${escapeHtml(e.id)}">${icon('edit')} <span>编辑</span></button>
      <button class="btn btn-small btn-danger" data-action="delete" data-id="${escapeHtml(e.id)}">${icon('trash')} <span>删除</span></button>
    </div>
  </div>
  <article class="article-paper">
    <header class="article-head">
      <div class="article-meta">${escapeHtml(humanDate(e.date))} · VIGIL</div>
      <h1>${escapeHtml(e.title||'未命名手记')}</h1>
      <div class="article-stamp">✦</div>
    </header>
    <div class="article-content">${renderMarkdown(e.content)}</div>
    <footer class="article-bottom">
      <span>全文 ${charCount(e.content)} 字 ${e.demo ? ' · 示例手记' : ''}</span>
      <span>写给未来的自己 · VIGIL</span>
    </footer>
  </article>
  <p class="footer-note">「记录不是为了留住所有，而是记得自己如何走来。」</p>`;
}
