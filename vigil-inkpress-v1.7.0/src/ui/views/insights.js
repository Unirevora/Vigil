import {icon} from '../icons.js';
import {escapeHtml} from '../../core/format.js';
import {pageHeading} from './page-heading.js';
import {tasksFromEntries,connectionsFromEntries,reviewMetrics,promptFromEntries} from '../../insights/insights.js';

export function insightsView(state){
  const entries=state.entries;
  const tasks=tasksFromEntries(entries),review=reviewMetrics(entries),links=connectionsFromEntries(entries),prompt=promptFromEntries(entries);
  const pending=tasks.filter(x=>!x.complete),done=tasks.filter(x=>x.complete);
  const visible=[...pending.slice(0,24),...done.slice(0,5)];
  const popular=review.tags.slice(0,7);
  return `<div class="insights-page">
    ${pageHeading({title:'线索与行动',description:'让写下的想法，成为日后真正可用的答案。',className:'insights-head',actions:`<button class="btn btn-primary" data-action="new">${icon('pen')} 写一篇手记</button>`})}
    <div class="insight-metrics">
      <div class="insight-metric"><strong>${review.week}</strong><span>近七日记录</span></div>
      <div class="insight-metric"><strong>${review.streak}</strong><span>连续写作日</span></div>
      <div class="insight-metric"><strong>${review.pending}</strong><span>未完成事项</span></div>
      <div class="insight-metric"><strong>${links.edges.length}</strong><span>笔记之间的关联</span></div>
    </div>
    <div class="insights-columns">
      <section class="insight-panel task-panel"><div class="insight-panel-head"><div><small>行动清单</small><h2>从文字走向完成</h2></div><span>${pending.length} 待办</span></div>
        <p class="insight-helper">自动收集所有手记中的 <code>- [ ]</code> 任务。点击圆框会同步修改原文，先创建一份安全备份。</p>
        <div class="insight-task-list">
          ${visible.length?visible.map(t=>`<div class="insight-task ${t.complete?'completed':''}">
            <button type="button" class="insight-task-check" data-action="task-toggle" data-id="${escapeHtml(t.entryId)}" data-line="${t.line}" data-source="${escapeHtml(t.source)}"
              aria-label="${t.complete?'标记未完成':'标记已完成'}：${escapeHtml(t.title)}" title="${t.complete?'重新标记为待办':'标记完成'}">${t.complete?icon('check'):''}</button>
            <div class="insight-task-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.entryTitle)} ${t.due?` · ${t.overdue?'已逾期':'截止'} ${escapeHtml(t.due)}`:''}</small></div>
            <button class="insight-task-open" data-action="read" data-id="${escapeHtml(t.entryId)}" title="打开原手记">${icon('chevron')}</button></div>`).join(''):
            `<div class="insight-empty">这里还没有待办。在任意手记输入 <code>- [ ] 一个行动</code>，它就会出现在这里。</div>`}
        </div>
      </section>
      <div class="insight-side-stack">
        <section class="insight-panel reflection-panel"><div class="reflection-mark">省</div><small>一周回顾 · 本地生成</small><h2>给未来的自己</h2>
          <blockquote>${escapeHtml(prompt.text)}</blockquote><p>${escapeHtml(prompt.context)}</p>
          <button class="text-button" data-action="new">写下这段回顾 ${icon('arrow')}</button>
        </section>
        <section class="insight-panel link-panel"><div class="insight-panel-head"><div><small>关联手记</small><h2>那些串联的线索</h2></div>${icon('link')}</div>
          ${links.edges.length?links.edges.slice(0,6).map(edge=>`<button class="insight-connection" data-action="read" data-id="${escapeHtml(edge.to)}"><span>${escapeHtml(edge.fromTitle)}</span>${icon('arrow')}<strong>${escapeHtml(edge.toTitle)}</strong></button>`).join(''):
            `<p class="insight-helper">在任意手记写入 <code>[[另一篇手记标题]]</code>，就能建立双向关联。</p>`}
          ${links.unresolved.length?`<div class="unresolved-links">${icon('alert')} ${links.unresolved.length} 个关联尚未找到目标笔记</div>`:''}
        </section>
        <section class="insight-panel topic-panel"><div class="insight-panel-head"><div><small>常写主题</small><h2>关注的方向</h2></div>${icon('tag')}</div>
          <div class="insight-tag-cloud">${popular.length?popular.map(([tag,n])=>`<button data-action="insight-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span>${n}</span></button>`).join(''):'<p class="insight-helper">为手记加上标签，回顾时会更容易发现持续关注的话题。</p>'}</div>
        </section>
      </div>
    </div>
    <p class="insight-privacy">${icon('lock')} 所有统计、任务与关联均从此设备上的本地手记计算，不调用云端 AI，也不会上传你的正文。</p>
  </div>`;
}
