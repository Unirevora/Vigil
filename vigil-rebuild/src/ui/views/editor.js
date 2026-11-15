import {icon} from '../icons.js';
import {todayISO,escapeHtml,charCount} from '../../core/format.js';

export function editorView(state) {
  const d=state.draft || {title:'',date:todayISO(),content:''};
  return `<div class="breadcrumb">手记 <span>/</span> ${state.editingId ? '编辑手记' : '新建手记'}</div>
  <div class="heading-row">
    <div><div class="kicker divider-kicker">A BLANK PAGE</div><h1 class="page-title">${state.editingId?'继续写下去':'写一篇手记'}</h1><p class="page-lead">只管写，暂时不必想着让它完美。</p></div>
  </div>
  <div class="editor-paper">
    <div class="editor-topline">
      <div class="editor-label">VIGIL · PRIVATE NOTES</div>
      <div class="row gap-12"><label class="editor-label" for="entryDate">记录于</label><input class="editor-date" id="entryDate" type="date" value="${escapeHtml(d.date)}"></div>
    </div>
    <input class="editor-field-title" id="entryTitle" placeholder="给今天一个标题…" aria-label="手记标题" maxlength="200" value="${escapeHtml(d.title)}">
    <textarea class="editor-textarea" id="entryContent" aria-label="手记正文" spellcheck="false" placeholder="今天，有什么想留下来的？&#10;&#10;支持 Markdown：标题、列表、引用、粗体、链接、代码…">${escapeHtml(d.content)}</textarea>
    <div class="editor-foot">
      <span id="editorStatus">${charCount(d.content)} 字 · Markdown 源码编辑</span>
      <div class="editor-foot-actions">
        <button class="btn" data-action="cancel-edit">取消</button>
        <button class="btn btn-primary" data-action="save">${icon('save')} 保存手记</button>
      </div>
    </div>
  </div>
  <div class="notice">${icon('info')}<span>原型采用稳定的 Markdown 源码编辑，保存后进入阅读视图。本阶段不加入复杂实时编辑器；尚未保存的更改在离开时会提示。</span></div>`;
}
