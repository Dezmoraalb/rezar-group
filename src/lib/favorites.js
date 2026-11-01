/**
 * Favourites (brief §8 «избранное»; behaviour to be agreed — open question §15). localStorage, per browser.
 *   favorites.has(id) · favorites.toggle(id) → boolean (new state) · favorites.list() → number[] (newest first)
 *   favorites.count() · favorites.onChange(fn) → unsubscribe (also fires on changes from other tabs)
 * Every [data-fav-count] element shows the count (hidden at 0); call favorites.syncBadges() after rendering.
 */
const KEY = 'rezar:fav';
const listeners = new Set();

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}
function write(ids) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
}
function emit() {
  const ids = read();
  listeners.forEach((fn) => fn(ids));
  syncBadges();
}
function syncBadges() {
  const n = read().length;
  document.querySelectorAll('[data-fav-count]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
}

export const favorites = {
  /** @param {number|string} id */
  has: (id) => read().includes(Number(id)),
  /** @param {number|string} id @returns {boolean} new state */
  toggle(id) {
    const n = Number(id);
    const ids = read();
    const i = ids.indexOf(n);
    if (i >= 0) ids.splice(i, 1);
    else ids.unshift(n);
    write(ids);
    emit();
    return i < 0;
  },
  list: () => read(),
  count: () => read().length,
  /** @param {(ids: number[]) => void} fn */
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  syncBadges,
};

if (typeof window !== 'undefined') {
  addEventListener('storage', (e) => {
    if (e.key === KEY) emit();
  });
}
