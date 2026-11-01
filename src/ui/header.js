/**
 * Header (port of VELAR ui/header.ts): solid panel + shadow after 8px of scroll (data-scrolled), hides while scrolling
 * down after 160px and returns on the way up (data-hidden); never while the menu is open or keyboard focus is inside.
 * Marks the current nav item (aria-current) from <body data-page> + the URL (?section=new|sold…).
 */
export function initHeader() {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;
  markCurrent();
  let frame = 0;
  let lastY = scrollY;
  const update = () => {
    frame = 0;
    const y = scrollY;
    header.toggleAttribute('data-scrolled', y > 8);
    const a = document.activeElement;
    const kb = !!a && header.contains(a) && a.matches(':focus-visible');
    const busy = kb || document.documentElement.hasAttribute('data-menu-open') || document.documentElement.hasAttribute('data-sheet-open');
    if (y < 160 || busy || y < lastY - 6) header.removeAttribute('data-hidden');
    else if (y > lastY + 6) header.setAttribute('data-hidden', '');
    if (Math.abs(y - lastY) > 6) lastY = y;
  };
  header.addEventListener('focusin', (e) => {
    if (e.target?.matches?.(':focus-visible')) header.removeAttribute('data-hidden');
  });
  update();
  addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
}

/** aria-current on header + menu links: catalog page → «Каталог» (or the section link that matches ?section=) */
export function markCurrent() {
  const page = document.body.dataset.page;
  let key = '';
  if (page === 'catalog') {
    const s = new URLSearchParams(location.search).get('section');
    key = s === 'new' || s === 'sold' || s === 'in_transit' ? s : 'catalog';
  }
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (key && a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
