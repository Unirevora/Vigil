import {icon} from '../icons.js';
import {filterEntries} from '../../core/entries.js';
import {escapeHtml} from '../../core/format.js';
import {entriesCards} from './entry-cards.js';
import {pageHeading} from './page-heading.js';
import {githubEntriesScope,githubNoteTitle,githubDraftKey} from '../../github/notebook.js';

function notebookSwitch(state){
  const source=state.entriesSource==='github'?'github':'local';
  const owner=state.github.config?.owner;
  const label=owner?`${state.github.config.owner}/${state.github.config.repo}`:'尚未连接';
  return `<nav class="notebook-switch vigil-tabs" aria-label="手记来源" role="tablist">
    <button type="button" role="tab" aria-selected="${source==='local'}" class="notebook-tab vigil-tab ${source==='local'?'active':''}" data-action="entries-source" data-source="local">
      ${icon('book')} <span>本地手记</span><small>${state.entries.length}</small></button>
    <button type="button" role="tab" aria-selected="${source==='github'}" class="notebook-tab vigil-tab ${source==='github'?'active':''}" data-action="entries-source" data-source="github">
      ${icon('github')} <span>GitHub 仓库</span><small>${escapeHtml(label)}</small></button>
  </nav>`;
}
function githubEntriesView(state){
  const gh=state.github;
  if(!gh.connected||!gh.config){
    return `<section class="notebook-unlinked surface"><span class="notebook-unlinked-icon">${icon('github')}</span><h2>${gh.config?'重新连接你的仓库':'将 GitHub 仓库作为第二本文库'}</h2>
      <p>${gh.config?'仓库地址已记住；出于隐私和权限考虑，每次启动仍需重新验证连接。':'连接后，Markdown 文件会直接出现在这里，使用与本地手记相同的阅读与写作窗口。'}</p>
      <button class="btn btn-primary" data-action="nav" data-to="github">${icon('github')} ${gh.config?'打开仓库连接':'连接 GitHub 仓库'}</button></section>`;
  }
  const {root,current,canGoBack}=githubEntriesScope(gh.config,gh.folder);
  const files=gh.files||[],folders=files.filter(f=>f.type==='dir'),notes=files.filter(f=>f.type==='file');
  const query=(state.githubQuery||'').trim().toLocaleLowerCase();
  const found=notes.filter(item=>`${item.name} ${item.path}`.toLocaleLowerCase().includes(query));
  const draftFor=item=>state.drafts?.some(d=>d.key===githubDraftKey(gh.config,item.path));
  return `<section class="github-notebook" aria-label="GitHub 手记工作区">
    <div class="notebook-repo-strip"><div class="notebook-repo-title">${icon('github')}<strong>${escapeHtml(gh.config.owner)}/${escapeHtml(gh.config.repo)}</strong>
      <span class="notebook-repo-branch">${icon('branch')}${escapeHtml(gh.config.branch||gh.defaultBranch||'默认分支')}</span>
      <span class="notebook-repo-path">/ ${escapeHtml(current||'根目录')}</span></div>
      <div class="notebook-repo-actions">
        <button class="btn btn-small btn-quiet" data-action="github-refresh">${icon('refresh')} 刷新</button>
        <button class="btn btn-small btn-quiet" data-action="nav" data-to="github">${icon('settings')} 仓库设置</button>
      </div></div>
    ${gh.error?`<p class="inline-error">${escapeHtml(gh.error)}</p>`:''}
    ${gh.attributeWarning?`<p class="github-attribute-warning">加密属性尚未确认：${escapeHtml(gh.attributeWarning)}；写入时仍会重新校验。</p>`:''}
    <div class="filter-panel notebook-filter-panel"><div class="searchbox">${icon('search')}<input id="githubSearchInput" class="search-input" value="${escapeHtml(state.githubQuery||'')}" placeholder="在当前目录搜索 Markdown…" autocomplete="off"></div>
      <div class="notebook-folder-actions">
        <button class="btn btn-small" data-action="github-parent" ${canGoBack?'':'disabled'}>${icon('back')} 返回上级</button>
        <span>${folders.length} 个文件夹 · <span id="githubResultCount">${found.length}</span> 篇 Markdown</span>
        <button class="btn btn-primary btn-small" data-action="github-new" ${gh.hasToken?'':'disabled'}>${icon('plus')} 新建仓库手记</button>
      </div>
      ${!gh.hasToken?'<p class="notebook-helper">当前为只读连接。需要在 GitHub 仓库设置中提供 Contents 读写权限令牌，才能提交修改。</p>':''}
      ${gh.newFileMode?`<div class="notebook-create"><label for="ghNewPath">新手记仓库路径</label><div><input id="ghNewPath" value="${escapeHtml(gh.newPath||'')}" placeholder="${escapeHtml(current?current+'/':'')}新手记.md"><button class="btn btn-primary" data-action="github-new-confirm">开始写作</button><button class="btn" data-action="github-new-cancel">取消</button></div></div>`:''}
    </div>
    ${folders.length?`<div class="notebook-folder-list" aria-label="子目录">${folders.map(item=>`<button class="notebook-folder" data-action="github-folder" data-path="${escapeHtml(item.path)}">${icon('folder')}<span>${escapeHtml(item.name)}</span>${icon('chevron')}</button>`).join('')}</div>`:''}
    <div class="note-grid github-notebook-grid" id="githubEntryResults">${found.length?found.map(item=>`<article class="note-card github-note-card">
      <button class="note-link" data-action="github-note" data-path="${escapeHtml(item.path)}"><div class="note-date">${icon('github')} GitHub · Markdown</div>
        <h3>${escapeHtml(githubNoteTitle(item.path))}</h3><p class="github-note-path">${escapeHtml(item.path)}</p>
        <div class="note-tags"><span class="pill">${item.size?`${Math.max(1,Math.ceil(item.size/1024))} KB`:'Markdown'}</span>${draftFor(item)?'<span class="pill mood">本机有草稿</span>':''}</div>
      </button></article>`).join(''):
      `<div class="empty"><div class="empty-icon">${icon('book')}</div><h3>${query?'没有匹配的文件':'这个目录还没有 Markdown 文件'}</h3><p>可以进入其他文件夹，或新建仓库手记。</p></div>`}</div>
    <p class="notebook-helper">GitHub 文件直接在远端读写，本地手记与仓库手记互不覆盖。编辑时会暂存草稿；提交时校验 SHA 与 git-crypt 加密规则。</p>
  </section>`;
}
export function entriesView(state) {
  const source=state.entriesSource==='github'?'github':'local';
  const f=state.filters||{},items=filterEntries(state.entries,state.query,state.order,f);
  const allTags=[...new Set(state.entries.flatMap(e=>e.tags||[]))].sort((a,b)=>a.localeCompare(b,'zh-CN')).slice(0,24);
  const active=Boolean(state.query?.trim()||f.favorite||f.tag||f.month||f.day||f.recent||f.pending);
  const actions=source==='local'?`<button class="btn btn-primary" data-action="new">${icon('plus')} 新手记</button>`:'';
  return `${pageHeading({title:'全部手记',count:source==='local'?items.length:null,description:'本地与 GitHub 文库，在同一张稿纸里读写。',actions})}
    ${notebookSwitch(state)}
    ${source==='github'?githubEntriesView(state):`<div class="filter-panel">
      <div class="searchbox">${icon('search')}<input id="searchInput" class="search-input" value="${escapeHtml(state.query)}" placeholder="搜索标题、正文或标签…" aria-label="搜索手记" autocomplete="off"></div>
      <div class="filter-line" role="group" aria-label="快速筛选">
        <button class="filter-chip ${!active?'selected':''}" aria-pressed="${!active}" data-action="filter-all">全部</button>
        <button class="filter-chip ${f.favorite?'selected':''}" aria-pressed="${Boolean(f.favorite)}" data-action="filter-favorite">${icon('star')} 收藏</button>
        <button class="filter-chip ${f.recent?'selected':''}" aria-pressed="${Boolean(f.recent)}" data-action="filter-recent">${icon('calendar')} 最近 7 天</button>
        <button class="filter-chip ${f.pending?'selected':''}" aria-pressed="${Boolean(f.pending)}" data-action="filter-pending">${icon('check')} 有待办</button>
        <button class="filter-chip filter-order" data-action="toggle-order" title="切换日期排序">${state.order==='desc'?'最新优先':'最早优先'} ${icon('clock')}</button>
        ${f.month||f.day?`<button class="filter-chip selected" data-action="clear-filter">${escapeHtml(f.day||f.month)} ${icon('close')}</button>`:''}
        <button class="filter-reset" data-action="reset-list-filters" title="清除所有搜索和筛选" ${active?'':'hidden'}>清除条件</button>
      </div>
      ${allTags.length?`<div class="tag-filters"><button class="tag-option ${!f.tag?'active':''}" data-action="filter-tag" data-tag="">全部标签</button>${allTags.map(tag=>`<button class="tag-option ${f.tag===tag?'active':''}" data-action="filter-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>`:''}
    </div>
    <div class="section-title compact entry-results-head">
      <div><h2>手记列表</h2><span class="muted-count" id="resultCount" aria-live="polite">${items.length} 篇</span></div>
      <button class="text-button export-current" data-action="export-filtered" ${state.corruptStorage||!items.length?'disabled':''} title="仅导出当前筛选到的手记，原文不会改变">${icon('download')} 导出当前结果</button>
    </div>
    <div class="note-grid" id="entryResults">${entriesCards(items,active?'已筛选':'')}</div>`}`;
}
