#!/usr/bin/env node
/**
 * Logic checks (node, no test framework):  npm run check
 *   relTime   brief §9 incl. the brief's own example (now 29.10.2026: 25.10 → «4 дні тому», 21.10 → «21.10.2026»)
 *   similar   brief §16 three-tier scoring on hand-made cases + invariants over the whole generated dataset
 *   api       sections / «Нові надходження» / sorts / keyset pages of 24 without dupes or gaps / price = api + 500
 *   format    «$ 24 500», «86 000 км»
 *   state     URL ↔ filters round trip
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { relTime } from '../src/lib/relTime.js';
import { kyivWallToUtc, latestSyncSlot } from '../src/lib/kyiv.js';
import { rankSimilar, pageSimilar, scoreCandidate, pricePoints, SIMILAR_PAGE } from '../src/lib/similar.js';
import { queryCars, facetCars, isNew, normalizeFilters, similarCars } from '../src/lib/api.js';
import { formatPrice, formatMileage, normalizeSpaces } from '../src/lib/format.js';
import { filtersToSearch, searchToFilters } from '../src/lib/state.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
let fail = 0;
const fails = [];
function eq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else {
    fail++;
    fails.push(`✗ ${name}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
  }
}
const ok = (cond, name) => eq(!!cond, true, name);
const K = (y, m, d, h = 12, min = 0) => new Date(kyivWallToUtc(y, m, d, h, min)); // Kyiv wall clock → Date

/* ================================================================ relTime (§9) */
{
  const now = K(2026, 10, 29, 12, 0);
  eq(relTime(K(2026, 10, 25, 10), now), '4 дні тому', 'brief example: 29.10 vs 25.10 → «4 дні тому»');
  eq(relTime(K(2026, 10, 21, 10), now), '21.10.2026', 'brief example: 29.10 vs 21.10 → «21.10.2026»');
  eq(relTime(K(2026, 10, 29, 10), now), '2 години тому', '2 h → «2 години тому»');
  eq(relTime(K(2026, 10, 29, 11), now), '1 годину тому', '1 h → «1 годину тому»');
  eq(relTime(K(2026, 10, 29, 7), now), '5 годин тому', '5 h → «5 годин тому»');
  eq(relTime(K(2026, 10, 29, 11, 40), now), 'менше години тому', '20 min → «менше години тому»');
  eq(relTime(K(2026, 10, 28, 15), now), '21 годину тому', '21 h → «21 годину тому» (uk plural: 21 → one)');
  eq(relTime(K(2026, 10, 28, 14), now), '22 години тому', '22 h → «22 години тому»');
  eq(relTime(K(2026, 10, 29, 1), now), '11 годин тому', '11 h → «11 годин тому»');
  eq(relTime(K(2026, 10, 28, 8), now), 'Вчора', 'yesterday, 28 h ago → «Вчора»');
  eq(relTime(K(2026, 10, 28, 23), K(2026, 10, 29, 2)), '3 години тому', 'under 24 h wins over «Вчора»');
  eq(relTime(K(2026, 10, 27, 23, 59), K(2026, 10, 29, 0, 1)), '2 дні тому', 'calendar days, not 24 h blocks');
  eq(relTime(K(2026, 10, 24, 9), now), '5 днів тому', '5 days → «5 днів тому»');
  eq(relTime(K(2026, 10, 23, 9), now), '6 днів тому', '6 days → «6 днів тому»');
  eq(relTime(K(2026, 10, 22, 23, 50), now), '22.10.2026', '7th day → exact date');
  eq(relTime(K(2026, 10, 26, 0, 30), K(2026, 10, 28, 0, 10)), '2 дні тому', 'across the DST change (25.10)');
  eq(relTime(K(2026, 10, 25, 2, 30), K(2026, 10, 25, 23)), '21 годину тому', 'hours across the DST night (25.10 is 25 h long)');
  eq(relTime('2026-09-01T09:00:00Z', now), '01.09.2026', 'ISO input → DD.MM.YYYY in Kyiv');
  eq(relTime(K(2026, 10, 1, 0, 30), K(2026, 10, 30)), '01.10.2026', 'date uses the Kyiv calendar (00:30 Kyiv = previous UTC day)');
  // sync slots (§19)
  eq(new Date(latestSyncSlot(K(2026, 11, 1, 14).getTime())).toISOString(), K(2026, 11, 1, 8).toISOString(), 'latest sync slot 14:00 → 08:00');
  eq(new Date(latestSyncSlot(K(2026, 11, 1, 7).getTime())).toISOString(), K(2026, 10, 31, 20).toISOString(), 'latest sync slot 07:00 → 20:00 yesterday');
}

