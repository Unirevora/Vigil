import {icon} from '../icons.js';
import {getMetrics,sortEntries} from '../../core/entries.js';
import {escapeHtml} from '../../core/format.js';
import {entriesCards} from './entry-cards.js';
import {heroPaper} from './hero-paper.js';

export function homeView(state) {
  const metrics=getMetrics(state.entries);
  const recent=sortEntries(state.entries).slice(0,3);
  const drafts=state.drafts||[];
  const lastDraft=[...drafts].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  return `<section class="hero">
    <div class="hero-copy">
      <div class="hero-masthead"><span class="hero-masthead-line"></span><span>庚 申 · 字 纸 档</span><span class="hero-masthead-english">A PRIVATE CORRESPONDENCE</span></div>
      <div class="hero-eyebrow">一字一纸　/　写给日常</div>
      <h1>把日子<br>写成<em>铅字</em>，<br>慢慢收藏<span class="hero-title-stop">。</span></h1>
      <p>让那些容易被时间带走的微光，留在一页旧纸上。不必写得漂亮，只要写得真实。</p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-hero" data-action="new">${icon('pen')} 提笔记一篇 <span class="btn-suffix">↗</span></button>
        <button class="btn btn-hero-outline" data-action="nav" data-to="entries">翻阅手记 ${icon('arrow')}</button>
      </div>
      <div class="hero-footer"><span>PERSONAL JOURNAL</span><span>第 · 壹 · 辑</span></div>
    </div>
    ${heroPaper(state)}
  </section>
  <section class="stats" aria-label="写作统计">
    <div class="stat"><div class="stat-index">01 / ENTRIES</div><div class="stat-value">${metrics.total}<small>篇</small></div><div class="stat-label">归档手记</div></div>
    <div class="stat"><div class="stat-index">02 / THIS MONTH</div><div class="stat-value">${metrics.thisMonth}<small>篇</small></div><div class="stat-label">本月落笔</div></div>
    <div class="stat"><div class="stat-index">03 / TOTAL WORDS</div><div class="stat-value">${metrics.words.toLocaleString('zh-CN')}<small>字</small></div><div class="stat-label">留存字数</div></div>
  </section>
  ${lastDraft?`<section class="draft-callout">
    <span class="draft-callout-mark">${icon('edit')}</span>
    <div><div class="draft-callout-kicker">UNFINISHED LETTER / 未完成的草稿</div><strong>${escapeHtml(lastDraft.title||'一封未命名的手记')}</strong><p>文字已暂存在这台设备，可继续写下去。</p></div>
    <button class="btn btn-outline" data-action="resume-draft" data-id="${escapeHtml(lastDraft.key)}">续写草稿 ${icon('arrow')}</button>
  </section>`:''}
  <div class="section-heading">
    <div><div class="section-overline">COLLECTION / 手记索引</div><h2>近日手记 <span class="sect-sub">LATEST MEMORIES</span></h2></div>
    <button class="btn-text" data-action="nav" data-to="entries">查阅全部 ${icon('arrow')}</button>
  </div>
  <div class="entry-list">${entriesCards(recent)}</div>
  ${state.entries.some(e=>e.demo)?'<p class="demo-note">※ 内含可删除的展示手记；它们不会影响你自己书写的内容。</p>':''}
  <div class="footer-note"><span>— 无论平凡与否，皆值得一记 —</span><span>VIGIL / 2026</span></div>`;
}
