/**
 * Client «API» — mimics the future Rezar backend (brief §2: the browser only ever talks to Rezar's own API).
 * Today it reads static JSON from public/data (scripts/gen-data.mjs); later every function keeps its signature and
 * becomes a fetch to the real endpoint, so page code does not change.
 *
 *   await api.query(filters, { cursor, limit })  → { items, nextCursor, total }       catalog page (24 per page)
 *   await api.getCar(id)                         → car (card fields + details) | null  car page
 *   await api.similar(id, { cursor, limit })     → { items, nextCursor, total }       «Схожі автомобілі» (12 per page)
 *   await api.facets(filters)                    → { sections, makes, models, ranges } filter UI counts
 *   await api.meta()                             → { lastSyncAt, stale, total, counts, makes, ranges, scenes, … }
 *   await api.byIds(ids)                         → cars in the given order (favourites)
 *   api.now()                                    → Date: the clock everything is computed against
 *
 * Filters (all optional; DEFAULT_FILTERS shows the defaults):
 *   make, model                       exact names (model only together with make)
 *   yearFrom, yearTo                  inclusive
 *   priceFrom, priceTo                USD, final price (apiPrice + 500); cars without a price drop out when set
 *   mileageFrom, mileageTo            km; cars without mileage drop out when set
 *   section  'all' (default: in_stock + in_transit, sold hidden) | 'new' | 'in_stock' | 'in_transit' | 'sold'
 *            'new' = first published by Rezar within the last 14 calendar days (Europe/Kyiv), not sold (brief §5)
 *   sort     'date_desc' (default) | 'date_asc' | 'price_asc' | 'price_desc'; ties → id ascending (stable);
 *            cars without a price go last in both price sorts
 *   ids      number[]: restrict to these ids (favourites view)
 * Pagination is keyset-based: `nextCursor` encodes the last item's sort key, so pages never duplicate or skip even
 * if the list changes between requests.
 *
 * Demo clock: data is generated around a fixed anchor (meta.anchor) and re-based at load time by whole sync slots
 * (08:00 / 20:00 Kyiv) onto the real clock, so «N годин тому», «Нові надходження» and «оновлено о 08:00» always look
 * fresh. URL overrides for testing: ?now=2026-10-29T12:00:00Z (fixed clock), ?rebase=0 (raw dates),
 * ?sync=stale (simulate a supplier-API outage: last sync 36 h ago, the site keeps working; ?sync=ok resets).
 */
import { BASE } from './env.js';
import { kyivDaysBetween, latestSyncSlot } from './kyiv.js';
import { rankSimilar, pageSimilar, SIMILAR_PAGE, encodeCursor, decodeCursor } from './similar.js';

export const PAGE_SIZE = 24;
export const NEW_DAYS = 14;
export const SECTIONS_ALL = ['all', 'new', 'in_stock', 'in_transit', 'sold'];
export const SORTS_ALL = ['date_desc', 'date_asc', 'price_asc', 'price_desc'];
export const DEFAULT_FILTERS = Object.freeze({
  make: '',
  model: '',
  yearFrom: null,
  yearTo: null,
  priceFrom: null,
  priceTo: null,
  mileageFrom: null,
  mileageTo: null,
  section: 'all',
  sort: 'date_desc',
  ids: null,
});

/* ------------------------------------------------------------------ pure core (also used by scripts/check-logic) */

/** @returns {object} filters with defaults applied and values coerced */
export function normalizeFilters(f = {}) {
  const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const out = { ...DEFAULT_FILTERS, ...f };
  out.make = out.make ? String(out.make) : '';
  out.model = out.make && out.model ? String(out.model) : '';
  for (const k of ['yearFrom', 'yearTo', 'priceFrom', 'priceTo', 'mileageFrom', 'mileageTo']) out[k] = num(out[k]);
  if (!SECTIONS_ALL.includes(out.section)) out.section = 'all';
  if (!SORTS_ALL.includes(out.sort)) out.sort = 'date_desc';
  out.ids = Array.isArray(out.ids) ? out.ids.map(Number) : null;
  return out;
}