/* ================================================================ similar (§16) — hand-made cases */
{
  let id = 1;
  const car = (o) => ({ id: id++, status: 'in_stock', fuel: 'petrol', engine: 2.0, year: 2020, price: 30000, ...o, cls: o.cls });
  const src = car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', status: 'sold' });
  const A = car({ make: 'BMW', model: '3 Series', cls: 'premium_compact' }); //               t1 40+25+25+5+5 = 100
  const B = car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', price: 31200, year: 2021, status: 'in_transit' }); // t1 40+20(4%)+20+5+5 = 90
  const C = car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', price: 34200, year: 2018, fuel: 'diesel' }); // t1 40+10(14%)+15+0+5 = 70
  const D = car({ make: 'BMW', model: '4 Series', cls: 'premium_compact', engine: 3.0 }); //   t2 25+25+25+5+1 (Δ1.0 l) = 81
  const E = car({ make: 'BMW', model: 'i4', cls: 'premium_compact', fuel: 'electric', engine: undefined, price: 32400 }); // t2 25+15(8%)+25+0+0 = 65
  const F = car({ make: 'Audi', model: 'A4', cls: 'premium_compact', price: 29500 }); //       t3 10+25(1.7%)+25+5+5 = 70
  const G = car({ make: 'Mercedes-Benz', model: 'C-Class', cls: 'premium_compact', fuel: 'hybrid', price: 35500 }); // t3 10+0(18%)+25+2+5 = 42
  const X1 = car({ make: 'BMW', model: 'X5', cls: 'premium_suv_large' }); //                   same make, other class → out
  const X2 = car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', status: 'sold' }); // sold → out
  const X3 = car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', price: 36100 }); //  +20.3 % → out
  const X4 = car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', year: 2017 }); //   3 years → out
  const X5 = car({ make: 'Toyota', model: 'Camry', cls: 'midsize' }); //                       other class → out
  const X6 = car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', price: undefined }); // no price → out
  const all = [src, A, B, C, D, E, F, G, X1, X2, X3, X4, X5, X6];
  const ranked = rankSimilar(src, all);
  eq(ranked.map((r) => r.car.id), [A.id, B.id, C.id, D.id, E.id, F.id, G.id], 'order: tier 1 → 2 → 3, score desc inside a tier');
  eq(ranked.map((r) => r.score), [100, 90, 70, 81, 65, 70, 42], 'scores (make/model + price + year + fuel + powertrain)');
  eq(ranked.map((r) => r.tier), [1, 1, 1, 2, 2, 3, 3], 'tiers never mixed');
  ok(ranked.every((r) => r.car.status !== 'sold'), 'no sold cars in similar');
  eq([pricePoints(0.03), pricePoints(0.0301), pricePoints(0.05), pricePoints(0.1), pricePoints(0.15), pricePoints(0.16)], [25, 20, 20, 15, 10, 0], 'price bands 0–3 / >3–5 / >5–10 / >10–15 / >15');
  eq(scoreCandidate(src, car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', price: 36000 }))?.parts.price, 0, '+20.0 % kept (0 price points)');
  // EV source: no engine volume, 5 for both electric
  const evSrc = car({ make: 'Tesla', model: 'Model 3', cls: 'premium_compact', fuel: 'electric', engine: undefined, status: 'sold' });
  const evA = car({ make: 'BMW', model: 'i4', cls: 'premium_compact', fuel: 'electric', engine: undefined });
  const evB = car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', fuel: 'petrol', engine: 2.0 });
  const evR = rankSimilar(evSrc, [evSrc, evA, evB]);
  eq(evR.map((r) => [r.car.id, r.parts.fuel, r.parts.powertrain]), [[evA.id, 5, 5], [evB.id, 0, 0]], 'EV: powertrain by type only, never litres');
  // pages of 12 with a cursor
  const many = Array.from({ length: 30 }, (_, i) => car({ make: 'BMW', model: '3 Series', cls: 'premium_compact', price: 30000 + i * 50 }));
  const r2 = rankSimilar(src, [src, ...many]);
  const p1 = pageSimilar(r2);
  const p2 = pageSimilar(r2, { cursor: p1.nextCursor });
  const p3 = pageSimilar(r2, { cursor: p2.nextCursor });
  eq([p1.items.length, p2.items.length, p3.items.length, p3.nextCursor], [12, 12, 6, null], 'pages 12 + 12 + 6, then no cursor');
  eq(new Set([...p1.items, ...p2.items, ...p3.items].map((r) => r.car.id)).size, 30, 'no duplicates across pages');
  eq(rankSimilar(src, [src, X1, X5]).length, 0, 'no candidates → empty (block hidden)');
}

/* ================================================================ dataset-wide invariants */
const cars = JSON.parse(readFileSync(resolve(ROOT, 'public/data/catalog.json'), 'utf8'));
const meta = JSON.parse(readFileSync(resolve(ROOT, 'public/data/meta.json'), 'utf8'));
const NOW = new Date(meta.anchor);
{
  ok(cars.length >= 1000, `dataset has 1000+ cars (${cars.length})`);
  // the «database» side (mock-db/internal.json, never deployed) keeps the supplier price and the markup apart (§6)
  const internal = new Map(JSON.parse(readFileSync(resolve(ROOT, 'mock-db/internal.json'), 'utf8')).map((r) => [r.id, r]));
  ok(cars.every((c) => c.price == null || (internal.get(c.id)?.apiPrice + internal.get(c.id)?.markup === c.price && internal.get(c.id)?.markup === 500)), 'price = apiPrice + 500 for every car');
  ok(cars.every((c) => !('apiPrice' in c) && !('markup' in c)), 'public catalog carries only the final price (no apiPrice / markup)');
  ok(!('markupUsd' in meta), 'meta does not reveal the markup');
  ok(cars.some((c) => c.price == null) && cars.some((c) => c.mileage == null) && cars.some((c) => c.fuel == null), 'some fields intentionally missing');
  ok(new Set(cars.map((c) => c.id)).size === cars.length, 'ids unique');
  const details = readdirSync(resolve(ROOT, 'public/data/cars')).flatMap((f) => JSON.parse(readFileSync(resolve(ROOT, 'public/data/cars', f), 'utf8')));
  eq(details.length, cars.length, 'every car has a detail record');
  ok([...internal.values()].some((d) => d.tags?.includes('previously_sold') && d.history?.length === 3), 'relisted cars keep history (internal)');
  ok(details.every((d) => !('tags' in d) && !('history' in d) && !('apiPrice' in d)), 'public detail chunks carry no internal tag / history / supplier price');
  const byId = new Map(cars.map((c) => [c.id, c]));
  ok(details.every((d) => Object.entries(byId.get(d.id)).every(([k, v]) => JSON.stringify(d[k]) === JSON.stringify(v))), 'detail chunks repeat the card fields (car page renders without catalog.json)');
  const first = JSON.parse(readFileSync(resolve(ROOT, 'public/data/first.json'), 'utf8'));
  const q0 = queryCars(cars, {}, { limit: 24, now: NOW });
  eq([first.items.map((c) => c.id), first.total], [q0.items.map((c) => c.id), q0.total], 'first.json = first page of the default view');

  // similar for every sold car
  let checked = 0;
  let bad = '';
  for (const src of cars.filter((c) => c.status === 'sold')) {
    const ranked = rankSimilar(src, cars);
    let lastTier = 0;
    let lastScore = Infinity;
    for (const r of ranked) {
      if (r.car.status === 'sold') bad ||= `sold in similar for ${src.id}`;
      if (r.tier < lastTier) bad ||= `tier order broken for ${src.id}`;
      if (r.tier > lastTier) lastScore = Infinity;
      if (r.score > lastScore) bad ||= `score order broken for ${src.id}`;
      if (src.price && Math.abs(r.car.price - src.price) / src.price > 0.2 + 1e-9) bad ||= `price cut-off broken for ${src.id}`;
      if (Math.abs(r.car.year - src.year) > 2) bad ||= `year cut-off broken for ${src.id}`;
      lastTier = r.tier;
      lastScore = r.score;
    }
    // page through and compare with the full ranking
    const seen = [];
    let cursor = null;
    do {
      const p = similarCars(cars, src, { cursor });
      if (p.items.length > SIMILAR_PAGE) bad ||= `page > 12 for ${src.id}`;
      seen.push(...p.items.map((r) => r.car.id));
      cursor = p.nextCursor;
    } while (cursor);
    if (JSON.stringify(seen) !== JSON.stringify(ranked.map((r) => r.car.id))) bad ||= `paging differs from ranking for ${src.id}`;
    checked++;
  }
  eq(bad, '', `similar invariants over ${checked} sold cars`);
}

/* ================================================================ api (§5, §7, §10) */
{
  const f0 = normalizeFilters({});
  const all = queryCars(cars, f0, { limit: 5000, now: NOW });
  ok(all.total === cars.filter((c) => c.status !== 'sold').length, 'default = in_stock + in_transit (sold hidden)');
  const sold = queryCars(cars, { section: 'sold' }, { limit: 5000, now: NOW });
  ok(sold.total > 0 && sold.items.every((c) => c.status === 'sold'), 'section «Продано» shows only sold');
  const fresh = queryCars(cars, { section: 'new' }, { limit: 5000, now: NOW });
  ok(fresh.total > 0 && fresh.items.every((c) => c.status !== 'sold' && (NOW - new Date(c.publishedAt)) < 15 * 86400e3), '«Нові надходження» = ≤14 calendar days, not sold');
  ok(!isNew({ status: 'in_stock', publishedAt: K(2026, 10, 18, 20).toISOString() }, K(2026, 11, 1, 14)), '14 days back (18.10 on 01.11) is not new');
  ok(isNew({ status: 'in_stock', publishedAt: K(2026, 10, 19, 8).toISOString() }, K(2026, 11, 1, 14)), '13 days back (19.10 on 01.11) is new');

  for (const sort of ['date_desc', 'date_asc', 'price_asc', 'price_desc']) {
    for (const filters of [{ sort }, { sort, section: 'sold' }, { sort, make: 'BMW' }, { sort, priceFrom: 20000, priceTo: 40000, yearFrom: 2019 }]) {
      const ids = [];
      let cursor = null;
      let pages = 0;
      let total = 0;
      do {
        const p = queryCars(cars, filters, { cursor, now: NOW });
        if (p.items.length > 24) throw new Error('page > 24');
        ids.push(...p.items.map((c) => c.id));
        cursor = p.nextCursor;
        total = p.total;
        pages++;
      } while (cursor && pages < 200);
      const label = `${sort} ${JSON.stringify(filters)}`;
      eq([ids.length, new Set(ids).size], [total, total], `pages of 24 cover all, no dupes: ${label}`);
      const full = queryCars(cars, filters, { limit: 5000, now: NOW }).items.map((c) => c.id);
      eq(ids, full.slice(0, ids.length), `paged order == one-shot order: ${label}`);
    }
  }
  const asc = queryCars(cars, { sort: 'price_asc', section: 'all' }, { limit: 5000, now: NOW }).items;
  const firstNoPrice = asc.findIndex((c) => c.price == null);
  ok(firstNoPrice === -1 || asc.slice(firstNoPrice).every((c) => c.price == null), 'cars without price go last (price asc)');
  ok(asc.every((c, i) => i === 0 || c.price == null || asc[i - 1].price <= c.price), 'price asc is monotonic');
  const desc = queryCars(cars, {}, { limit: 5000, now: NOW }).items;
  ok(desc.every((c, i) => i === 0 || desc[i - 1].publishedAt > c.publishedAt || (desc[i - 1].publishedAt === c.publishedAt && desc[i - 1].id < c.id)), 'date desc with id tiebreak');
  const bmw = queryCars(cars, { make: 'BMW', model: 'X5', yearFrom: 2019, yearTo: 2022, mileageTo: 80000 }, { limit: 5000, now: NOW }).items;
  ok(bmw.every((c) => c.make === 'BMW' && c.model === 'X5' && c.year >= 2019 && c.year <= 2022 && c.mileage != null && c.mileage <= 80000), 'make/model/year/mileage filters');
  const fc = facetCars(cars, { make: 'BMW' }, NOW);
  ok(fc.makes.length > 10 && fc.models.length > 3 && fc.sections.sold > 0, 'facets: makes ignore the make filter, models follow it');
  // a stale / foreign cursor never breaks the page
  eq(queryCars(cars, { sort: 'price_asc' }, { cursor: 'garbage', now: NOW }).items.length, 24, 'bad cursor → first page');
}

/* ================================================================ format + state */
{
  eq(normalizeSpaces(formatPrice(24500)), '$ 24 500', 'formatPrice(24500) → «$ 24 500»');
  eq(normalizeSpaces(formatMileage(86000)), '86 000 км', 'formatMileage(86000) → «86 000 км»');
  eq(formatPrice(undefined), '', 'no price → empty string (field hidden)');
  const f = { make: 'BMW', model: 'X5', yearFrom: 2019, priceTo: 50000, section: 'new', sort: 'price_asc' };
  const s = filtersToSearch(f);
  eq(s, '?make=BMW&model=X5&year_from=2019&price_to=50000&section=new&sort=price_asc', 'filters → URL');
  eq(searchToFilters(s), normalizeFilters(f), 'URL → filters round trip');
  eq(filtersToSearch({}), '', 'defaults → empty query');
}

/* ================================================================ inline head preloads stay in sync with the modules */
{
  const { photoUrl } = await import('../src/lib/photo.js');
  const src = (f) => readFileSync(resolve(ROOT, f), 'utf8');
  const constOf = (f, name) => src(f).match(new RegExp(`${name}\\s*=\\s*\\n?\\s*'([^']+)'`))?.[1];
  for (const html of ['catalog/index.html', 'car/index.html']) {
    const m = src(html).match(/var U = (function \(id, w, h\) \{[^}]+\});/);
    const U = m && new Function(`return ${m[1]}`)();
    eq(U && U('1555215695-3004980ad54e', 640, 480), photoUrl('1555215695-3004980ad54e', { w: 640, h: 480 }), `${html}: inline photo URL = photoUrl()`);
  }
  ok(src('catalog/index.html').includes(constOf('src/pages/catalog/media.js', 'CAT_SIZES')), 'catalog inline preload uses CAT_SIZES');
  ok(src('car/index.html').includes(constOf('src/pages/car/gallery.js', 'STAGE_SIZES')), 'car inline preload uses STAGE_SIZES');
}

console.log(fails.join('\n'));
console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
