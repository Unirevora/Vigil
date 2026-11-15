import {icon} from '../icons.js';
import {todayISO,escapeHtml,charCount} from '../../core/format.js';
import {renderMarkdown} from '../../core/markdown.js';

const moods=['','平静','喜悦','疲惫','思考','灵感'];
const modes=[['live','实时','spark'],['reading','阅读','eye'],['source','源码','code']];
function tool(symbol,label,kind){
  return `<button type="button" class="tool-button" title="${label}" aria-label="${label}"
    data-action="format" data-format="${kind}">${symbol==='H2'||symbol==='ƒx'||symbol==='☑'||symbol==='▤'?symbol:icon(symbol)}</button>`;
}
export function editorView(state){
  const d=state.draft||{title:'',date:todayISO(),content:'',tags:[],mood:''};
  const selected=state.editorMode||'live';
  return `<section class="composer-page unified-composer-page refined-editor">
    <header class="editor-topline">
      <button class="text-button editor-return" data-action="leave-editor">${icon('back')} 手记</button>
      <span class="editor-document-type">${state.editingId?'正在修改':'新手记'} <span class="small-separator">/</span> Markdown</span>
      <div class="editor-main-actions">
        <span class="draft-status" id="draftStatus" role="status" aria-live="polite">${escapeHtml(state.draftStatus||'自动暂存')}</span>
        <button class="btn btn-primary" data-action="save">${icon('save')} 保存手记</button>
      </div>
    </header>
    <article class="editor-paper unified-paper">
      <input id="entryTitle" class="editor-title" aria-label="手记标题" maxlength="200"
        value="${escapeHtml(d.title)}" placeholder="无题手记">
      <details class="editor-properties">
        <summary>${icon('sliders-horizontal')} <span>手记信息</span>
          <span class="editor-prop-summary">${escapeHtml(d.date)}${d.mood?' · '+escapeHtml(d.mood):''}${d.tags?.length?' · '+d.tags.length+' 个标签':''}</span>
          ${icon('chevron-down')}</summary>
        <div class="editor-meta-line">
          <label>日期 <input type="date" id="entryDate" value="${escapeHtml(d.date)}"></label>
          <label>心情 <select id="entryMood">${moods.map(m=>`<option value="${escapeHtml(m)}" ${d.mood===m?'selected':''}>${m||'未选择'}</option>`).join('')}</select></label>
          <label class="tag-label">标签 <input id="entryTags" maxlength="220"
            value="${escapeHtml((d.tags||[]).join(', '))}" placeholder="用逗号分隔"></label>
        </div>
      </details>
      <div class="unified-toolbar" role="toolbar" aria-label="写作格式和模式">
        <div class="format-tools primary-tools">
          ${tool('bold','加粗 · Ctrl+B','bold')}
          ${tool('italic','斜体 · Ctrl+I','italic')}
          ${tool('H2','二级标题','heading')}
          ${tool('list','列表','list')}
          ${tool('link','插入链接','link')}
          ${tool('ƒx','行内公式','inlineMath')}
          <span class="toolbar-separator"></span>
          <button class="tool-button" type="button" data-action="editor-undo" title="撤销 · Ctrl+Z" aria-label="撤销">${icon('undo-2')}</button>
          <button class="tool-button" type="button" data-action="editor-redo" title="重做 · Ctrl+Y" aria-label="重做">${icon('redo-2')}</button>
          <details class="editor-tools-more"><summary title="更多 Markdown 格式">${icon('more-horizontal')}</summary>
            <div class="editor-more-panel">
              ${tool('quote','引用','quote')}${tool('code','行内代码','code')}
              ${tool('∑','块级公式','blockMath')}${tool('☑','任务清单','task')}
              ${tool('▤','Markdown 表格','table')}
              ${tool('strikethrough','删除线','strike')}
            </div>
          </details>
        </div>
        <div class="editor-mode-switch" role="group" aria-label="编辑模式">
          ${modes.map(([key,label,symbol])=>`<button class="editor-mode-option ${key===selected?'active':''}"
            data-action="editor-mode" data-mode="${key}" aria-pressed="${key===selected}" title="${label}模式">
            ${icon(symbol)} <span>${label}</span></button>`).join('')}
        </div>
      </div>
      <div class="editor-searchbar" id="editorSearchBar" hidden>
        ${icon('search')}<input id="editorFindInput" aria-label="查找正文" placeholder="查找手记内容…" autocomplete="off">
        <button class="icon-button" data-action="find-prev" aria-label="上一个匹配">${icon('back')}</button>
        <button class="icon-button" data-action="find-next" aria-label="下一个匹配">${icon('chevron')}</button>
        <input id="editorReplaceInput" aria-label="替换为" placeholder="替换为…" autocomplete="off">
        <button class="btn btn-small" data-action="find-replace">替换</button>
        <button class="btn btn-small" data-action="find-replace-all">全部替换</button>
        <button class="icon-button" data-action="find-close" aria-label="关闭查找">${icon('close')}</button>
      </div>
      <div class="unified-manuscript" id="editorUnifiedPane" data-mode="${selected}">
        <div class="unified-pane-label">
          <span id="editorModeStatus">${{live:'即时排版 · 标记与效果共存',reading:'阅读 · 自然段落',source:'Markdown 源文'}[selected]}</span>
          <div class="editor-pane-tools">
            <details class="editor-outline"><summary title="本文大纲">${icon('list-tree')} <span>大纲</span></summary>
              <div class="editor-outline-panel" id="editorOutlineList"><p>输入 Markdown 标题后，这里会列出大纲。</p></div>
            </details>
            <button class="editor-zen-button ${state.zenMode?'active':''}" type="button" data-action="toggle-zen"
              aria-pressed="${state.zenMode===true}" title="沉浸书写 · Ctrl/⌘+Shift+F">${icon('maximize')} <span>${state.zenMode?'退出沉浸':'专注'}</span></button>
          </div>
        </div>
        <div id="unifiedEditorHost" class="unified-edit-host" aria-label="Markdown 写作区域"></div>
        <div id="unifiedReader" class="unified-reader article-content" ${selected==='reading'?'':'hidden'}
          aria-label="阅读模式正文">${selected==='reading'?renderMarkdown(d.content):''}</div>
      </div>
      <footer class="editor-foot"><span id="editorWordCount">${charCount(d.content)} 字</span>
        <span>${selected==='live'?'输入 Markdown 即时排版 · 当前行语法可见':'同一稿纸 · 随时切换模式'}</span>
      </footer>
    </article>
  </section>`;
}
