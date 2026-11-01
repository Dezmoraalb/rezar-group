/**
 * Catalog state ↔ URL + sessionStorage (brief §10: on mobile the car opens in the same tab; coming back restores
 * filters, sort, the cards already loaded and the scroll position).
 *
 *   filtersToSearch(filters)        → '?make=BMW&section=new' (defaults omitted; '' when everything is default)
 *   searchToFilters(search)         → filters object (normalized by api.normalizeFilters)
 *   saveCatalogState(state)         → sessionStorage, keyed by the current URL (path + search)
 *   loadCatalogState()              → { filters, loaded, scrollY, anchorId, ts } | null  (same URL only, ≤ 30 min old)
 *   clearCatalogState()
 *   isBackNavigation()              → true for back/forward (and bfcache) arrivals
 *
 * Typical catalog flow:
 *   const saved = isBackNavigation() ? loadCatalogState() : null;
 *   const filters = saved?.filters ?? searchToFilters(location.search);
 *   const first = await api.query(filters, { limit: Math.max(api.PAGE_SIZE, saved?.loaded ?? 0) });
 *   render(first.items); if (saved) scroll.scrollTo(saved.scrollY, { immediate: true });
 *   on every change / before leaving: saveCatalogState({ filters, loaded: cards.length, scrollY, anchorId });
 *   history.replaceState(null, '', filtersToSearch(filters) || location.pathname);
 */
import { DEFAULT_FILTERS, normalizeFilters } from './api.js';

const KEY = 'rezar:catalog';
const TTL = 30 * 60e3;
const NUM_KEYS = ['yearFrom', 'yearTo', 'priceFrom', 'priceTo', 'mileageFrom', 'mileageTo'];
/** URL param names (short, readable) */
const P = { make: 'make', model: 'model', yearFrom: 'year_from', yearTo: 'year_to', priceFrom: 'price_from', priceTo: 'price_to', mileageFrom: 'km_from', mileageTo: 'km_to', section: 'section', sort: 'sort' };

/** @param {object} filters @returns {string} */
export function filtersToSearch(filters) {
  const f = normalizeFilters(filters);
  const q = new URLSearchParams();
  for (const [k, name] of Object.entries(P)) {
    const v = f[k];
    if (v == null || v === '' || v === DEFAULT_FILTERS[k]) continue;
    q.set(name, String(v));
  }
  if (f.ids) q.set('fav', '1');
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** @param {string} search @param {{favIds?: number[]}} [o] ids for ?fav=1 */
export function searchToFilters(search, { favIds } = {}) {
  const q = new URLSearchParams(search);
  const f = {};
  for (const [k, name] of Object.entries(P)) {
    const v = q.get(name);
    if (v == null || v === '') continue;
    f[k] = NUM_KEYS.includes(k) ? Number(v) : v;
  }
  if (q.get('fav') === '1') f.ids = favIds ?? [];
  return normalizeFilters(f);
}

const urlKey = () => (typeof location === 'undefined' ? '' : location.pathname + location.search);

/** @param {{filters: object, loaded: number, scrollY: number, anchorId?: number}} state */
export function saveCatalogState(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, url: urlKey(), ts: Date.now() }));
  } catch {}
}

export function loadCatalogState() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!s || s.url !== urlKey() || Date.now() - s.ts > TTL) return null;
    return { ...s, filters: normalizeFilters(s.filters) };
  } catch {
    return null;
  }
}

export function clearCatalogState() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function isBackNavigation() {
  try {
    const nav = performance.getEntriesByType?.('navigation')[0];
    return nav?.type === 'back_forward';
  } catch {
    return false;
  }
}
