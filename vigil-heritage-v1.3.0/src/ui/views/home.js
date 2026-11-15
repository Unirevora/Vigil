import {icon} from '../icons.js';
import {getMetrics,sortEntries} from '../../core/entries.js';
import {almanacForDate} from '../../core/almanac.js';
import {todayISO,escapeHtml} from '../../core/format.js';
import {entriesCards} from './entry-cards.js';
import {heroPaper} from './hero-paper.js';

export function homeView(state){
  const metrics=getMetrics(state.entries);
  const recent=sortEntries(state.entries).slice(0,3);
  const seasonal=almanacForDate(todayISO());
  const saved=[...(state.drafts||[])].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  return `<div class="home-layout">
    <section class="heritage-hero">
      <div class="heritage-copy">
        <div class="heritage-kicker">不眠手记 · VIGIL</div>
        <h1>把日子写成<br><em>铅字</em>，<br>慢慢收藏<span class="hero-title-stop">。</span></h1>
        <p>让微小的时光，在字里行间留下痕迹。</p>
        <div class="hero-actions">
          <button class="btn btn-primary" data-action="new">${icon('pen')} 写下今天</button>
          <button class="btn btn-quiet" data-action="nav" data-to="entries">翻阅手记 ${icon('arrow')}</button>
        </div>
        <div class="hero-footer"><span>PERSONAL ARCHIVE</span><span>一日一笺</span></div>
      </div>
      ${heroPaper(state)}
    </section>

    <section class="heritage-stats" aria-label="写作统计">
      <div class="heritage-stat"><span>手记</span><strong>${metrics.total}</strong><small>篇</small></div>
      <div class="heritage-stat"><span>本月记录</span><strong>${metrics.thisMonth}</strong><small>篇</small></div>
      <div class="heritage-stat"><span>已存文字</span><strong>${metrics.words.toLocaleString('zh-CN')}</strong><small>字</small></div>
    </section>

    <div class="home-quick-row">
      <button class="season-teaser" data-action="nav" data-to="almanac">
        <span class="season-teaser-seal">节</span>
        <span class="season-teaser-copy"><strong>今日节令 · ${seasonal.selected.name}</strong><small>${seasonal.note}</small></span>
        ${icon('arrow')}
      </button>
      ${saved?`<button class="draft-banner" data-action="resume-draft" data-id="${escapeHtml(saved.key)}">
        ${icon('edit')} <span><strong>${escapeHtml(saved.title||'未完成的手记')}</strong><small>草稿已自动暂存 · 继续写</small></span>${icon('chevron')}
      </button>`:''}
    </div>

    <div class="section-title"><div><h2>最近手记</h2><p>一些平凡而珍贵的日子</p></div><button class="text-button" data-action="nav" data-to="entries">全部手记 ${icon('arrow')}</button></div>
    <div class="note-grid">${entriesCards(recent)}</div>
  </div>`;
}
