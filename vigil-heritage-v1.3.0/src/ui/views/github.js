import {icon} from '../icons.js';
import {escapeHtml} from '../../core/format.js';
import {renderMarkdown} from '../../core/markdown.js';

export function githubView(state) {
  const gh=state.github, c=gh.config||{};
  return `<div class="page-head"><div><h1>GitHub 仓库</h1><p>读取现有 Markdown 笔记，也可以提交修改。</p></div>
    ${gh.connected?`<div class="head-actions"><button class="btn" data-action="github-settings">${icon('edit')} ${gh.showSettings?'收起设置':'连接设置'}</button><button class="btn btn-quiet" data-action="github-disconnect">断开</button></div>`:''}</div>
    ${!gh.connected||gh.showSettings?`<section class="github-connect surface">
      <div class="panel-heading"><h2>连接你的仓库</h2><span>公开仓库无需令牌即可预览</span></div>
      <div class="github-fields">
        <label class="field full">仓库地址<input id="ghRepo" placeholder="https://github.com/用户名/仓库名" value="${escapeHtml(c.owner&&c.repo?`https://github.com/${c.owner}/${c.repo}`:'')}" autocomplete="off"></label>
        <label class="field">分支（可留空）<input id="ghBranch" placeholder="默认分支" value="${escapeHtml(c.branch||'')}"></label>
        <label class="field">笔记文件夹（可留空）<input id="ghFolder" placeholder="例如 notes" value="${escapeHtml(c.folder||'')}"></label>
        <label class="field full">Fine-grained Token（仅本次页面会话）<input id="ghToken" type="password" autocomplete="off" spellcheck="false" placeholder="${gh.hasToken?'已在本次会话中提供，留空则继续使用':'私有仓库或提交修改时填写'}"></label>
      </div>
      <div class="connect-actions"><button class="btn btn-primary" data-action="github-connect" ${gh.loading?'disabled':''}>${icon('github')} ${gh.connected?'更新连接':'连接仓库'}</button>
        <span>编辑需要仓库 Contents 读写权限；令牌不会写入本地存储。</span></div>
    </section>`:''}
    ${gh.error?`<div class="inline-error" role="alert">${icon('alert')} ${escapeHtml(gh.error)}</div>`:''}
    ${gh.loading?`<div class="loading-note">正在读取 GitHub 仓库…</div>`:''}
    ${gh.connected?`<section class="github-workspace">
      <div class="github-repo-bar">
        <div><span class="github-repo-icon">${icon('github')}</span><strong>${escapeHtml(c.owner)}/${escapeHtml(c.repo)}</strong>
          <small>${icon('branch')} ${escapeHtml(c.branch||gh.defaultBranch||'默认分支')}</small></div>
        <button class="btn btn-small" data-action="github-refresh">${icon('refresh')} 刷新</button>
      </div>
      <div class="github-columns">
        <div class="github-files surface">
          <div class="files-title"><strong>仓库文件</strong><button class="tool-button" title="新建 Markdown 文件" aria-label="新建 Markdown 文件" data-action="github-new" ${gh.hasToken?'':'disabled'}>${icon('plus')}</button></div>
          <button class="github-parent" data-action="github-parent" ${!gh.folder?'disabled':''}>${icon('back')} 返回上级 <span>${escapeHtml(gh.folder||'/')}</span></button>
          ${gh.files.length ? gh.files.map(item=>`<button class="github-file ${gh.note?.path===item.path?'active':''}"
            data-action="${item.type==='dir'?'github-folder':'github-note'}" data-path="${escapeHtml(item.path)}">${icon(item.type==='dir'?'folder':'file')}<span>${escapeHtml(item.name)}</span>${item.type==='dir'?icon('chevron'):''}</button>`).join(''):'<div class="file-empty">当前目录没有 Markdown 文件。</div>'}
          <div class="repo-scope">仅显示文件夹和 Markdown 文件</div>
        </div>
        <div class="github-detail surface">
          ${gh.newFileMode?`<div class="panel-heading"><h2>新建 Markdown 文件</h2><button class="text-button" data-action="github-new-cancel">取消</button></div>
            <label class="field">仓库内路径<input id="ghNewPath" placeholder="${escapeHtml(gh.folder?gh.folder+'/':'')}new-note.md" value="${escapeHtml(gh.newPath||'')}"></label>
            <p class="helper">新文件将在当前分支提交。请使用 .md 后缀。</p>
            <button class="btn btn-primary" data-action="github-new-confirm">开始写作</button>`:
          gh.note?`<div class="github-note-head"><div><div class="github-path">${escapeHtml(gh.note.path)}</div><h2>${escapeHtml(gh.note.path.split('/').at(-1))}</h2></div>
              <div class="head-actions">${gh.editing?`<button class="btn" data-action="github-cancel-edit">返回预览</button><button class="btn btn-primary" data-action="github-save" ${gh.hasToken?'':'disabled'}>${icon('save')} 提交到 GitHub</button>`
              :`<button class="btn btn-primary" data-action="github-edit" ${gh.hasToken?'':'disabled'}>${icon('edit')} 编辑文件</button>`}</div></div>
              ${gh.editing?`<textarea id="githubEditor" class="github-editor" aria-label="GitHub Markdown 正文" spellcheck="false">${escapeHtml(gh.draftContent)}</textarea><p class="helper">保存将创建一次 Git 提交；如果远端版本已变化，系统会拒绝覆盖。</p>`
              :`<div class="github-preview article-content">${renderMarkdown(gh.note.content)}</div>`}
              <div class="github-note-foot"><span>${gh.editing?(gh.dirty?'尚未提交修改':'当前内容尚未修改'):'来自 GitHub · 未同步到本地手记'}</span>
                ${gh.note.htmlUrl?`<a class="text-button" href="${escapeHtml(gh.note.htmlUrl)}" target="_blank" rel="noopener noreferrer">在 GitHub 查看 ${icon('external')}</a>`:''}</div>`:
          `<div class="github-blank">${icon('file')}<h3>选择一篇笔记</h3><p>从左侧文件夹中选择 Markdown 文件，即可预览。</p></div>`}
        </div>
      </div>
      <p class="integration-note">GitHub 文件与本地手记相互独立。这里的“提交”会直接修改仓库文件，不会自动同步到本地手记库。</p>
    </section>`:
    `<div class="github-onboarding surface">${icon('folder')}<h3>在仓库里继续写作</h3><p>填写仓库地址后，可浏览文件夹、预览 Markdown，或使用有权限的令牌编辑并提交。</p></div>`}`;
}
