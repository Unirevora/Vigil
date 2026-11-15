import {icon} from '../icons.js';
import {getMetrics} from '../../core/entries.js';
import {escapeHtml,charCount} from '../../core/format.js';

const dateTime=iso=>{
  const d=new Date(iso);
  if(Number.isNaN(d.valueOf()))return '时间未知';
  return new Intl.DateTimeFormat('zh-CN',{
    year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hour12:false
  }).format(d);
};

function backupRow(backup,index) {
  const count=backup.entries.length;
  return `<div class="backup-row">
    <div class="backup-number">${String(index+1).padStart(2,'0')}</div>
    <div class="backup-info">
      <div class="backup-name">${escapeHtml(backup.label)} <span class="backup-type">${escapeHtml(({
          autosave:'自动副本',manual:'手动副本','before-delete':'删除前',
          'before-import':'导入前','before-restore':'恢复前'
        }[backup.reason]||'历史快照'))}</span></div>
      <div class="backup-meta">${escapeHtml(dateTime(backup.createdAt))} <span class="meta-divider">/</span> ${count} 篇手记 <span class="meta-divider">/</span> ${backup.entries.reduce((s,e)=>s+charCount(e.content),0)} 字</div>
    </div>
    <div class="backup-actions">
      <button class="btn btn-small" data-action="restore-backup" data-id="${escapeHtml(backup.id)}">${icon('archive')} 恢复</button>
      <button class="icon-action icon-action-danger" title="删除此备份" aria-label="删除此备份" data-action="delete-backup" data-id="${escapeHtml(backup.id)}">${icon('trash')}</button>
    </div>
  </div>`;
}
function draftRow(draft) {
  return `<div class="draft-row">
    <span class="draft-row-icon">${icon('edit')}</span>
    <span class="draft-row-info"><strong>${escapeHtml(draft.title||'未命名草稿')}</strong><small>${escapeHtml(dateTime(draft.updatedAt))} · ${charCount(draft.content)} 字 · ${draft.key==='__new__'?'尚未发布':'原手记修改'}</small></span>
    <button class="btn btn-small" data-action="resume-draft" data-id="${escapeHtml(draft.key)}">续写 ${icon('arrow')}</button>
    <button class="icon-action icon-action-danger" aria-label="舍弃草稿" title="舍弃草稿" data-action="discard-draft" data-id="${escapeHtml(draft.key)}">${icon('trash')}</button>
  </div>`;
}
export function dataView(state) {
  const total=getMetrics(state.entries);
  const demos=state.entries.filter(e=>e.demo).length;
  const backups=state.backups||[];
  const drafts=state.drafts||[];
  return `<div class="page-header">
    <div class="page-heading"><div class="kicker"><span class="kicker-line"></span>THE ARCHIVE / 存储与保全</div>
      <h1 class="page-title">门与数据<span class="heading-punctuation">。</span></h1>
      <p class="page-lead">每一个字都属于你，留下或带走，都由你决定。</p>
    </div>
    <span class="page-header-stamp">存<br>档</span>
  </div>

  <div class="archive-overview">
    <div><div class="archive-overline">LOCAL ARCHIVE / 本机文库</div>
    <strong>${total.total}<small>篇</small></strong><span>已正式存档的手记</span></div>
    <div><div class="archive-overline">DRAFTS / 未完稿</div>
    <strong>${drafts.length}<small>份</small></strong><span>自动暂存的手记</span></div>
    <div><div class="archive-overline">BACKUPS / 副本</div>
    <strong>${backups.length}<small> / 5</small></strong><span>保留最近五份本地快照</span></div>
  </div>

  <section class="archive-section">
    <div class="archive-section-header">
      <div><div class="section-overline">01 / SECURE THE RECORD</div><h2>数据来往</h2></div>
      <span class="archive-section-note">复制与转移</span>
    </div>
    <div class="data-grid">
      <div class="data-card">
        <div class="data-card-top"><span class="data-icon">${icon('download')}</span><span class="data-no">FILE / 01</span></div>
        <h3>导出手记</h3><p>将已正式保存的 ${total.total} 篇手记封装为 JSON 文件，供离线备份、换机迁移使用。</p>
        <button class="btn btn-primary" data-action="export" ${!total.total?'disabled':''}>${icon('download')} 导出 JSON</button>
      </div>
      <div class="data-card">
        <div class="data-card-top"><span class="data-icon">${icon('upload')}</span><span class="data-no">FILE / 02</span></div>
        <h3>导入手记</h3><p>导入本项目的 Schema v1 JSON。替换前会要求确认，并优先创建安全副本。</p>
        <button class="btn btn-outline" data-action="import" ${state.corruptStorage?'disabled':''}>${icon('upload')} 选择 JSON</button>
      </div>
    </div>
  </section>

  <section class="archive-section" id="backupSection">
    <div class="archive-section-header">
      <div><div class="section-overline">02 / FIVE LAST COPIES</div><h2>本地备份 <span class="archive-count">${backups.length} / 5</span></h2></div>
      <button class="btn btn-small btn-primary" data-action="create-backup" ${state.corruptStorage||state.backupUnsafe?'disabled':''}>${icon('plus')} 立即备份</button>
    </div>
    <p class="archive-section-description">每次正式保存手记后自动生成副本，最多保留最近 5 份；删除或恢复前也会留存安全快照。存储空间不足时会明确提示。</p>
    ${state.backupError?`<div class="data-warning">${icon('alert')} ${escapeHtml(state.backupError)}。请检查存储空间或数据结构；若备份记录损坏，系统会暂停覆盖操作。</div>`:''}
    <div class="backup-list">
      ${backups.length?backups.map(backupRow).join(''):`<div class="archive-empty">${icon('archive')} 暂无备份。你可以点击「立即备份」建立第一份副本。</div>`}
    </div>
  </section>

  <section class="archive-section">
    <div class="archive-section-header">
      <div><div class="section-overline">03 / UNFINISHED LETTERS</div><h2>未完草稿 <span class="archive-count">${drafts.length} 份</span></h2></div>
    </div>
    <p class="archive-section-description">写作时自动暂存；草稿独立于正式手记，不会暗中覆盖已经发布的版本。</p>
    ${state.draftError?`<div class="data-warning">${icon('alert')} ${escapeHtml(state.draftError)}。原有草稿已保留，请勿清空浏览器数据。</div>`:''}
    <div class="draft-list">${drafts.length?drafts.map(draftRow).join(''):`<div class="archive-empty">${icon('pen')} 书写尚未开始，草稿夹暂时空着。</div>`}</div>
  </section>

  ${demos?`<div class="demo-management"><div><strong>清除演示手记</strong><p>只删除 ${demos} 篇演示内容，不影响你自己写过的手记。</p></div><button class="btn btn-small btn-danger" data-action="clear-demo">${icon('trash')} 清除演示</button></div>`:''}
  <div class="archive-note"><strong>留存说明 / DATA NOTE</strong><p>所有手记、草稿及快照都保存在此浏览器的本地存储中。清理浏览器数据、系统损坏或更换设备可能一并丢失这些副本。<b>请定期导出 JSON 到其他位置。</b> 当前尚未直接兼容原项目 v2.8.2 的历史数据与加密格式。</p></div>
  <div class="footer-note"><span>— 不负所记，亦不负所失 —</span><span>VIGIL ARCHIVE</span></div>`;
}
