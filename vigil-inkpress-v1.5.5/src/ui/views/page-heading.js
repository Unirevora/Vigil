import {escapeHtml} from '../../core/format.js';

/** One consistent heading for app-level destinations. Home has an editorial hero,
 * while readers and writers use the title of their document instead.
 * `actions` is trusted markup authored by a view (never external/user input).
 */
export function pageHeading({title,description='',actions='',count=null,className=''}){
  const number=Number.isInteger(count)&&count>=0
    ?` <span id="pageTitleCount" class="page-title-count" aria-label="${count} 篇手记">${count}</span>`:'';
  return `<header class="page-head page-titlebar ${className}">
    <div class="page-title-copy"><h1 class="page-title">${escapeHtml(title)}${number}</h1>
      ${description?`<p class="page-subtitle">${escapeHtml(description)}</p>`:''}</div>
    ${actions?`<div class="page-title-actions">${actions}</div>`:''}
  </header>`;
}
