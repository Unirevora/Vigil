import {icon} from '../icons.js';
import {APP_VERSION} from '../../core/diagnostics.js';

const textStatus=(value,positive='可用',negative='不可用')=>
  `<span class="about-check ${value?'positive':'negative'}">${icon(value?'check':'alert')} ${value?positive:negative}</span>`;

export function aboutPanel(state){
  const d=state.aboutDiagnostics;
  return `<div class="about-page">
    <div class="about-hero">
      <div class="about-mark" aria-hidden="true"><img src="/assets/vigil-mark.svg" alt="" width="64" height="70"></div>
      <div><div class="about-overline">VIGIL / LOCAL-FIRST JOURNAL</div><h2>不眠手记</h2>
        <p>把日子写成文字，也让旧时光成为新的线索。</p>
        <span class="about-version">版本 ${APP_VERSION} · 同题同序</span></div>
    </div>
    <div class="about-metrics" aria-label="当前设备的手记概况">
      <div><strong>${state.entries.length}</strong><span>篇正式手记</span></div>
      <div><strong>${state.drafts.length}</strong><span>份未完草稿</span></div>
      <div><strong>${state.backups.length}</strong><span>份本地备份</span></div>
    </div>
    <section class="about-section">
      <div class="about-section-heading">${icon('shield')} <h3>你的文字，归你所有</h3></div>
      <p>正式手记与草稿优先保存在当前浏览器；只有你主动连接 GitHub 时，才会访问相应仓库。GitHub 访问令牌与 git-crypt 密钥不写入本地设置。普通 JSON 导出不会包含背景图片、草稿或远端仓库文件。</p>
      <p>浏览器数据可能被清除。需要长期保存时，请前往「设置 → 数据」导出备份，并自行保管加密文件口令。</p>
      <button class="about-link-inline" data-action="settings-tab" data-tab="data">前往数据与备份 ${icon('arrow')}</button>
    </section>
    <section class="about-section">
      <div class="about-section-heading">${icon('spark')} <h3>当前版本</h3></div>
      <div class="about-release"><span>01</span><div><strong>页面标题统一</strong><small>顶栏只保留快捷操作，功能页共用一个醒目的标题样式，减少重复信息。</small></div></div>
      <div class="about-release"><span>02</span><div><strong>快速智能筛选</strong><small>在手记列表一键查看最近七天、含未完成待办的笔记，并可组合收藏和标签。</small></div></div>
      <div class="about-release"><span>03</span><div><strong>筛选结果导出</strong><small>仅把当前搜索和筛选出的手记保存为 JSON，不改写正式文库。</small></div></div>
    </section>
    <section class="about-section">
      <div class="about-section-heading">${icon('info')} <h3>本地环境检查</h3></div>
      <p>检查浏览器是否支持草稿保存、离线编辑和加密备份。不会联网，也不会读取手记正文。</p>
      <div class="about-actions"><button class="btn" data-action="about-diagnose">${icon('refresh')} ${d?'重新检查':'开始检查'}</button>
        <button class="btn btn-quiet" data-action="about-copy-diagnostics" ${d?'':'disabled'}>${icon('file')} 复制诊断摘要</button></div>
      ${d?`<div class="about-diagnostic-results" role="status">
        <div><span>本地存储</span>${textStatus(d.localStorage)}</div>
        <div><span>图片存储</span>${textStatus(d.indexedDB)}</div>
        <div><span>Web Crypto / 安全环境</span>${textStatus(d.webCrypto&&d.secureContext)}</div>
        <div><span>Markdown 编辑器</span>${textStatus(d.markdownEditor)}</div>
        <div><span>KaTeX 公式支持</span>${textStatus(d.katex)}</div>
        <div><span>文库写入保护</span>${textStatus(!d.storageProtected,'未锁定','只读保护')}</div>
        <div><span>GitHub 工作区</span>${textStatus(d.githubConnected,'本次已连接','当前未连接')}</div>
      </div>`:''}
    </section>
    <section class="about-section about-resources">
      <div class="about-section-heading">${icon('book')} <h3>帮助与文档</h3></div>
      <a href="/docs/MVP.md" target="_blank" rel="noopener noreferrer">功能与重构规格 ${icon('external')}</a>
      <a href="/docs/GITHUB.md" target="_blank" rel="noopener noreferrer">GitHub 仓库使用说明 ${icon('external')}</a>
      <a href="/docs/GIT-CRYPT-1.5.md" target="_blank" rel="noopener noreferrer">git-crypt 加密安全说明 ${icon('external')}</a>
      <a href="/CHANGELOG.md" target="_blank" rel="noopener noreferrer">完整更新日志 ${icon('external')}</a>
    </section>
    <div class="about-footer">以清醒的笔触，记住平凡的一日。<span>VIGIL · ${APP_VERSION}</span></div>
  </div>`;
}
