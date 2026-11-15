import {icon} from '../icons.js';
import {escapeHtml,humanDate,charCount} from '../../core/format.js';
import {renderMarkdown} from '../../core/markdown.js';

export function readerView(state) {
  const entry=state.entries.find(e=>e.id===state.selectedId);
  if(!entry)return `<div class="empty"><h3>此页已不在档案里</h3><button class="btn btn-primary" data-action="nav" data-to="entries">返回索引</button></div>`;
  return `<div class="reader-toolbar">
    <button class="btn-text" data-action="nav" data-to="entries">${icon('back')} 返回手记索引</button>
    <div class="reader-tools">
      <button class="btn btn-small" data-action="edit" data-id="${escapeHtml(entry.id)}">${icon('edit')} 修改此篇</button>
      <button class="btn btn-small btn-danger" data-action="delete" data-id="${escapeHtml(entry.id)}">${icon('trash')} 删除</button>
    </div>
  </div>
  <article class="article-paper">
    <div class="article-vertical-note" aria-hidden="true">壹　纸　壹　字　以　记　流　年</div>
    <header class="article-head">
      <div class="article-head-top"><span>私人手记 · 正式存档</span><span>VIGIL / ORIGINAL</span></div>
      <div class="article-meta">${escapeHtml(humanDate(entry.date))}</div>
      <h1>${escapeHtml(entry.title||'未命名手记')}</h1>
      <div class="article-stamp" aria-hidden="true">記</div>
    </header>
    <div class="article-content">${renderMarkdown(entry.content)}</div>
    <footer class="article-bottom">
      <div class="article-signature">不眠手记 <small>PRIVATE RECORDS</small></div>
      <span>全文 ${charCount(entry.content)} 字　 · 　№ ${escapeHtml(entry.id.slice(0,6).toUpperCase())}</span>
    </footer>
  </article>
  <div class="footer-note"><span>— 好的文字，是写给未来的自己 —</span><span>VIGIL ARCHIVE</span></div>`;
}
