import {icon} from '../icons.js';
import {todayISO,escapeHtml,charCount} from '../../core/format.js';

export function editorView(state) {
  const d=state.draft||{title:'',date:todayISO(),content:''};
  const isEditing=!!state.editingId;
  const draftState=state.draftStatus || '稍后将自动存为草稿';
  return `<div class="page-header editor-page-header">
    <div class="page-heading"><div class="kicker"><span class="kicker-line"></span>THE WRITING DESK / 书写台</div>
      <h1 class="page-title">${isEditing?'续写旧页':'新启一页'}<span class="heading-punctuation">。</span></h1>
      <p class="page-lead">用自己喜欢的节奏，把这一日慢慢写完。</p>
    </div>
    <span class="editor-number">VIGIL / MANUSCRIPT Nº ${isEditing?'OLD':'NEW'}</span>
  </div>
  <section class="editor-workspace">
    <div class="editor-statusbar">
      <span class="status-led ${state.draftError?'status-led-warn':''}"></span>
      <span id="draftStatus" role="status" aria-live="polite">${escapeHtml(draftState)}</span>
      <span class="editor-statusbar-right">AUTOSAVE / LOCAL ONLY</span>
    </div>
    <div class="editor-paper">
      <div class="editor-topline">
        <span class="editor-document-mark">不眠手记 / 文 字 底 稿</span>
        <label class="editor-date-label">写于 <input id="entryDate" type="date" class="editor-date" value="${escapeHtml(d.date)}"></label>
      </div>
      <div class="editor-paper-body">
        <label class="visually-hidden" for="entryTitle">手记标题</label>
        <input class="editor-field-title" id="entryTitle" maxlength="200" autocomplete="off" value="${escapeHtml(d.title)}" placeholder="为这一天题字……">
        <div class="editor-rule-head"><span>本文</span><span>ORIGINAL COPY / NO. 01</span></div>
        <label class="visually-hidden" for="entryContent">手记正文</label>
        <textarea id="entryContent" class="editor-textarea" spellcheck="false" placeholder="今天，想记下什么？&#10;&#10;一段晚风，一首歌，或一种说不清的心情。&#10;&#10;Markdown 在阅读时会自动排版。">${escapeHtml(d.content)}</textarea>
      </div>
      <div class="editor-foot">
        <div class="editor-foot-info"><span class="editor-words" id="editorWordCount">${charCount(d.content)} 字</span><span> · </span><span>MARKDOWN / 铅字稿</span></div>
        <div class="editor-foot-actions">
          <button class="btn" data-action="leave-editor">${icon('back')} 返回手记</button>
          <button class="btn btn-primary" data-action="save">${icon('save')} 正式存档</button>
        </div>
      </div>
    </div>
    <div class="editor-help"><span>${icon('info')} 未正式存档的修改会在输入后自动保存在本机草稿区。</span><span>Ctrl / ⌘ + S 可直接存档</span></div>
  </section>`;
}
