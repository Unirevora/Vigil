import {icon} from '../icons.js';
import {escapeHtml} from '../../core/format.js';
import {renderMarkdown} from '../../core/markdown.js';
import {pageHeading} from './page-heading.js';

export function githubView(state) {
  const gh=state.github, c=gh.config||{}, f=gh.formDraft||{};
  const proxy=gh.proxySettings||{mode:'env',host:'127.0.0.1',port:7890};
  const proxyModeOptions=[['env','自动读取 Node 环境'],['direct','直接连接（不使用代理）'],['http','本机 HTTP 代理'],['socks5','本机 SOCKS5 代理']];
  const actions=gh.connected?`<button class="btn" data-action="github-settings">${icon('edit')} ${gh.showSettings?'收起设置':'连接设置'}</button><button class="btn btn-quiet" data-action="github-disconnect">断开</button>`:'';
  return `${pageHeading({title:'GitHub 仓库',description:'读取现有 Markdown 笔记，也可以提交修改。',actions})}
    ${!gh.connected||gh.showSettings?`<section class="github-connect surface">
      <div class="panel-heading"><h2>连接你的仓库</h2><span>公开仓库无需令牌即可预览</span></div>
      <div class="github-fields">
        <label class="field full">仓库地址<input id="ghRepo" placeholder="https://github.com/用户名/仓库名" value="${escapeHtml(f.repoUrl??(c.owner&&c.repo?`https://github.com/${c.owner}/${c.repo}`:''))}" autocomplete="off"></label>
        <label class="field">分支（可留空）<input id="ghBranch" placeholder="默认分支" value="${escapeHtml(f.branch??c.branch??'')}"></label>
        <label class="field">笔记文件夹（可留空）<input id="ghFolder" placeholder="例如 notes" value="${escapeHtml(f.folder??c.folder??'')}"></label>
        <label class="field full">Fine-grained Token（仅本次页面会话）<input id="ghToken" type="password" autocomplete="off" spellcheck="false" placeholder="${gh.hasToken?'已在本次会话中提供，留空则继续使用':'私有仓库或提交修改时填写'}"></label>
      </div>
      <label class="github-anonymous-option"><input id="ghAnonymous" type="checkbox" ${gh.anonymous?'checked':''}>
        <span><strong>匿名读取公开仓库</strong><small>不使用以前输入的 Token；适合排查公开仓库连接失败。</small></span></label>
      <div class="connect-actions"><button class="btn btn-primary" data-action="github-connect" ${gh.loading?'disabled':''}>${icon('github')} ${gh.connected?'更新连接':'连接仓库'}</button>
        <button type="button" class="btn btn-quiet" data-action="github-connect-public" ${gh.loading?'disabled':''}>${icon('check')} 一键连接公开示例（匿名）</button>
        <button type="button" class="btn btn-quiet" data-action="github-test-network" ${gh.loading?'disabled':''}>${icon('check')} 测试 GitHub 网络</button>
        <button type="button" class="btn btn-quiet" data-action="github-browser-check" ${gh.browserBusy?'disabled':''}>${icon('search')} ${gh.browserBusy?'诊断中…':'浏览器链路检查'}</button>
        <span>编辑需要仓库 Contents 读写权限；令牌不会写入本地存储。</span></div>
      <details class="github-proxy-panel" ${gh.proxyExpanded?'open':''}>
        <summary>${icon('settings')} <strong>本地网络与代理</strong> <span>${gh.proxyEffective?`${escapeHtml(gh.proxyEffective.mode==='direct'?'直连':gh.proxyEffective.mode.toUpperCase())} · ${escapeHtml(gh.proxyEffective.source||'')}`:'支持 HTTP / SOCKS5'}</span>${icon('chevron-down')}</summary>
        <div class="github-proxy-body">
          <p>全局代理不一定会被 Node.js 继承。请选择代理软件实际开放的 <strong>HTTP 或 SOCKS5 端口</strong>。配置仅在本次 Node 服务运行期间生效，不保存密钥或代理凭据。</p>
          <div class="github-proxy-controls">
            <label>连接方式<select id="ghProxyMode" aria-label="GitHub 网络代理方式">
              ${proxyModeOptions.map(([value,label])=>`<option value="${value}" ${proxy.mode===value?'selected':''}>${label}</option>`).join('')}
            </select></label>
            <label>代理主机<input id="ghProxyHost" value="${escapeHtml(proxy.host||'127.0.0.1')}" autocomplete="off" placeholder="127.0.0.1" aria-label="本地代理主机"></label>
            <label>代理端口<input id="ghProxyPort" type="number" min="1" max="65535" value="${escapeHtml(String(proxy.port||7890))}" aria-label="本地代理端口"></label>
            <button class="btn btn-small" data-action="github-proxy-apply" ${gh.proxyBusy?'disabled':''}>${icon('check')} 应用并测试</button>
            <button class="btn btn-small btn-quiet" data-action="github-proxy-clash" ${gh.proxyBusy?'disabled':''} title="一键使用 Clash / Mihomo 常见混合代理端口">${icon('settings')} Clash 7897</button>
          </div>
          <p class="github-proxy-note">Clash Verge 常见混合端口为 <code>127.0.0.1:7897</code>，同时支持 HTTP / SOCKS5；请以自己软件显示的实际端口为准。「DIRECT · HTTP 200」只表示网络探测通了，并不证明仓库请求使用了代理。</p>
          ${gh.proxyEffective?`<p class="github-proxy-effective">当前出口：${escapeHtml(gh.proxyEffective.source||'')}${gh.proxyEffective.endpoint?' · '+escapeHtml(gh.proxyEffective.endpoint):''}</p>`:''}
        </div>
      </details>
      <p class="github-connection-tip">「测试 GitHub 网络」通过 Node 检查外网；「浏览器链路检查」从当前网页分别请求主、备用和直连通道。两项检测都不使用 Token。公开仓库无需 Token 即可只读。</p>
    </section>`:''}
    ${gh.health?`<p class="github-health">${icon('check')} ${escapeHtml(gh.health)}</p>`:''}
    ${gh.browserCheck?`<pre class="github-browser-check" role="status">${escapeHtml(gh.browserCheck)}</pre>`:''}
    ${gh.attributeWarning&&gh.connected?`<p class="github-attribute-warning">${icon('alert')} 已连接，但 .gitattributes 未能检查：${escapeHtml(gh.attributeWarning)}。阅读不受影响，写入时仍会强制检查加密规则。</p>`:''}
    ${gh.error?`<div class="inline-error" role="alert">${icon('alert')} ${escapeHtml(gh.error)}</div>`:''}
    ${gh.error&&gh.connectTrace?`<details class="github-request-trace"><summary>查看这次连接的实际请求阶段与通道</summary><pre>${escapeHtml(gh.connectTrace)}</pre><small>仅显示阶段、通道及状态，不包含仓库地址、令牌或正文。</small></details>`:''}
    ${gh.loading?`<div class="loading-note">正在读取 GitHub 仓库…</div>`:''}
    ${gh.connected?`<section class="github-workspace">
      <div class="github-repo-bar">
        <div><span class="github-repo-icon">${icon('github')}</span><strong>${escapeHtml(c.owner)}/${escapeHtml(c.repo)}</strong>
          <small>${icon('branch')} ${escapeHtml(c.branch||gh.defaultBranch||'默认分支')}</small></div>
        <div class="github-crypt-actions">
          <span class="github-crypt-status">${icon('lock')} ${gh.cryptoKey?`git-crypt 已解锁 · ${escapeHtml(gh.cryptoKey.name)}`:'git-crypt 未解锁'}</span>
          <button class="btn btn-small" data-action="github-key-import">${icon('key')} ${gh.cryptoKey?'更换密钥':'导入密钥'}</button>
          ${gh.cryptoKey?`<button class="btn btn-small" data-action="github-key-lock">锁定密钥</button>`:''}
          <button class="btn btn-small" data-action="github-refresh">${icon('refresh')} 刷新</button><button class="btn btn-small" data-action="github-check">${icon('check')} 检查连接</button>
        </div>
      </div>
      <div class="github-columns">
        <div class="github-files surface">
          <div class="files-title"><strong>仓库文件</strong><button class="tool-button" title="新建 Markdown 文件" aria-label="新建 Markdown 文件" data-action="github-new" ${gh.hasToken?'':'disabled'}>${icon('plus')}</button></div>
          <button class="github-parent" data-action="github-parent" ${!gh.folder?'disabled':''}>${icon('back')} 返回上级 <span>${escapeHtml(gh.folder||'/')}</span></button>
          ${gh.files.length ? gh.files.map(item=>`<button class="github-file ${gh.note?.path===item.path?'active':''}"
            data-action="${item.type==='dir'?'github-folder':'github-note'}" data-path="${escapeHtml(item.path)}">${icon(item.type==='dir'?'folder':'file')}<span>${escapeHtml(item.name)}</span>${item.type==='dir'?icon('chevron'):''}</button>`).join(''):'<div class="file-empty">当前目录没有 Markdown 文件。</div>'}
          <div class="repo-scope">${gh.attributes?'已读取根目录 .gitattributes':'尚未检测到根目录 git-crypt 规则'} · 密钥不会上传</div>
        </div>
        <div class="github-detail surface">
          ${gh.newFileMode?`<div class="panel-heading"><h2>新建 Markdown 文件</h2><button class="text-button" data-action="github-new-cancel">取消</button></div>
            <label class="field">仓库内路径<input id="ghNewPath" placeholder="${escapeHtml(gh.folder?gh.folder+'/':'')}new-note.md" value="${escapeHtml(gh.newPath||'')}"></label>
            <p class="helper">新文件在当前分支提交。如路径匹配 .gitattributes 的 git-crypt 规则，必须先导入密钥才会加密提交；不匹配则明文保存。</p>
            <button class="btn btn-primary" data-action="github-new-confirm">开始写作</button>`:
          gh.note?`<div class="github-note-head"><div><div class="github-path">${escapeHtml(gh.note.path)} ${gh.note.encrypted?`<span class="encrypted-tag">${icon('lock')} git-crypt</span>`:''}</div><h2>${escapeHtml(gh.note.path.split('/').at(-1))}</h2></div>
              <div class="head-actions">${gh.editing?`<button class="btn" data-action="github-cancel-edit">返回预览</button><button class="btn btn-primary" data-action="github-save" ${gh.hasToken?'':'disabled'}>${icon('save')} 提交到 GitHub</button>`
              :`<button class="btn btn-primary" data-action="github-edit" ${gh.hasToken&&!gh.note.locked?'':'disabled'}>${icon('edit')} 编辑文件</button>`}</div></div>
              ${gh.note.locked?`<div class="gh-locked"><div class="gh-locked-seal">${icon('lock')}</div><h3>这篇笔记已加密</h3><p>导入对应的 git-crypt export-key 后才能预览与编辑。密钥只留在本次页面内存。</p><button class="btn btn-primary" data-action="github-key-import">选择密钥文件</button></div>`:gh.editing?`<textarea id="githubEditor" class="github-editor" aria-label="GitHub Markdown 正文" spellcheck="false">${escapeHtml(gh.draftContent)}</textarea><p class="helper">${gh.note.encrypted?'此文件将先在本地加密，再将密文提交到 GitHub；': '明文文件将直接提交；'}如远端 SHA 发生变化将拒绝覆盖。</p>`
              :`<div class="github-preview article-content">${renderMarkdown(gh.note.content)}</div>`}
              <div class="github-note-foot"><span>${gh.editing?(gh.dirty?'尚未提交修改':'当前内容尚未修改'):'来自 GitHub · 未同步到本地手记'}</span>
                ${gh.note.htmlUrl?`<a class="text-button" href="${escapeHtml(gh.note.htmlUrl)}" target="_blank" rel="noopener noreferrer">在 GitHub 查看 ${icon('external')}</a>`:''}</div>`:
          `<div class="github-blank">${icon('file')}<h3>选择一篇笔记</h3><p>从左侧文件夹中选择 Markdown 文件，即可预览。</p></div>`}
        </div>
      </div>
      <p class="integration-note">GitHub 文件与本地手记相互独立。git-crypt 密钥仅在当前页面内存中；只有匹配仓库 .gitattributes 规则的文件才允许加密提交。复杂属性规则需在 Git 中核验。</p>
    </section>`:
    `<div class="github-onboarding surface">${icon('folder')}<h3>在仓库里继续写作</h3><p>填写仓库地址后，可浏览文件夹、预览 Markdown，或使用有权限的令牌编辑并提交。</p></div>`}`;
}
