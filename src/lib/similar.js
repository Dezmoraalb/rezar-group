/**
 * Similar cars for a SOLD car page (brief §16). Pure, no DOM / no fetch.
 *
 * Candidates: status in_stock | in_transit only (never sold), never the source itself.
 * Hard cut-offs: |price − src| / src > 20 %  → out;  |year − src| > 2 → out.
 *   Prices compared = displayed Rezar prices (apiPrice + 500), i.e. car.price.
 *   Source without a price: price cut-off and price points are skipped (0 pts).
 *   Candidate without a price while the source has one: out (budget cannot be checked).
 * Tiers (never mixed; tier 1 first, then 2, then 3):
 *   1 — same make AND model
 *   2 — same make, other model, same class (classes.js)
 *   3 — other make, same class (budget = the ±20 % cut-off)
 *   anything else (e.g. same make, different class) is not a candidate.
 * Score (max 100):
 *   make/model  40 (tier 1) · 25 (tier 2) · 10 (tier 3)
 *   price       25 (0–3 %) · 20 (>3–5 %) · 15 (>5–10 %) · 10 (>10–15 %) · 0 (>15–20 %)
 *   year        25 (same) · 20 (±1) · 15 (±2)
 *   fuel        5 same · 2 related (classes.js FUEL_RELATED) · 0
 *   powertrain  5 both electric (no litres for EVs) · ICE: ENGINE_BANDS by |Δ litres| · 0 if unknown / EV vs ICE
 *   Mileage is NOT scored.
 * Order inside a tier: score ↓, price deviation ↑, year difference ↑, id ↑ (fully deterministic).
 * Pages: 12 per page (first and every next), keyset cursor → no duplicates, stable on reload.
 */
import { classOf, ENGINE_BANDS, FUEL_RELATED } from './classes.js';

export const SIMILAR_PAGE = 12;
const ACTIVE = new Set(['in_stock', 'in_transit']);

const clsOf = (c) => c.cls ?? classOf(c.make, c.model);

export function priceDeviation(src, cand) {
  if (!src.price) return null;
  if (!cand.price) return Infinity;
  return Math.abs(cand.price - src.price) / src.price;
}

export function pricePoints(dev) {
  if (dev == null) return 0;
  // compare in basis points to dodge float noise at the band edges (0.03 * 100 etc.)
  const bp = Math.round(dev * 10000);
  if (bp <= 300) return 25;
  if (bp <= 500) return 20;
  if (bp <= 1000) return 15;
  if (bp <= 1500) return 10;
  return 0;
}

export function yearPoints(diff) {
  return diff === 0 ? 25 : diff === 1 ? 20 : diff === 2 ? 15 : 0;
}

export function fuelPoints(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 5;
  return FUEL_RELATED.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) ? 2 : 0;
}

export function powertrainPoints(src, cand) {
  const evA = src.fuel === 'electric';
  const evB = cand.fuel === 'electric';
  if (evA || evB) return evA && evB ? 5 : 0;
  if (!src.engine || !cand.engine) return 0;
  const d = Math.round(Math.abs(src.engine - cand.engine) * 100) / 100;
  for (const [max, pts] of ENGINE_BANDS) if (d <= max) return pts;
  return 0;
}

/** @returns {1|2|3|0} */
export function tierOf(src, cand) {
  if (cand.make === src.make && cand.model === src.model) return 1;
  const cs = clsOf(src);
  if (!cs || clsOf(cand) !== cs) return 0;
  return cand.make === src.make ? 2 : 3;
}

const MAKE_POINTS = { 1: 40, 2: 25, 3: 10 };

/**
 * Score one candidate.
 * @returns {null | {tier:1|2|3, score:number, dev:number, yearDiff:number, parts:object}}
 */
export function scoreCandidate(src, cand) {
  if (!cand || cand.id === src.id || !ACTIVE.has(cand.status)) return null;
  const dev = priceDeviation(src, cand);
  if (dev === Infinity) return null;
  if (dev != null && Math.round(dev * 10000) > 2000) return null;
  const yearDiff = Math.abs((cand.year ?? 0) - (src.year ?? 0));
  if (yearDiff > 2) return null;
  const tier = tierOf(src, cand);
  if (!tier) return null;
  const parts = {
    make: MAKE_POINTS[tier],
    price: pricePoints(dev),
    year: yearPoints(yearDiff),
    fuel: fuelPoints(src.fuel, cand.fuel),
    powertrain: powertrainPoints(src, cand),
  };
  const score = parts.make + parts.price + parts.year + parts.fuel + parts.powertrain;
  return { tier, score, dev: dev ?? 0, yearDiff, parts };
}

/** sort tuple; lexicographic ascending == display order */
const tupleOf = (r) => [r.tier, -r.score, Math.round(r.dev * 10000), r.yearDiff, r.car.id];
function cmpTuple(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/**
 * Rank every candidate for `src`.
 * @param {object} src  the (sold) source car
 * @param {object[]} cars  the whole catalogue (any statuses; filtered here)
 * @returns {{car:object, tier:number, score:number, dev:number, yearDiff:number, parts:object}[]}
 */
export function rankSimilar(src, cars) {
  const out = [];
  for (const car of cars) {
    const r = scoreCandidate(src, car);
    if (r) out.push({ car, ...r });
  }
  return out.sort((a, b) => cmpTuple(tupleOf(a), tupleOf(b)));
}

const enc = (t) => btoaSafe(JSON.stringify(t));
const dec = (s) => {
  try {
    return JSON.parse(atobSafe(s));
  } catch {
    return null;
  }
};

/**
 * One page of a ranked list. The cursor encodes the last item's sort tuple, so the next page
 * starts strictly after it even if the list changed in between (sold / repriced cars).
 * @returns {{items: object[], nextCursor: string|null, total: number}}
 */
export function pageSimilar(ranked, { cursor = null, limit = SIMILAR_PAGE } = {}) {
  let start = 0;
  if (cursor) {
    const last = dec(cursor);
    if (Array.isArray(last)) {
      start = ranked.findIndex((r) => cmpTuple(tupleOf(r), last) > 0);
      if (start < 0) start = ranked.length;
    }
  }
  const slice = ranked.slice(start, start + limit);
  const end = start + slice.length;
  return {
    items: slice,
    nextCursor: end < ranked.length && slice.length ? enc(tupleOf(slice[slice.length - 1])) : null,
    total: ranked.length,
  };
}

/* base64url that works in browsers and Node, UTF-8 safe */
function btoaSafe(s) {
  const b = typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(s)));
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function atobSafe(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return typeof Buffer !== 'undefined' ? Buffer.from(b, 'base64').toString('utf8') : decodeURIComponent(escape(atob(b)));
}
export { btoaSafe as encodeCursor, atobSafe as decodeCursor };
