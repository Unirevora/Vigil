import {icon} from '../icons.js';
import {getMetrics,sortEntries} from '../../core/entries.js';
import {almanacForDate} from '../../core/almanac.js';
import {todayISO,escapeHtml} from '../../core/format.js';
import {entriesCards} from './entry-cards.js';

/** The 1930s desk tableau is a decorative asset; all UI content stays live. */
export function homeView(state){
  const metrics=getMetrics(state.entries);
  const recent=sortEntries(state.entries).slice(0,3);
  const latest=recent[0];
  const seasonal=almanacForDate(todayISO());
  const saved=[...(state.drafts||[])].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  const continueCard=saved
    ? `<button class="draft-banner illustrated-slip" data-action="resume-draft" data-id="${escapeHtml(saved.key)}">
        <span class="quick-symbol">${icon('pen')}</span>
        <span class="quick-copy"><strong>${escapeHtml(saved.title||'未完成的手记')}</strong><small>草稿已自动保存 · 继续写</small></span>
        <span class="quick-arrow">${icon('arrow')}</span>
      </button>`
    : latest
      ? `<button class="draft-banner illustrated-slip" data-action="read" data-id="${escapeHtml(latest.id)}">
          <span class="quick-symbol">${icon('book')}</span>
          <span class="quick-copy"><strong>${escapeHtml(latest.title||'上次的手记')}</strong><small>最近一页 · 重新翻阅</small></span>
          <span class="quick-arrow">${icon('arrow')}</span>
        </button>`
      : `<button class="draft-banner illustrated-slip" data-action="new">
          <span class="quick-symbol">${icon('pen')}</span>
          <span class="quick-copy"><strong>开启第一张纸</strong><small>把今天写成一篇手记</small></span>
          <span class="quick-arrow">${icon('arrow')}</span>
        </button>`;

  return `<div class="home-layout">
    <section class="heritage-hero" aria-label="不眠手记首页">
      <div class="hero-scene" aria-hidden="true"><img src="/assets/typewriter-still-life.webp" alt="" draggable="false"></div>
      <div class="heritage-copy">
        <div class="heritage-kicker">不眠手记 <span class="kicker-dot">·</span> VIGIL</div>
        <h1>把日子写成<br><em>铅字</em>，<br>慢慢收藏<span class="hero-title-stop">。</span></h1>
        <p>让微小的时光，在字里行间留下痕迹。</p>
        <div class="hero-actions">
          <button class="btn btn-primary" data-action="new">${icon('pen')} 写下今天</button>
          <button class="btn btn-quiet" data-action="nav" data-to="entries">翻阅手记 ${icon('arrow')}</button>
        </div>
        <div class="hero-footer"><span>PERSONAL ARCHIVE</span><span class="hero-footer-line"></span><span>一日一笺</span></div>
      </div>
    </section>

    <section class="heritage-stats" aria-label="写作统计">
      <div class="heritage-stat stat-landscape"><strong>${metrics.total}</strong><span>手记</span><small>篇</small></div>
      <div class="heritage-stat stat-blossom"><strong>${metrics.thisMonth}</strong><span>本月记录</span><small>篇</small></div>
      <div class="heritage-stat stat-waves"><strong>${metrics.words.toLocaleString('zh-CN')}</strong><span>已存文字</span><small>字</small></div>
    </section>

    <div class="home-quick-row">
      <button class="season-teaser illustrated-slip" data-action="nav" data-to="almanac">
        <span class="season-teaser-seal">节</span>
        <span class="quick-copy"><strong>今日节气 · ${seasonal.selected.name}</strong><small>${seasonal.note}</small></span>
        <span class="quick-arrow">${icon('arrow')}</span>
      </button>
      ${continueCard}
    </div>

    <div class="section-title home-recent-head"><div><h2>最近手记</h2><span class="recent-divider"></span><p>记录生活的细枝末节</p></div>
      <span class="recent-head-line"></span><button class="text-button" data-action="nav" data-to="entries">全部手记 ${icon('arrow')}</button>
    </div>
    <div class="note-grid">${entriesCards(recent)}</div>
  </div>`;
}
