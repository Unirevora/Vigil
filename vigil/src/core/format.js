// Safe, dependency-free formatting helpers.
export const todayISO = (value = new Date()) =>
  `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;

export const dayOffset = n => {
  const d = new Date();
  d.setDate(d.getDate()-n);
  return todayISO(d);
};

export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.valueOf()) && todayISO(d) === s;
}
export const toDate = s => isValidDate(s) ? new Date(`${s}T12:00:00`) : new Date();
export const humanDate = s => new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'}).format(toDate(s));
export const dateParts = s => {
  const d = toDate(s);
  return {day:String(d.getDate()).padStart(2,'0'),month:`${d.getMonth()+1}月`};
};
export const escapeHtml = input => String(input ?? '').replace(/[&<>"']/g, ch =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])
);
export const uuid = () => globalThis.crypto?.randomUUID?.() ||
  `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const charCount = value => Array.from(String(value ?? '').replace(/\s/g,'')).length;
export const excerpt = (value, max = 88) => String(value ?? '')
  .replace(/```[\s\S]*?```/g,'').replace(/[#*`_>~\[\]\(\)]/g,'')
  .replace(/\s+/g,' ').trim().slice(0,max) || '留白，也是一天的注脚。';

const SEASONAL_MONTHS = ['','季冬','孟春','仲春','季春','孟夏','仲夏','季夏','孟秋','仲秋','季秋','孟冬','仲冬'];

/** Format YYYY-MM into an editorial anthology divider heading with traditional seasonal alias. */
export function editorialMonthLabel(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym ?? ''));
  if (!m) return String(ym ?? '');
  const month = Number(m[2]);
  const alias = SEASONAL_MONTHS[month] || '';
  return `${m[1]} 年 ${month} 月${alias ? ` · ${alias}` : ''}`;
}

/** True when a note is a short aphorism/jotting suitable for full serif quote display on cards. */
export function isBriefNote(content) {
  const raw = String(content ?? '');
  if (/```|~~~|\$\$|\\\[|^\|.+\|/m.test(raw)) return false;
  const count = charCount(raw.replace(/[#*`_>~\[\]\(\)]/g, ''));
  return count > 0 && count <= 68;
}
