import {icon} from '../icons.js';
import {escapeHtml,charCount} from '../../core/format.js';
import {formatFootprint} from '../../storage/footprint.js';

const dt=v=>{const x=new Date(v);return Number.isNaN(x.valueOf())?'未知时间':x.toLocaleString('zh-CN',{hour12:false});};

export function dataManagementPanels(state,{embedded=false}={}){
  const drafts=state.drafts||[],backups=state.backups||[];
  return `${embedded?`<div class="settings-panel-head"><div><h2>数据与备份</h2><p>导入导出、自动草稿与本地备份都集中放在这里。</p></div></div>`:''}
    <p class="data-footprint" aria-live="polite">${state.storageUsage?.available?`本地手记、草稿、备份和设置约占 ${formatFootprint(state.storageUsage.bytes)}（${state.storageUsage.count} 个存储项）`:'浏览器未开放存储占用统计'} · 背景图片使用独立的 IndexedDB，不计入此数值。</p>
    <div class="data-summary">
      <div><strong>${state.entries.length}</strong><span>篇手记</span></div>
      <div><strong>${drafts.length}</strong><span>份草稿</span></div>
      <div><strong>${backups.length} / 5</strong><span>份备份</span></div>
    </div>
    <div class="data-actions">
      <section class="surface data-action-card"><div class="data-symbol">${icon('download')}</div><h2>导出手记</h2><p>将正式手记保存为 JSON 文件。</p><button class="btn btn-primary" data-action="export" ${state.corruptStorage?'disabled':''}>${icon('download')} 导出 JSON</button></section>
      <section class="surface data-action-card"><div class="data-symbol">${icon('upload')}</div><h2>导入手记</h2><p>导入前会先备份当前文库。</p><button class="btn" data-action="import" ${state.corruptStorage?'disabled':''}>${icon('upload')} 选择文件</button></section>
    </div>
    <section class="secure-backup-strip">
      <div class="secure-seal">${icon('lock')}</div>
      <div class="secure-backup-copy">
        <h2>口令加密备份 <span class="secure-new">NEW</span></h2>
        <p>使用 AES-256-GCM 保护导出文件；口令仅用于本次操作。</p>
      </div>
      <button class="btn btn-primary" data-action="export-encrypted" ${state.corruptStorage?'disabled':''}>${icon('lock')} 加密导出</button>
      <button class="btn" data-action="import-encrypted" ${state.corruptStorage?'disabled':''}>${icon('upload')} 加密导入</button>
    </section>
    <section class="secure-backup-strip gitcrypt-local-panel">
      <div class="secure-seal">${icon('key')}</div>
      <div class="secure-backup-copy"><h2>git-crypt 文件工坊</h2><p>读取 git-crypt export-key，在当前设备上加密或解密 Markdown，不会上传密钥。</p>
        <small class="gitcrypt-key-state">${state.github.cryptoKey?`已解锁：${escapeHtml(state.github.cryptoKey.name)}`:'尚未导入密钥'}</small></div>
      <button class="btn" data-action="github-key-import">${icon('key')} 导入密钥</button>
      <button class="btn" data-action="gitcrypt-local-encrypt" ${state.github.cryptoKey?'':'disabled'}>${icon('lock')} 本地加密</button>
      <button class="btn" data-action="gitcrypt-local-decrypt" ${state.github.cryptoKey?'':'disabled'}>${icon('download')} 本地解密</button>
    </section>
    <p class="safety-note">git-crypt 使用二进制仓库密钥，与上述口令加密 JSON 是两套不同格式；使用前须拥有合法导出的密钥。</p>
    <section class="data-section"><div class="section-title compact"><div><h2>本地备份</h2><p>最多保留最近 5 份</p></div><button class="btn btn-small" data-action="create-backup" ${state.corruptStorage||state.backupUnsafe?'disabled':''}>${icon('plus')} 立即备份</button></div>
      ${state.backupError?`<div class="inline-error">${escapeHtml(state.backupError)}</div>`:''}
      <div class="surface list-surface">${backups.length?backups.map(b=>`<div class="data-row"><span class="data-row-icon">${icon('archive')}</span><div><strong>${escapeHtml(b.label)}</strong><small>${escapeHtml(dt(b.createdAt))} · ${b.entries.length} 篇</small></div>
        <button class="btn btn-small" data-action="restore-backup" data-id="${escapeHtml(b.id)}">恢复</button>
        <button class="icon-button danger" data-action="delete-backup" data-id="${escapeHtml(b.id)}" title="删除备份">${icon('trash')}</button></div>`).join(''):'<div class="empty-list">暂无备份记录</div>'}</div></section>
    <section class="data-section"><div class="section-title compact"><div><h2>未完草稿</h2><p>自动保存，随时续写</p></div></div>
      ${state.draftError?`<div class="inline-error">${escapeHtml(state.draftError)}</div>`:''}
      <div class="surface list-surface">${drafts.length?drafts.map(x=>`<div class="data-row"><span class="data-row-icon">${icon('edit')}</span><div><strong>${escapeHtml(x.title||'未命名草稿')}</strong><small>${escapeHtml(dt(x.updatedAt))} · ${charCount(x.content)} 字</small></div>
        <button class="btn btn-small" data-action="resume-draft" data-id="${escapeHtml(x.key)}">继续</button><button class="icon-button danger" data-action="discard-draft" data-id="${escapeHtml(x.key)}" title="舍弃草稿">${icon('trash')}</button></div>`).join(''):'<div class="empty-list">没有未完成的草稿</div>'}</div></section>
    ${state.entries.some(e=>e.demo)?`<div class="subtle-row"><span>清除演示手记（不影响个人内容）</span><button class="text-button danger" data-action="clear-demo">清除演示</button></div>`:''}
    <p class="safety-note">${icon('info')} 本地备份会随浏览器数据一起清除；加密文件须牢记口令。新加密格式不兼容原项目 v2.8.2 的未知历史格式。GitHub 仓库独立存储。</p>`;
}

export function dataView(state){
  return `<div class="page-head"><div><h1>数据管理</h1><p>安全保存你的文字。</p></div></div>${dataManagementPanels(state)}`;
}
