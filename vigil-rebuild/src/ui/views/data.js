import {icon} from '../icons.js';
import {getMetrics} from '../../core/entries.js';
import {SCHEMA_VERSION} from '../../storage/schema.js';

export function dataView(state) {
  const demoCount=state.entries.filter(e=>e.demo).length;
  return `<div class="heading-row">
    <div><div class="kicker divider-kicker">PRIVACY & YOUR DATA</div><h1 class="page-title">门与数据</h1><p class="page-lead">你的文字，始终由你自己保管。</p></div>
  </div>
  <div class="notice" style="margin:0 0 24px">${icon('shield')}<span>这是本地可交互原型：手记保存在当前浏览器的 localStorage，不会发送到服务器。清理浏览器数据可能导致内容丢失，建议随时导出备份。</span></div>
  <div class="data-grid">
    <section class="data-card">
      <div class="data-icon">${icon('download')}</div>
      <h3>导出手记</h3>
      <p>将全部 ${state.entries.length} 篇手记保存为 JSON 文件，可离线备份，之后重新导入。</p>
      <button class="btn btn-primary" data-action="export" ${!state.entries.length?'disabled':''}>${icon('download')} 导出 JSON</button>
    </section>
    <section class="data-card">
      <div class="data-icon warm">${icon('upload')}</div>
      <h3>导入手记</h3>
      <p>选择本原型导出的 JSON 文件。导入前会确认替换，并尝试下载当前数据备份。</p>
      <button class="btn" data-action="import" ${state.corruptStorage?'disabled':''}>${icon('upload')} 选择 JSON 文件</button>
    </section>
  </div>
  <section class="data-panel">
    <div class="row between gap-12" style="flex-wrap:wrap">
      <div><div class="data-panel-title">当前手记库</div><p>${state.entries.length} 篇手记 · ${getMetrics(state.entries).words.toLocaleString('zh-CN')} 字 · Schema v${SCHEMA_VERSION}</p></div>
      ${demoCount ? `<button class="btn btn-small btn-danger" data-action="clear-demo">${icon('trash')} 清除 ${demoCount} 篇示例</button>`:''}
    </div>
    <div class="data-mini">存储空间：浏览器本地 · 不支持自动云同步</div>
  </section>
  <div class="warning-box"><strong>关于旧版数据迁移</strong><br>原项目的历史 localStorage Key、JSON 字段和加密格式尚未提供。重构版可接续上一版单 HTML 原型的 Schema v1 数据；真正的原项目旧数据仍需核对源码才能做无损迁移。</div>
  <p class="footer-note">YOUR WORDS, YOUR SPACE. · 数据安全优先于复杂动效</p>`;
}
