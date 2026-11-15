import {icon} from '../icons.js';
import {todayISO,escapeHtml,charCount} from '../../core/format.js';
import {renderMarkdown} from '../../core/markdown.js';

const moods=['','平静','喜悦','疲惫','思考','灵感'];
const modes=[['live','实时','spark'],['reading','阅读','eye'],['source','源码','code']];

function simpleTool(symbol,label,kind){
  return `<button type="button" class="tool-button" title="${label}" aria-label="${label}"
    data-action="format" data-format="${kind}">${icon(symbol)}</button>`;
}
function menuTool(label,kind,description='',glyph=''){
  const symbol=glyph?icon(glyph):`<span class="editor-menu-monogram">${kind==='heading1'?'H1':kind==='heading'?'H2':kind==='heading3'?'H3':kind==='heading4'?'H4':kind==='heading5'?'H5':'H6'}</span>`;
  return `<button type="button" class="editor-menu-item" data-action="format" data-format="${kind}" role="menuitem">
    <span class="editor-menu-symbol" aria-hidden="true">${symbol}</span><span class="editor-menu-copy"><strong>${label}</strong>${description?`<small>${description}</small>`:''}</span></button>`;
}
function formatMenu(name,label,glyph,content){
  return `<details class="editor-dropdown-menu" data-menu="${name}"><summary class="tool-button text-tool-button" title="${label}" aria-label="${label}菜单">
    ${icon(glyph)}<span>${label}</span>${icon('chevron-down','editor-menu-chevron')}</summary>
    <div class="editor-dropdown-panel" role="menu" aria-label="${label}">${content}</div></details>`;
}

