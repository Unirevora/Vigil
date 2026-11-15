import {icon} from '../icons.js';
import {escapeHtml,todayISO,charCount} from '../../core/format.js';
import {renderMarkdown} from '../../core/markdown.js';

const moods=['','平静','喜悦','疲惫','思考','灵感'];
export function editorView(state) {
  const x=state.draft||{title:'',date:todayISO(),content:'',tags:[],mood:''};
  const preview=state.editorPreview===true;
  return `<div class="page-head editor-heading"><div><h1>${state.editingId?'编辑手记':'写一篇手记'}</h1><p id="draftStatus" role="status">${escapeHtml(state.draftStatus||'输入后自动保存草稿')}</p></div>
    <div class="head-actions"><button class="btn" data-action="leave-editor">返回</button><button class="btn btn-primary" data-action="save">${icon('save')} 保存</button></div></div>
    <section class="editor-workspace">
      <div class="editor-paper">
        <div class="editor-meta-line">
          <label>日期 <input type="date" id="entryDate" value="${escapeHtml(x.date)}"></label>
          <label>心情 <select id="entryMood">${moods.map(m=>`<option value="${escapeHtml(m)}" ${x.mood===m?'selected':''}>${m||'未选择'}</option>`).join('')}</select></label>
        </div>
        <input id="entryTitle" class="editor-title" aria-label="手记标题" maxlength="200" value="${escapeHtml(x.title)}" placeholder="为今天取个标题…">
        <label class="tag-label">${icon('tag')} 标签 <input id="entryTags" value="${escapeHtml((x.tags||[]).join(', '))}" maxlength="220" placeholder="例如：日常, 旅行, 想法"></label>
        <div class="editor-bar">
          <div class="format-tools" aria-label="Markdown 快捷操作">
            <button class="tool-button" title="加粗" aria-label="加粗" data-action="format" data-format="bold">${icon('bold')}</button>
            <button class="tool-button" title="斜体" aria-label="斜体" data-action="format" data-format="italic">${icon('italic')}</button>
            <button class="tool-button tool-text" title="标题" data-action="format" data-format="heading">H2</button>
            <span class="toolbar-separator"></span>
            <button class="tool-button" title="列表" aria-label="列表" data-action="format" data-format="list">${icon('list')}</button>
            <button class="tool-button" title="引用" aria-label="引用" data-action="format" data-format="quote">${icon('quote')}</button>
            <button class="tool-button" title="代码" aria-label="代码" data-action="format" data-format="code">${icon('code')}</button>
            <button class="tool-button" title="链接" aria-label="链接" data-action="format" data-format="link">${icon('link')}</button>
          </div>
          <button class="tool-mode ${preview?'active':''}" data-action="toggle-preview">${icon(preview?'edit':'eye')} ${preview?'继续编辑':'预览'}</button>
        </div>
        <div class="editor-content ${preview?'is-hidden':''}">
          <textarea id="entryContent" class="editor-textarea" spellcheck="false" aria-label="正文" placeholder="在这里写下今天的故事…">${escapeHtml(x.content)}</textarea>
        </div>
        ${preview?`<div class="editor-preview article-content">${renderMarkdown(x.content)}</div>`:''}
        <div class="editor-foot"><span id="editorWordCount">${charCount(x.content)} 字</span><span>Markdown · 本地草稿</span></div>
      </div>
    </section>`;
}