/** «Нові надходження» (brief §5): published within the last 14 Kyiv calendar days (today counts as day 1) */
export function isNew(car, now) {
  if (car.status === 'sold') return false;
  const d = kyivDaysBetween(car.publishedAt, now);
  return d >= 0 && d < NEW_DAYS;
}

/** section predicate */
export function inSection(car, section, now) {
  switch (section) {
    case 'new':
      return isNew(car, now);
    case 'in_stock':
    case 'in_transit':
    case 'sold':
      return car.status === section;
    default:
      return car.status === 'in_stock' || car.status === 'in_transit';
  }
}

/**
 * @param {object[]} cars @param {object} filters normalized @param {Date} now
 * @param {{skip?: string}} [o] skip one filter key (facet counts)
 */
export function matches(car, f, now, { skip } = {}) {
  if (skip !== 'section' && !inSection(car, f.section, now)) return false;
  if (skip !== 'make' && f.make && car.make !== f.make) return false;
  if (skip !== 'make' && skip !== 'model' && f.model && car.model !== f.model) return false;
  if (f.yearFrom != null && car.year < f.yearFrom) return false;
  if (f.yearTo != null && car.year > f.yearTo) return false;
  if (f.priceFrom != null && (car.price == null || car.price < f.priceFrom)) return false;
  if (f.priceTo != null && (car.price == null || car.price > f.priceTo)) return false;
  if (f.mileageFrom != null && (car.mileage == null || car.mileage < f.mileageFrom)) return false;
  if (f.mileageTo != null && (car.mileage == null || car.mileage > f.mileageTo)) return false;
  if (f.ids && !f.ids.includes(car.id)) return false;
  return true;
}

/** sort key tuple; ascending lexicographic order of tuples == display order */
export function sortKey(car, sort) {
  const ts = car._ts ?? Date.parse(car.publishedAt);
  const noPrice = car.price == null ? 1 : 0;
  switch (sort) {
    case 'date_asc':
      return [ts, car.id];
    case 'price_asc':
      return [noPrice, car.price ?? 0, car.id];
    case 'price_desc':
      return [noPrice, -(car.price ?? 0), car.id];
    default:
      return [-ts, car.id];
  }
}
export function cmpKey(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/**
 * Filter + sort + one keyset page. Pure.
 * @param {object[]} cars @param {object} filters @param {{cursor?: string|null, limit?: number, now?: Date}} [o]
 * @returns {{items: object[], nextCursor: string|null, total: number}}
 */
export function queryCars(cars, filters, { cursor = null, limit = PAGE_SIZE, now = new Date() } = {}) {
  const f = normalizeFilters(filters);
  const list = cars.filter((c) => matches(c, f, now));
  const keyed = list.map((c) => ({ c, k: sortKey(c, f.sort) })).sort((a, b) => cmpKey(a.k, b.k));
  let start = 0;
  if (cursor) {
    let last = null;
    try {
      last = JSON.parse(decodeCursor(cursor));
    } catch {}
    if (Array.isArray(last) && last[0] === f.sort) {
      const key = last.slice(1);
      // binary search: first item whose key is strictly greater than the cursor key
      let lo = 0;
      let hi = keyed.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cmpKey(keyed[mid].k, key) <= 0) lo = mid + 1;
        else hi = mid;
      }
      start = lo;
    }
  }
  const lim = Math.max(1, Math.min(10000, Number(limit) || PAGE_SIZE));
  const page = keyed.slice(start, start + lim);
  const end = start + page.length;
  return {
    items: page.map((x) => x.c),
    nextCursor: end < keyed.length && page.length ? encodeCursor(JSON.stringify([f.sort, ...page[page.length - 1].k])) : null,
    total: keyed.length,
  };
}