export function editorView(state){
  const d=state.draft||{title:'',date:todayISO(),content:'',tags:[],mood:''};
  const selected=state.editorMode||'live';
  const outlineOpen=state.editorOutlineOpen===true;
  const remote=state.editorOrigin==='github';
  const remotePath=remote?(state.github.note?.path||'') : ''; 
  return `<section class="composer-page unified-composer-page refined-editor ${outlineOpen?'outline-open':''}">
    <header class="editor-topline">
      <button class="text-button editor-return" data-action="leave-editor">${icon('back')} 手记</button>
      <span class="editor-document-type">${remote?'GitHub 仓库':state.editingId?'正在修改':'新手记'} <span class="small-separator">/</span> Markdown</span>
      <div class="editor-main-actions">
        <span class="draft-status" id="draftStatus" role="status" aria-live="polite">${escapeHtml(state.draftStatus||'自动暂存')}</span>
        <button class="btn btn-primary" data-action="save">${icon('save')} ${remote?'提交 GitHub':'保存手记'}</button>
      </div>
    </header>
    <article class="editor-paper unified-paper">
      ${remote?`<div class="github-editor-origin">${icon('github')} <span>远端文库</span><strong>${escapeHtml(state.github.config?.owner||'')}/${escapeHtml(state.github.config?.repo||'')}</strong><span class="github-editor-path">${escapeHtml(remotePath)}</span>${state.github.note?.encrypted?'<span class="pill">git-crypt</span>':''}</div>`:''}
      <input id="entryTitle" class="editor-title" aria-label="手记标题" maxlength="200" ${remote?'readonly title="文件名由仓库路径决定；修改正文标题不会自动重命名远端文件"':''}
        value="${escapeHtml(d.title)}" placeholder="无题手记">
      ${remote?`<p class="github-editor-filename-hint">${icon('info')} 文件名由仓库路径决定；正文中的 Markdown 标题可以自由编辑，提交时会校验 SHA 与加密规则。</p>`:''}
      <div class="editor-props-row">
        <details class="editor-properties" ${remote?'hidden':''}>
          <summary>${icon('sliders-horizontal')} <span>日期与标签</span>
            <span class="editor-prop-summary">${escapeHtml(d.date)}${d.mood?' · '+escapeHtml(d.mood):''}${d.tags?.length?' · '+d.tags.length+' 个标签':''}</span>
            ${icon('chevron-down')}</summary>
          <div class="editor-meta-line">
            <label>日期 <input type="date" id="entryDate" value="${escapeHtml(d.date)}"></label>
            <label>心情 <select id="entryMood">${moods.map(m=>`<option value="${escapeHtml(m)}" ${d.mood===m?'selected':''}>${m||'未选择'}</option>`).join('')}</select></label>
            <label class="tag-label">标签 <input id="entryTags" maxlength="220"
              value="${escapeHtml((d.tags||[]).join(', '))}" placeholder="用逗号分隔"></label>
          </div>
        </details>
        <div class="editor-pane-tools" role="group" aria-label="写作视图">
          <button class="editor-zen-button ${state.zenMode?'active':''}" type="button" data-action="toggle-zen"
            aria-pressed="${state.zenMode===true}" title="沉浸书写 · Ctrl/⌘+Shift+F">${icon('maximize')} <span>${state.zenMode?'退出沉浸':'专注'}</span></button>
          <button class="editor-outline-toggle ${outlineOpen?'active':''}" type="button" data-action="toggle-outline-sidebar"
            aria-pressed="${outlineOpen}" aria-controls="editorOutlineSidebar" title="切换右侧大纲">
            ${icon(outlineOpen?'panel-right-close':'panel-right-open')} <span>${outlineOpen?'收起大纲':'大纲'}</span>
          </button>
        </div>
      </div>
      <div class="unified-toolbar editor-toolbar-slim" role="toolbar" aria-label="写作格式和模式">
        <div class="format-tools primary-tools editor-tool-groups">
          <div class="editor-tool-cluster" aria-label="常用文本格式">
            ${simpleTool('bold','加粗 · Ctrl/⌘+B','bold')}
            ${simpleTool('italic','斜体 · Ctrl/⌘+I','italic')}
            ${simpleTool('link','插入链接','link')}
          </div>
          <span class="toolbar-separator" aria-hidden="true"></span>
          ${formatMenu('heading','标题','heading',[
            menuTool('一级标题','heading1','主标题'),
            menuTool('二级标题','heading','章节标题'),
            menuTool('三级标题','heading3','小节标题'),
            menuTool('四级标题','heading4','更细的层级'),
            menuTool('五级标题','heading5'),
            menuTool('六级标题','heading6')
          ].join(''))}
          ${formatMenu('list','列表','list-bulleted',[
            menuTool('项目符号','list','无序列表','list-bulleted'),
            menuTool('编号列表','orderedList','自动编号','list-ordered'),
            menuTool('待办清单','task','可勾选的任务','list-checks')
          ].join(''))}
          ${formatMenu('insert','插入','plus',[
            menuTool('引用','quote','段落引用','quote'),
            menuTool('行内代码','code','简短代码','code'),
            menuTool('代码块','codeBlock','带语言标识的代码区','code-block'),
            menuTool('行内公式','inlineMath','与正文处于同一行','math-formula'),
            menuTool('独立公式','blockMath','居中的 LaTeX 公式','math-formula'),
            menuTool('表格','table','Markdown 表格','table'),
            menuTool('分隔线','rule','章节分隔','horizontal-rule'),
            menuTool('删除线','strike','标记删改文字','strikethrough')
          ].join(''))}
          <span class="toolbar-separator" aria-hidden="true"></span>
          <div class="editor-tool-cluster editor-history-tools" aria-label="编辑历史">
            <button class="tool-button" type="button" data-action="editor-undo" title="撤销 · Ctrl/⌘+Z" aria-label="撤销">${icon('undo-2')}</button>
            <button class="tool-button" type="button" data-action="editor-redo" title="重做 · Ctrl/⌘+Y" aria-label="重做">${icon('redo-2')}</button>
          </div>
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
      <div class="unified-manuscript" id="editorUnifiedPane" data-mode="${selected}" data-outline-open="${outlineOpen}">
        <div class="editor-manuscript-layout">
          <button class="editor-outline-scrim" type="button" data-action="close-outline-sidebar"
            aria-label="关闭文章大纲" tabindex="-1"></button>
          <div class="editor-manuscript-main">
            <div id="unifiedEditorHost" class="unified-edit-host" aria-label="Markdown 写作区域"></div>
            <div id="unifiedReader" class="unified-reader article-content" ${selected==='reading'?'':'hidden'}
              aria-label="阅读模式正文">${selected==='reading'?renderMarkdown(d.content):''}</div>
          </div>
          <aside class="editor-outline-sidebar ${outlineOpen?'is-open':''}" id="editorOutlineSidebar" aria-label="文章大纲" ${outlineOpen?'':'inert'}>
            <div class="editor-outline-sticky">
              <div class="editor-outline-sidebar-head"><div><strong>文章大纲</strong><small>根据正文标题自动生成</small></div>
                <button type="button" class="icon-button" data-action="close-outline-sidebar" aria-label="收起大纲">${icon('close')}</button></div>
              <div class="editor-outline-panel" id="editorOutlineList"><p>输入 Markdown 标题后，这里会列出大纲。</p></div>
            </div>
          </aside>
        </div>
      </div>
      <footer class="editor-foot"><span id="editorWordCount">${charCount(d.content)} 字</span>
        <span>${remote?'本机自动暂存 · 提交才写入 GitHub':selected==='live'?'输入 Markdown 即时排版 · 当前行源码与效果共存':'同一稿纸 · 随时切换模式'}</span>
      </footer>
    </article>
  </section>`;
}
