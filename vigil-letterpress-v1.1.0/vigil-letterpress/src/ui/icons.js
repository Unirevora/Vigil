// Small inline SVG icon set; no external asset or library required.
const svgPaths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  list: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  pen: '<path d="m12 19 7-7 3 3-7 7-5 1z"/><path d="M18 13l2-2a2 2 0 0 0-3-3l-2 2M4 6h8M4 11h5M4 16h4"/>',
  archive: '<rect x="3" y="5" width="18" height="5" rx="1"/><path d="M5 10v10h14V10M10 14h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/>',
  book: '<path d="M12 6c-4-3-8-2-10-1v14c3-1 7-1 10 1 3-2 7-2 10-1V5c-2-1-6-2-10 1zM12 6v14"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  save: '<path d="M5 3h12l4 4v14H3V3zM7 3v7h10V3M7 21v-8h10v8"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
  edit: '<path d="m15 5 4 4M4 20l5-.8L20 8a2.8 2.8 0 0 0-4-4L5 15z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
  lock: '<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  close: '<path d="M5 5 19 19M19 5 5 19"/>',
  alert: '<path d="M12 3 2 21h20zM12 9v5m0 3v.3"/>'
};
export function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgPaths[name] || svgPaths.info}</svg>`;
}