/** facet counts for the filter UI: each list is counted with every OTHER filter applied */
export function facetCars(cars, filters, now = new Date()) {
  const f = normalizeFilters(filters);
  const sections = {};
  for (const s of SECTIONS_ALL) {
    const g = { ...f, section: s };
    sections[s] = cars.reduce((n, c) => n + (matches(c, g, now) ? 1 : 0), 0);
  }
  const makeMap = new Map();
  const modelMap = new Map();
  for (const c of cars) {
    if (matches(c, f, now, { skip: 'make' })) makeMap.set(c.make, (makeMap.get(c.make) ?? 0) + 1);
    if (f.make && c.make === f.make && matches(c, f, now, { skip: 'model' })) modelMap.set(c.model, (modelMap.get(c.model) ?? 0) + 1);
  }
  const inScope = cars.filter((c) => inSection(c, f.section, now));
  const rng = (k) => {
    const v = inScope.map((c) => c[k]).filter((x) => x != null);
    return v.length ? [Math.min(...v), Math.max(...v)] : null;
  };
  return {
    sections,
    makes: [...makeMap].map(([make, count]) => ({ make, count })).sort((a, b) => a.make.localeCompare(b.make)),
    models: [...modelMap].map(([model, count]) => ({ model, count })).sort((a, b) => a.model.localeCompare(b.model, 'en', { numeric: true })),
    ranges: { year: rng('year'), price: rng('price'), mileage: rng('mileage') },
  };
}

/** similar cars (brief §16) for car `src` against the whole catalogue: one page of `{car, tier, score, parts}` */
export function similarCars(cars, src, { cursor = null, limit = SIMILAR_PAGE } = {}) {
  const ranked = rankSimilar(src, cars);
  return pageSimilar(ranked, { cursor, limit });
}

/* ------------------------------------------------------------------ data loading (browser) */

const DATA = `${BASE}data/`;
let metaP = null;
let catalogP = null;
const chunkP = new Map();
let shiftMs = 0;
let fixedNow = null;
let rebase = true;
let staleDemo = false;
let firstP = null;
/** a sync is due every 12 h (08:00 / 20:00 Kyiv); older than one missed slot + margin → «stale» */
export const STALE_MS = 13 * 3600e3;

try {
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const n = q.get('now');
  if (n && !Number.isNaN(Date.parse(n))) fixedNow = Date.parse(n);
  if (q.get('rebase') === '0') rebase = false;
  // demo of brief §3/§14: the supplier API has been down for a while → the site keeps working from its own data and
  // says how old it is (persisted for the tab so it survives page changes)
  if (q.get('sync') === 'stale') sessionStorage.setItem('rezar:stale', '1');
  if (q.get('sync') === 'ok') sessionStorage.removeItem('rezar:stale');
  staleDemo = sessionStorage.getItem('rezar:stale') === '1';
} catch {}

/** the clock everything is computed against (real time, or ?now=) */
export const now = () => new Date(fixedNow ?? Date.now());

/** an inline <head> script may already have started this request (window.__rzPre[path] = fetch promise) — take it
 *  once, so the data arrives with the HTML instead of after the module graph (car + catalog pages, LCP) */
function takePrefetch(path) {
  const pre = globalThis.__rzPre;
  const p = pre && pre[path];
  if (!p) return null;
  delete pre[path];
  return p.catch(() => null);
}

