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
export const excerpt = value => String(value ?? '')
  .replace(/```[\s\S]*?```/g,'').replace(/[#*`_>~\[\]\(\)]/g,'')
  .replace(/\s+/g,' ').trim().slice(0,88) || '留白，也是一天的注脚。';
