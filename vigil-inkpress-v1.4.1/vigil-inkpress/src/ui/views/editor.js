import {icon} from '../icons.js';
import {todayISO,escapeHtml,charCount} from '../../core/format.js';
import {renderMarkdown} from '../../core/markdown.js';

const moods=['','平静','喜悦','疲惫','思考','灵感'];
export function editorView(state) {
  const d=state.draft||{title:'',date:todayISO(),content:'',tags:[],mood:''};
  const focus=state.editorFocus===true;
  return `<section class="composer-page">
    <div class="page-head editor-heading">
      <div><div class="page-eyebrow">书写台 · MANUSCRIPT</div>
        <h1>${state.editingId?'续写旧页':'提笔新页'}</h1>
        <p id="draftStatus" role="status" aria-live="polite">${escapeHtml(state.draftStatus||'每次修改都会自动保存为草稿')}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-quiet" data-action="leave-editor">${icon('back')} 返回</button>
        <button class="btn btn-primary" data-action="save">${icon('save')} 正式存档</button>
      </div>
    </div>
    <div class="editor-paper">
      <div class="editor-meta-line">
        <label>写于 <input type="date" id="entryDate" value="${escapeHtml(d.date)}"></label>
        <label>心情 <select id="entryMood">${moods.map(m=>`<option value="${escapeHtml(m)}" ${d.mood===m?'selected':''}>${m||'未选择'}</option>`).join('')}</select></label>
      </div>
      <input id="entryTitle" class="editor-title" aria-label="手记标题" maxlength="200" value="${escapeHtml(d.title)}" placeholder="为今天题字……">
      <label class="tag-label">${icon('tag')} <span>标签</span> <input id="entryTags" value="${escapeHtml((d.tags||[]).join(', '))}" maxlength="220" placeholder="日常，旅行，心事"></label>
      <div class="editor-bar">
        <div class="format-tools" aria-label="Markdown 工具栏">
          <button class="tool-button" title="加粗" aria-label="加粗" data-action="format" data-format="bold">${icon('bold')}</button>
          <button class="tool-button" title="斜体" aria-label="斜体" data-action="format" data-format="italic">${icon('italic')}</button>
          <button class="tool-button tool-text" title="二级标题" aria-label="二级标题" data-action="format" data-format="heading">H2</button>
          <span class="toolbar-separator"></span>
          <button class="tool-button" title="列表" aria-label="列表" data-action="format" data-format="list">${icon('list')}</button>
          <button class="tool-button" title="引用" aria-label="引用" data-action="format" data-format="quote">${icon('quote')}</button>
          <button class="tool-button" title="代码" aria-label="代码" data-action="format" data-format="code">${icon('code')}</button>
          <button class="tool-button" title="链接" aria-label="链接" data-action="format" data-format="link">${icon('link')}</button>
        </div>
        <button class="tool-mode ${focus?'active':''}" data-action="toggle-editor-focus">${icon(focus?'eye':'edit')} ${focus?'显示预览':'专注书写'}</button>
      </div>
      <div class="editor-live-grid ${focus?'is-focus':''}" id="editorLiveGrid">
        <section class="editor-source" aria-label="Markdown 编辑区域">
          <div class="editor-pane-header"><span>${icon('pen')} Markdown 源文</span><span class="editor-live-dot"></span></div>
          <textarea id="entryContent" class="editor-textarea" spellcheck="false"
             aria-label="正文 Markdown 编辑框" placeholder="今天，想记下什么？">${escapeHtml(d.content)}</textarea>
        </section>
        <section class="editor-rendered" aria-label="Markdown 实时预览">
          <div class="editor-pane-header"><span>${icon('eye')} 实时预览</span><span id="previewStatus">随输入更新</span></div>
          <div class="editor-preview article-content" id="livePreview" aria-live="off">${renderMarkdown(d.content)}</div>
        </section>
      </div>
      <div class="editor-foot"><span id="editorWordCount">${charCount(d.content)} 字</span><span>草稿仅存当前设备 · Ctrl / ⌘ + S 正式存档</span></div>
    </div>
  </section>`;
}
