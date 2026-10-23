// Line icons (24×24, stroke = currentColor) for categories and the interface.
export const ICONS = {
  auto: '<path d="M3 17v-4l2.2-5.2A2 2 0 0 1 7 6.6h10a2 2 0 0 1 1.8 1.2L21 13v4"/><path d="M3 13h18M3 17h2.5M18.5 17H21M9.5 17h5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  moto: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="m5.5 16.5 4-6.5h5l4 6.5M13 6h3l-1.5 4M9.5 10 12 16.5h6.5"/>',
  reality: '<path d="m3 11 9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  nabytok:
    '<path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z"/><path d="M5 18v2M19 18v2"/>',
  dom: '<path d="M12 21V11"/><path d="M12 13C6 13 4 9 4 5c5 0 8 3 8 8Z"/><path d="M12 11c0-5 3-7 8-7 0 4-3 7-8 7Z"/><path d="M7 21h10"/>',
  elektro: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  pc: '<rect x="5" y="4" width="14" height="10" rx="1.5"/><path d="M2.5 18h19l-1.5-4h-16z"/>',
  mobily: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
  foto: '<path d="M4 7h3l2-2.5h6L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
  deti: '<path d="M14 4h5l2 4v5H4V8h9V4zM4 13l3 4h12l2-4"/><circle cx="8" cy="20" r="1.8"/><circle cx="18" cy="20" r="1.8"/>',
  oblecenie: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>',
  sport:
    '<circle cx="12" cy="12" r="9"/><path d="m12 7 4.5 3.3-1.7 5.2H9.2l-1.7-5.2zM12 3v4M3.5 9.5l4 .8M20.5 9.5l-4 .8M6.5 19.5l2.7-4M17.5 19.5l-2.7-4"/>',
  hudba: '<path d="M9 17V5l12-2.5v12M9 8.5l12-2.5"/><circle cx="6" cy="17.5" r="3"/><circle cx="18" cy="14.5" r="3"/>',
  knihy:
    '<path d="M12 5.5C8.5 3 5 3.5 2.5 4.5v15c3-1.5 6.5-1 9.5 1 3-2 6.5-2.5 9.5-1v-15c-2.5-1-6-1.5-9.5 1ZM12 5.5v15"/>',
  zvierata:
    '<path d="M7 17.5c0-3 2.2-6 5-6s5 3 5 6c0 2-2 3-5 2-3 1-5 0-5-2Z"/><ellipse cx="5" cy="10.5" rx="1.8" ry="2.6"/><ellipse cx="19" cy="10.5" rx="1.8" ry="2.6"/><ellipse cx="9" cy="5.5" rx="1.8" ry="2.6"/><ellipse cx="15" cy="5.5" rx="1.8" ry="2.6"/>',
  stroje:
    '<path d="M3 17h11v-5H8l-2 3H3zM14 10h3l3 4v3h-6"/><circle cx="6.5" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M8 12V7h4v5"/>',
  vstupenky: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14.5 7v2M14.5 11v2M14.5 15v2"/>',
  sluzby: '<path d="m14.5 5.5 4 4M4 20l7.5-7.5M13 4l7 7-2 2-7-7zM9.5 14.5 4 20"/>',
  ostatne: '<path d="m12 2.5 8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z"/><path d="M3.5 7.25 12 12l8.5-4.75M12 12v9.5"/>',
  all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  heart:
    '<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.2 4.4 6.6C19.5 15.4 12 20 12 20Z"/>',
  chat: '<path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z"/><path d="M8 8h8M8 12h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  home: '<path d="m3 11 9-7 9 7"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone: '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>',
  share:
    '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  camera:
    '<path d="M4 7h3l2-2.5h6L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};
export const icon = (name, cls = "icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.ostatne}</svg>`;
// Brand mark: a price tag.
export const LOGO_MARK =
  '<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 15.2V5a2 2 0 0 1 2-2h10.2a2 2 0 0 1 1.4.6l12.8 12.8a2 2 0 0 1 0 2.8L19.2 29.4a2 2 0 0 1-2.8 0L3.6 16.6a2 2 0 0 1-.6-1.4Z" fill="#FFD43B" stroke="#121417" stroke-width="2.2" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.6" fill="#121417"/></svg>';
