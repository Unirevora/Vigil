import {icon} from '../icons.js';
import {escapeHtml,humanDate,excerpt,todayISO} from '../../core/format.js';
import {sortEntries,getMetrics} from '../../core/entries.js';
import {yearsAgoToday} from '../../core/calendar.js';
import {entriesCards} from './entry-cards.js';

export function homeView(state) {
  const recent=sortEntries(state.entries).slice(0,3);
  const m=getMetrics(state.entries), last=recent[0];
  const memories=yearsAgoToday(state.entries);
  const draft=[...(state.drafts||[])].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  return `<div class="home-layout">
    <section class="welcome-card">
      <div class="welcome-main">
        <div class="eyebrow">你的私人书桌 <span class="eyebrow-line"></span></div>
        <h1>把今天，<br><em>写进纸里。</em></h1>
        <p>一小段文字，也足以留住一个日子。</p>
        <div class="actions"><button class="btn btn-primary btn-lg" data-action="new">${icon('pen')} 写下今天</button>
        <button class="btn btn-quiet" data-action="nav" data-to="entries">翻阅手记 ${icon('arrow')}</button></div>
      </div>
      <div class="welcome-art" aria-hidden="true">
        <div class="art-circle"></div><div class="art-letter">
          <div class="art-topline">VIGIL / PRIVATE NOTES</div>
          <div class="art-rule"></div><div class="art-title">${escapeHtml(last?.title||'留下一段记忆')}</div>
          <div class="art-text">${escapeHtml(excerpt(last?.content||'时间会过去，文字会留下。'))}</div><div class="art-stamp">记</div>
        </div><div class="art-shadow"></div>
      </div>
    </section>
    <div class="stats-row">
      <div><strong>${m.total}</strong><span>篇手记</span></div>
      <div><strong>${m.thisMonth}</strong><span>本月记录</span></div>
      <div><strong>${m.words.toLocaleString('zh-CN')}</strong><span>累计字数</span></div>
    </div>
    ${draft?`<div class="draft-banner"><span>${icon('edit')}</span><div><strong>${escapeHtml(draft.title||'尚未完成的手记')}</strong><small>有一份未完成的草稿</small></div><button class="btn btn-small" data-action="resume-draft" data-id="${escapeHtml(draft.key)}">继续写 ${icon('arrow')}</button></div>`:''}
    ${memories.length?`<section class="memory-strip"><div><small>往年今日</small><h3>${escapeHtml(memories[0].title)}</h3><p>${escapeHtml(humanDate(memories[0].date))}</p></div><button class="btn btn-small" data-action="read" data-id="${escapeHtml(memories[0].id)}">重读 ${icon('arrow')}</button></section>`:''}
    <div class="section-title"><div><h2>最近手记</h2><p>那些值得留存的瞬间</p></div><button class="text-button" data-action="nav" data-to="entries">查看全部 ${icon('arrow')}</button></div>
    <div class="note-grid">${entriesCards(recent)}</div>
  </div>`;
}