async function getJSON(path) {
  const r = (await takePrefetch(path)) || (await fetch(DATA + path, { credentials: 'omit' }));
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

const shiftIso = (iso) => (iso && shiftMs ? new Date(Date.parse(iso) + shiftMs).toISOString() : iso);

function loadMeta() {
  metaP ??= getJSON('meta.json').then((m) => {
    if (rebase) shiftMs = latestSyncSlot(now().getTime()) - latestSyncSlot(Date.parse(m.anchor));
    let lastSyncAt = shiftIso(m.lastSyncAt);
    // demo outage: the last successful sync was 3 slots (36 h) ago; the catalogue itself is served as usual
    if (staleDemo) lastSyncAt = new Date(Date.parse(lastSyncAt) - 36 * 3600e3).toISOString();
    const stale = now().getTime() - Date.parse(lastSyncAt) > STALE_MS;
    return { ...m, lastSyncAt, stale, anchor: shiftIso(m.anchor) };
  });
  return metaP;
}

let catalogDone = false;
function loadCatalog() {
  catalogP ??= loadMeta()
    .then(() => getJSON('catalog.json'))
    .then((cars) => {
      catalogDone = true;
      return cars.map(shiftCar);
    });
  return catalogP;
}

/** shifted copy of a car record from the static files (publication date re-based onto the demo clock) */
const shiftCar = (c) => {
  const publishedAt = shiftIso(c.publishedAt);
  return Object.defineProperty({ ...c, publishedAt }, '_ts', { value: Date.parse(publishedAt), enumerable: false });
};

/** first page of the default view (first.json): a 24-card answer like the real paginated API, so the catalog's
 *  first row does not wait for the whole catalogue file */
function loadFirstPage() {
  firstP ??= loadMeta()
    .then(() => getJSON('first.json'))
    .then((r) => ({ total: r.total, items: r.items.map(shiftCar) }))
    .catch(() => null);
  return firstP;
}
const isDefaultView = (filters) => {
  const f = normalizeFilters(filters);
  return Object.keys(DEFAULT_FILTERS).every((k) => (k === 'ids' ? f.ids == null : f[k] === DEFAULT_FILTERS[k]));
};

function loadChunk(id, m) {
  const n = Math.floor((Number(id) - m.firstId) / m.chunkSize);
  if (!chunkP.has(n)) chunkP.set(n, getJSON(`cars/${n}.json`).catch((e) => (chunkP.delete(n), Promise.reject(e))));
  return chunkP.get(n);
}

/* ------------------------------------------------------------------ public API */

export const api = {
  now,
  PAGE_SIZE,
  SIMILAR_PAGE,

  /** @returns {Promise<object>} meta (lastSyncAt re-based) */
  meta: () => loadMeta(),

  /** @param {object} filters @param {{cursor?: string|null, limit?: number}} [o] */
  async query(filters, { cursor = null, limit = PAGE_SIZE } = {}) {
    // the default first page comes from first.json while the full file is still on its way (same result, same cursor)
    if (!cursor && limit <= PAGE_SIZE && isDefaultView(filters) && !catalogDone) {
      const fp = await loadFirstPage();
      if (fp && fp.items.length >= limit) {
        const items = fp.items.slice(0, limit);
        const last = items[items.length - 1];
        const more = fp.total > items.length;
        return { items, total: fp.total, nextCursor: more ? encodeCursor(JSON.stringify(['date_desc', ...sortKey(last, 'date_desc')])) : null };
      }
    }
    const cars = await loadCatalog();
    return queryCars(cars, filters, { cursor, limit, now: now() });
  },

  /** @param {object} filters */
  async facets(filters) {
    const cars = await loadCatalog();
    return facetCars(cars, filters, now());
  },

  /** full car: card fields + details (vin, description, equipment, gallery, origin, soldAt). Needs only meta and
   *  the car's own detail chunk — like GET /cars/:id — never the whole catalogue (car page LCP) */
  async getCar(id) {
    const n = Number(id);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    const m = await loadMeta();
    if (n < m.firstId || n >= m.firstId + m.total) return null;
    const chunk = await loadChunk(n, m);
    const d = chunk.find((x) => x.id === n);
    if (!d) return null;
    const out = shiftCar(d);
    out.isNew = isNew(out, now());
    if (d.soldAt) out.soldAt = shiftIso(d.soldAt);
    if (!out.gallery?.length && d.photo) out.gallery = [d.photo];
    return out;
  },

  /** «Схожі автомобілі» for car `id` (brief §16): only in_stock / in_transit, tiers never mixed, 12 per page */
  async similar(id, { cursor = null, limit = SIMILAR_PAGE } = {}) {
    const cars = await loadCatalog();
    const src = cars.find((c) => c.id === Number(id));
    if (!src) return { items: [], nextCursor: null, total: 0 };
    const page = similarCars(cars, src, { cursor, limit });
    return { ...page, items: page.items.map((r) => r.car), ranked: page.items };
  },

  /** cars by id, in the given order, unknown ids skipped (favourites) */
  async byIds(ids) {
    const cars = await loadCatalog();
    const map = new Map(cars.map((c) => [c.id, c]));
    return ids.map((i) => map.get(Number(i))).filter(Boolean);
  },

  /** warm the cache early (e.g. on catalog link hover) */
  prefetch: () => loadCatalog().then(() => undefined, () => undefined),
};

export default api;
