import {sortEntries} from '../../core/entries.js';
import {escapeHtml,excerpt,humanDate,todayISO} from '../../core/format.js';

export function heroPaper(state) {
  const latest=sortEntries(state.entries)[0];
  const date=latest?.date||todayISO();
  return `<div class="hero-art" aria-hidden="true">
    <div class="typewriter-scene">
      <div class="typewriter-paper">
        <div class="paper-letterhead"><span>私人手记 / VIGIL</span><span>No. ${String(state.entries.length).padStart(3,'0')}</span></div>
        <div class="paper-rule"></div>
        <div class="paper-date">${escapeHtml(humanDate(date))}</div>
        <div class="paper-heading">${escapeHtml(latest?.title||'致未写完的日子')}</div>
        <div class="paper-text">${escapeHtml(excerpt(latest?.content||'愿我们在字里行间，看见生活本来的模样。'))}</div>
        <div class="paper-seal">不眠<br>手记</div>
      </div>
      <div class="typewriter-roller"></div>
      <div class="typewriter-shell">
        <div class="typewriter-nameplate">V I G I L　 1 9 3 6</div>
        <div class="typewriter-keybed">
          ${Array.from({length:24},(_,i)=>`<span class="typewriter-key ${i%9===8?'key-dark':''}"></span>`).join('')}
        </div>
        <div class="typewriter-spacebar"></div>
      </div>
      <div class="scene-caption">VIGIL · 铅字旧梦</div>
    </div>
  </div>`;
}
