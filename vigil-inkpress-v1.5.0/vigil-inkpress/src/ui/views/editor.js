import {icon} from '../icons.js';
import {todayISO,escapeHtml,charCount} from '../../core/format.js';
import {renderMarkdown} from '../../core/markdown.js';

const moods=['','平静','喜悦','疲惫','思考','灵感'];
const modes=[['live','实时渲染','spark'],['reading','阅读模式','eye'],['source','源码模式','code']];
export function editorView(state){
  const d=state.draft||{title:'',date:todayISO(),content:'',tags:[],mood:''};
  const selected=state.editorMode||'live';
  return `<section class="composer-page unified-composer-page">
    <div class="page-head editor-heading">
      <div><div class="page-eyebrow">书写台 · MANUSCRIPT</div>
        <h1>${state.editingId?'续写旧页':'提笔新页'}</h1>
        <p id="draftStatus" role="status" aria-live="polite">${escapeHtml(state.draftStatus||'输入后自动保存草稿')}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-quiet" data-action="leave-editor">${icon('back')} 返回</button>
        <button class="btn btn-primary" data-action="save">${icon('save')} 正式存档</button>
      </div>
    </div>
    <div class="editor-paper unified-paper">
      <div class="editor-meta-line">
        <label>写于 <input type="date" id="entryDate" value="${escapeHtml(d.date)}"></label>
        <label>心情 <select id="entryMood">${moods.map(m=>`<option value="${escapeHtml(m)}" ${d.mood===m?'selected':''}>${m||'未选择'}</option>`).join('')}</select></label>
      </div>
      <input id="entryTitle" class="editor-title" aria-label="手记标题" maxlength="200" value="${escapeHtml(d.title)}" placeholder="为今天题字……">
      <label class="tag-label">${icon('tag')} <span>标签</span><input id="entryTags" value="${escapeHtml((d.tags||[]).join(', '))}" maxlength="220" placeholder="日常，旅行，心事"></label>
      <div class="unified-toolbar">
        <div class="format-tools" aria-label="Markdown 工具栏">
          <button class="tool-button" title="加粗 · Ctrl+B" aria-label="加粗" data-action="format" data-format="bold">${icon('bold')}</button>
          <button class="tool-button" title="斜体 · Ctrl+I" aria-label="斜体" data-action="format" data-format="italic">${icon('italic')}</button>
          <button class="tool-button tool-text" title="二级标题" aria-label="二级标题" data-action="format" data-format="heading">H2</button>
          <button class="tool-button" title="列表" aria-label="列表" data-action="format" data-format="list">${icon('list')}</button>
          <button class="tool-button" title="引用" aria-label="引用" data-action="format" data-format="quote">${icon('quote')}</button>
          <button class="tool-button" title="代码" aria-label="代码" data-action="format" data-format="code">${icon('code')}</button>
          <button class="tool-button" title="链接" aria-label="链接" data-action="format" data-format="link">${icon('link')}</button>
          <span class="toolbar-separator"></span>
          <button class="tool-button tool-math" title="行内 KaTeX 公式" aria-label="插入行内公式" data-action="format" data-format="inlineMath">ƒx</button>
          <button class="tool-button tool-math" title="块级 KaTeX 公式" aria-label="插入块级公式" data-action="format" data-format="blockMath">∑</button>
          <button class="tool-button tool-text" title="任务列表" aria-label="插入任务列表" data-action="format" data-format="task">☑</button>
          <button class="tool-button tool-text" title="表格" aria-label="插入表格" data-action="format" data-format="table">▤</button>
        </div>
        <div class="editor-mode-switch" role="group" aria-label="编辑模式">
          ${modes.map(([key,label,symbol])=>`<button class="editor-mode-option ${key===selected?'active':''}"
            data-action="editor-mode" data-mode="${key}" aria-pressed="${key===selected}" title="${label}">
            ${icon(symbol)} <span>${label}</span></button>`).join('')}
        </div>
      </div>
      <div class="editor-searchbar" id="editorSearchBar" hidden>
        ${icon('search')} <input id="editorFindInput" aria-label="查找正文" placeholder="在这篇手记中查找…" autocomplete="off">
        <button class="icon-button" data-action="find-prev" aria-label="上一个匹配" title="上一个">${icon('back')}</button>
        <button class="icon-button" data-action="find-next" aria-label="下一个匹配" title="下一个">${icon('chevron')}</button>
        <input id="editorReplaceInput" aria-label="替换为" placeholder="替换为…" autocomplete="off">
        <button class="btn btn-small" data-action="find-replace">替换</button>
        <button class="btn btn-small" data-action="find-replace-all">全部替换</button>
        <button class="icon-button" data-action="find-close" aria-label="关闭查找">${icon('close')}</button>
      </div>
      <div class="unified-manuscript" id="editorUnifiedPane" data-mode="${selected}">
        <div class="unified-pane-label"><span>${icon('pen')} 一纸三观</span><div class="editor-pane-tools">
          <span id="editorModeStatus">${modes.find(x=>x[0]===selected)[1]}</span>
          <button class="editor-zen-button ${state.zenMode?'active':''}" type="button" data-action="toggle-zen" aria-pressed="${state.zenMode===true}" title="沉浸书写 · Ctrl/⌘+Shift+F">${icon('spark')} ${state.zenMode?'退出沉浸':'沉浸'}</button></div></div>
        <div id="unifiedEditorHost" class="unified-edit-host" aria-label="Markdown 写作区域"></div>
        <div id="unifiedReader" class="unified-reader article-content" ${selected==='reading'?'':'hidden'} aria-label="阅读模式正文">${selected==='reading'?renderMarkdown(d.content):''}</div>
      </div>
      <div class="editor-foot"><span id="editorWordCount">${charCount(d.content)} 字</span><span>同一窗口三种视图 · KaTeX 即时排版 · Ctrl / ⌘ + S 正式存档</span></div>
    </div>
  </section>`;
}
