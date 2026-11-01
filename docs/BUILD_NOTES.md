# Rezar Group demo — build notes for the page builders

Static Vite multi-page site, vanilla JS, GSAP + ScrollTrigger + Lenis. Deploys to GitHub Pages under `/rezar-group/`
(`.github/workflows/deploy.yml`: `npm ci → npm run check → npm run build`). Site language: Ukrainian.
Brief: `/private/tmp/claude-501/-Users-poluhovicpavlopavlovic-Documents-Playground/89a5eb38-a302-46cc-9fbe-5c463482031f/scratchpad/tz/brief.txt` (§4–12, §16 = front-end behaviour).

```
npm run dev        # http://localhost:5173/rezar-group/
npm run build      # dist/
npm run preview    # http://localhost:4173/rezar-group/
npm run check      # node logic checks (relTime §9, similar §16, api, format, state) — must stay green
npm run gen:data   # regenerate public/data (deterministic; `-- --verify` re-checks every photo URL = HTTP 200)
npm run gen:logo   # regenerate the wordmark SVG (needs `pip install fonttools brotli`)
```

## 1. File ownership

Three builders work in parallel. Touch only your own files; anything shared → ask/flag, don't edit.

| Owner | Files |
|---|---|
| **HOME** | `index.html` (everything inside `<main>` + its `<head>` meta), `src/pages/home/**`, `src/styles/home.css` |
| **CATALOG** | `catalog/index.html`, `src/pages/catalog/**`, `src/styles/catalog.css` |
| **CAR** | `car/index.html`, `src/pages/car/**`, `src/styles/car.css` |
| SCAFFOLD (shared, read-only for builders) | `src/styles/{tokens,fonts,base,layout,components,motion,main,404}.css`, `src/partials/*`, `src/core/*`, `src/motion/*`, `src/ui/*`, `src/lib/*`, `scripts/*`, `public/*`, `vite.config.js`, `404.html` |

The `<main>` of each page currently holds a small starter (home) or a stub (catalog/car) — replace it freely.
Each page entry already calls `boot()` and imports its page CSS; keep that.

## 2. Page skeleton & conventions

```html
<!doctype html><html lang="uk"><head>
  <!--#include head-->            <!-- charset, viewport, favicon, font preloads, html.js/.reduced/.nav-in script -->
  <title>…</title><meta name="description" …>
  <script type="module" src="/src/pages/<page>/main.js"></script>
</head>
<body data-page="home|catalog|car" [data-tone="ink"]>   <!-- catalog + car are ink pages -->
  <!--#include header-->           <!-- skip link, icon sprite, floating header, mobile menu sheet -->
  <main id="main">…</main>
  <!--#include footer-->
</body></html>
```

* **Links must be base-aware.** In HTML write `%BASE%catalog/` (the partial plugin replaces `%BASE%` with
  `/rezar-group/`). In JS use `src/lib/env.js`: `url('catalog/')`, `carUrl(id)` → `/rezar-group/car/?id=10533`,
  `catalogUrl('?section=new')`. Car pages are `car/?id=<id>` (query string, static hosting).
* Icons: `<svg class="icon" aria-hidden="true"><use href="#i-heart"/></svg>`. Available ids (sprite partial):
  arrow-right/left/up-right, chevron-down/left/right, menu, close, plus, heart, heart-fill, phone, telegram, mail, pin,
  camera, copy, check, filter, sort, search, fuel, bolt, road, gauge, calendar, clock, engine, drive, gearbox, car,
  ship, shield, doc, key, wallet, star, refresh, info. Need another one → ask scaffold.
* Contacts are **placeholders** (real ones unknown): always mark with `data-placeholder`; build tracked links with
  `contactAttrs('phone'|'telegram', place, carId)` from `src/lib/contacts.js`. **Never mention the supplier
  or any counterparty** anywhere — text, alt, comments in shipped HTML.
* Clicks on «Зателефонувати» / «Написати менеджеру» are tracked by `data-track="call|message"` +
  `data-track-place="…"` (+ `data-track-id`) — delegated globally by `src/lib/track.js` (→ `window.dataLayer`).
* Performance: mobile LCP ≤ 2.5 s. Only the hero image is eager/`fetchpriority="high"` (+ `<link rel=preload>` in
  head, see `index.html`); everything else `loading="lazy" decoding="async"` with `srcset`/`sizes` from
  `src/lib/photo.js`. No video, no three.js on first load. Don't add new npm deps without need.

## 3. Design system (ported from VELAR — velarstaff.com / reex.com.ua language, re-inked for Rezar)

**Fonts** (self-hosted woff2, OFL, `src/assets/fonts`): **Fixel Display 500** — headings only;
**Fixel Text 400 / 500 / 600** — everything else. Metric-matched Arial + Roboto fallbacks (no CLS on swap).
No tabular-nums (Fixel's tnum zero is slashed).

**Palette** (`tokens.css`; components read semantic tone tokens, never raw colours):

| token | value | use |
|---|---|---|
| `--ink` | `#0E1013` | near-black: ink sections, text on light |
| `--ink-2` / `--ink-3` / `--ink-4` | `#16191D` / `#1F2328` / `#2A2F35` | graphite surfaces on ink (cards, inputs, hover) |
| `--white` / `--paper` | `#FFFFFF` / `#F3F5F2` | light / grey sections |
| `--card` / `--card-hover` | `#ECEEF0` / `#E3E6E9` | surfaces on light |
| `--muted-light` / `--tone2-light` / `--muted-ink` | `#5B6168` / `#6B7178` / `#9AA1A9` | secondary text |
| `--lime` / `--lime-2` | `#CFF6A2` / `#B9EC80` | **only** the primary CTA (`.btn--lime`, one per view) and «you are here» markers (label dot, active chip/filter, fav badge, focus ring on ink) |
| `--st-stock` / `--st-transit` / `--st-sold` | `#8FE3B0` / `#F2C879` / `#B8BEC6` | status dots on photo badges |

**Tones**: put `data-tone="light|grey|ink"` on a section → it sets `--bg --fg --muted --tone2 --line --line-2
--surface --surface-2 --surface-hover --focus --error`. Home alternates ink hero → light → grey → ink…
(velarstaff rhythm; two equal tones in a row share one padding). Catalog & car: `body[data-tone="ink"]`, header turns
into graphite glass automatically.

**Grid**: `.container` (side margins 16/24/32/40/56/80, max 1440 → 1520) + `.grid` (4 cols <768, 8 cols 768–1023,
12 cols ≥1024; gutters 16/20/24/32). Children span full width by default; `.t-span-4|6|7` (tablet),
`.c-1-4 .c-1-5 .c-1-6 .c-1-7 .c-1-8 .c-5-12 .c-6-12 .c-7-12 .c-8-12 .c-3-10 .c-4-10 .c-9-12` (≥1024).
Car grids: `.card-grid` = **3 columns ≥1024, 2 columns below** (brief §8/§16) — use it for catalog and similar.

**Type scale** (fluid `clamp()` 360→1440, second clamp to 1920): `.t-hero` (uppercase, −0.02em, lh .94) ·
`.t-hero-s` · `h1/.t-h1` · `.t-statement` · `h2/.t-h2` · `h3/.t-h3` · `.t-figure` · `.t-lead` · `.t-body` ·
`.t-small` · `.t-meta` · `.t-label` · `.t-muted` · `.soft` (second tone of two-tone headings).
Tokens: `--fs-hero --fs-hero-s --fs-h1 --fs-statement --fs-h2 --fs-h3 --fs-figure --fs-price --fs-lead --fs-body
--fs-small --fs-label --fs-meta`.

**Spacing / rhythm**: `--s-1…--s-11` (4px base: 4 8 12 16 24 32 48 64 96 128 160), `--section-y`, `--band-y`,
`--head-gap`; `.section` / `.section--band` / `.section--none`, `.section__head`, `.section__body`, `.page-top`,
`.rule`, `.measure`, `.stack`. **Radii 12–28**: `--r-sm 12 · --r-card 16 · --r-header 16 · --r-md 20 · --r-lg 28`
(`--r-xs 8` chips/badges). **No drop-shadows to separate sections or cards** — tone and surface do that; shadows only
on floating layers (header, sheets, toast: `--sh-header`, `--sh-float`).

**Components** (`components.css`):
`.btn` + `.btn--primary|lime|outline|outline-light|link`, `.btn--sm`, `.btn--full`, `.btn--full-phone`, label in
`.btn__label`, arrow `<svg class="icon btn__arrow">` (hover: fill sweeps up, arrow loops) · `.icon-btn` (44×44) ·
`.label` (lime dot + text: `<p class="label"><span class="label__index">01</span><span class="label__dot"></span><span class="label__text">…</span></p>`)
· `.chip` (+ `aria-pressed="true"` / `.chip--lime` = active) · `.badge.badge--in_stock|in_transit|sold` ·
`.acc` accordion (native `<details name>`; markup in the CSS comment) · `.crumbs` · `.hero` (photo hero, markup in CSS
comment; `.hero--l` home, `.hero--s` inner) · `.phero` (plain page head: `.phero__label .phero__title .phero__lede
.phero__actions .phero__media` all animate in) · `.card` (rendered by `card.js`) · `.card--skeleton` · `.state`
(empty / error block: `.state__title .state__text`) · `.field .field__label .input .select .range` (filters) ·
`.toast` (via `toast()`) · `.snap-row` (swipe rows on phones).

**Motion** (VELAR curves; CSS states in `motion.css`, hooks in `src/motion/*`):
easings `--ease-out cubic-bezier(.16,1,.3,1)` (house curve) · `--ease-card (.25,1,.5,1)` · `--ease-soft
(.2,.7,.2,1)` · `--e-spring (.34,1.56,.64,1)`; durations `--d-fast 160 · --d-base 240 · --d-card 320 · --d-slow 400 ·
--d-reveal 700`; reveals 750 ms rise 40 px, groups stagger 60 ms (cap 300).

| attribute / class | effect |
|---|---|
| `.t-h1 .t-h2 .t-statement [data-split]` in `<main>` | words rise in masks line by line (opt out: `data-nosplit`) |
| `[data-reveal]` | block rises; a split heading inside leads, siblings follow |
| `[data-reveal-group]` | children rise with stagger |
| `[data-reveal-media]` | photo frame unclips (inset → 0), picture settles from 1.18 |
| `.label` | lime dot pops, text slides in |
| `[data-draw] > svg` | line icon draws its strokes |
| `.band` / `[data-band]` | ink band opens from rounded card to full bleed |
| `[data-count]` | first number rolls up (`1 200+`, `$ 24 500`) |
| `[data-parallax="0.08"]` | GSAP scrub drift (desktop, tier ≠ low) |
| hero (`.hero[data-frame]`, `.hw/.hw__i` with `--w`/`--l`) | CSS intro from first paint: frame opens, words rise, copy follows, header drops; desktop depth on scroll |
| `.card--enter` | appended cards rise (set by `appendCards`) |

Everything is gated: without JS / under `prefers-reduced-motion` the page is static and complete (`html.js`,
`html.reduced`, `html.mo`). Lenis smooth scroll only on fine pointers & tier ≠ low (`?tier=low|mid|high` to test).
Content added after boot (cards, gallery) → call `initReveals(container)` / `initParallax(container)` on it.
After the page height changes (infinite scroll) → `scroll.resize()`.

## 4. Shared JS APIs

### `src/core/boot.js`
`boot({ reveals = true } = {}) → { tier: 'high'|'mid'|'low', reduced: boolean, scroll: ScrollAPI }` — imports
`main.css`, tier, Lenis+ScrollTrigger, header, menu, tracking, fav badges, footer year + «Каталог оновлено …»,
accordions, reveals, parallax, hero hooks. Call once, first.

### `src/core/scroll.js`
`getScroll() → ScrollAPI` · `ScrollAPI = { lenis, scrollTo(target|y, {offset, duration, immediate, onComplete}),
stop(), start(), resize(), onScroll(fn) → unsubscribe }` · `requestRefresh()` (debounced ScrollTrigger.refresh) ·
re-exports `gsap`, `ScrollTrigger` (import them from here, never `new Lenis`).
`src/core/tier.js`: `detectTier()`, `prefersReducedMotion()`.

### `src/lib/api.js` — mimics the future backend (keep page code identical when the real API arrives)
```js
import { api, DEFAULT_FILTERS, PAGE_SIZE /*24*/, NEW_DAYS /*14*/ } from '../../lib/api.js';
await api.query(filters, { cursor = null, limit = 24 })  // → { items, nextCursor, total }
await api.facets(filters)        // → { sections: {all,new,in_stock,in_transit,sold}, makes:[{make,count}], models:[{model,count}], ranges:{year,price,mileage} }
await api.getCar(id)             // → car | null  (card fields + vin?, description?, equipment?[], gallery[], origin, soldAt?, isNew) — meta + its chunk only, never catalog.json
await api.similar(id, { cursor = null, limit = 12 }) // → { items, nextCursor, total, ranked:[{car,tier,score,parts}] }
await api.byIds(ids)             // favourites, in order
await api.meta()                 // → { lastSyncAt, stale, total, counts, makes:[{make,count,models:[{model,count}]}], ranges, scenes }
api.now()                        // Date the UI must use for relTime / «нові» (supports ?now=ISO)
api.prefetch()                   // warm the catalog cache
```
Filters: `{ make, model, yearFrom, yearTo, priceFrom, priceTo, mileageFrom, mileageTo, section, sort, ids }`
* `section`: `'all'` (default = in_stock + in_transit, sold hidden) · `'new'` (first published ≤ 14 Kyiv calendar
  days, not sold — brief §5) · `'in_stock'` · `'in_transit'` · `'sold'` (only shown when chosen).
  UI labels: `SECTIONS` in `format.js` («Нові надходження», «Авто в наявності», «Авто в дорозі», «Продано»).
* `sort`: `'date_desc'` (default) · `'date_asc'` · `'price_asc'` · `'price_desc'` — ties by id; no-price cars last.
  UI labels: `SORTS` in `format.js`.
* Price/mileage filters drop cars that have no price/mileage. `model` only applies together with `make`.
* Keyset pagination (`nextCursor`) → no duplicates/skips; restore N loaded cards with `limit: N` in one call.
* Demo clock: data is re-based onto the real clock by whole sync slots (08:00/20:00 Kyiv). `?now=2026-10-29T12:00:00Z`
  fixes the clock, `?rebase=0` shows raw dates.
* Pure versions for tests: `queryCars, facetCars, similarCars, isNew, normalizeFilters, matches, sortKey`.

### Car object (catalog item)
`{ id:number, make, model, year, body:'sedan'|'liftback'|'hatchback'|'wagon'|'suv'|'coupe'|'pickup', cls,
status:'in_stock'|'in_transit'|'sold', publishedAt:ISO, price?, apiPrice?, markup?:500, mileage?, fuel?, engine?
(litres), battery? (kWh, EV), drive?, gearbox?, trim?, power? (hp), color?, photo (Unsplash id), photos (count) }`.
**Missing keys are simply absent → hide the whole field/row, never print «немає даних»** (brief §8/§11).
Only `price` (final USD = apiPrice + 500) reaches the browser. `apiPrice` / `markup` and the internal
`tags: ['previously_sold']` / `history` live in `mock-db/internal.json` (not deployed, like the real DB side) — brief §4, §6.

### `src/lib/card.js`
`cardHTML(car, { now, eager=false, newTab=isDesktop(), index=0, place='catalog' }) → string` ·
`appendCards(container, cars, { animate=true, ...cardOpts }) → Element[]` · `cardSkeletonHTML()` ·
`bindCards(container)` (fav toggles; `appendCards` calls it) · `badgeHTML(status, extraClass)`.
Desktop → car opens in a new tab, mobile → same tab (brief §10). First row on the catalog: `eager: true`.

### `src/lib/state.js` (mobile back-navigation, brief §10)
`filtersToSearch(filters) → '?make=BMW&section=new'` · `searchToFilters(location.search, { favIds })` ·
`saveCatalogState({ filters, loaded, scrollY, anchorId })` · `loadCatalogState() → state|null` (same URL, ≤30 min) ·
`clearCatalogState()` · `isBackNavigation()`. URL params: `make model year_from year_to price_from price_to km_from
km_to section sort fav=1`.

### Others
* `relTime.js` — `relTime(publishedAt, now)` (brief §9 exactly; Europe/Kyiv; uk plurals).
* `kyiv.js` — `kyivParts, kyivDayNumber, kyivDaysBetween, kyivWallToUtc, latestSyncSlot`.
* `similar.js` — brief §16 algorithm (`rankSimilar(src, cars)`, `pageSimilar(ranked, {cursor, limit=12})`,
  `scoreCandidate`, points helpers). `classes.js` = the «аналогічний клас» reference (`CLASS_OF`, `CLASS_LABEL`,
  `classOf`, `ENGINE_BANDS`, `FUEL_RELATED`).
* `format.js` — `formatPrice(24500) → '$ 24 500'`, `formatMileage(86000) → '86 000 км'`, `formatEngine(2) → '2.0 л'`,
  `formatBattery`, `formatDate`, `formatDateTime`, `formatNumber`, `plural(n, [one, few, many])`, label maps `FUEL DRIVE
  GEARBOX BODY STATUS SECTIONS SORTS` (narrow no-break spaces inside numbers).
* `photo.js` — `photoUrl(id, { w, h?, ratio?, q })`, `photoSrcset(id, { widths, ratio })`, `photoLqip(id)`,
  `CARD_WIDTHS`, `GALLERY_WIDTHS`, `CARD_SIZES`, `SCENES` (home imagery: hero, heroAlt, night, dark, matte, showroom,
  showroom2, handover, road). All ids verified HTTP 200; the only place to switch to Rezar's R2/CDN later.
* `favorites.js` — `favorites.has/toggle/list/count/onChange/syncBadges` (localStorage).
* `track.js` — `track(event, props)`, `initTracking()` (done by boot).
* `contacts.js` — `CONTACTS`, `contactAttrs(kind, place, carId)`.
* `env.js` — `BASE`, `url()`, `carUrl()`, `catalogUrl()`, `isDesktop()`.
* `ui/toast.js` — `toast(text, { icon='check', ms })` (e.g. «VIN скопійовано»).
* motion: `initReveals(root)`, `initCounters(root)`, `initParallax(root, {tier})`, `initAccordions(root)`.

## 5. Data (`public/data`, generated by `scripts/gen-data.mjs`, seed-deterministic)
1200 cars: in_stock 637 · in_transit 328 · sold 235; 17 relisted (history kept, new publication date); fields
intentionally missing on some cars (price 18, mileage 52, fuel 17, drive 80, trim 131, VIN/description/equipment
~15–20 %). `catalog.json` (~47 KB gzip, all card + filter fields), `first.json` (first 24 of the default view — the
catalog's first row does not wait for catalog.json), `cars/<n>.json` (card fields + details in chunks of 100 by id —
the car page renders from meta + its chunk), `meta.json`; `mock-db/internal.json` (NOT served) = apiPrice, markup,
tags, history. Publications land on the 08:00/20:00 Kyiv sync slots over the last 90 days (newest two slots always have
cars, so «N годин тому» shows). Photos: 97 distinct verified Unsplash images mapped by make/body + interior/detail
fillers (`scripts/photo-catalog.mjs`).

## 6. Page notes from the brief
* **Catalog** (§7, §8, §10): filters — make with search in the list, model appears after make, year/price/mileage
  from–to, «Розділ», sort; default sort date desc; infinite scroll by 24 with prefetch of the next page (sentinel
  ~1200 px ahead), skeletons, empty state (`.state`) and error state; restore filters/sort/loaded cards/scroll on
  mobile back; update the URL (`history.replaceState`) on every change.
* **Car** (§11, §16): gallery (large photo, thumbnails, swipe, counter), title, trim, year, price, mileage, engine,
  fuel, drive, VIN with copy (`toast`), description, equipment; hide empty; «Зателефонувати» / «Написати менеджеру»
  (tracked, Rezar contacts only). Sold: status «Продано» + button «Підібрати схоже», then a thin rule, heading
  «Схожі автомобілі» and the similar grid (12 per page, infinite, hide block when 0).
  ⚠ Brief §4 says «на страницах проданных нет блока похожих машин», §16 (later, detailed) requires the block on sold
  pages — we follow §16; flag the contradiction in the proposal.
* **Home** (§12): about, advantages, order steps, reviews, location, corporate contacts, legal guarantees, marketing
  promises; ids used by nav: `#about #steps #reviews #guarantees #contacts`.

## Integration QA (after the three page builds)

* **Early data hand-off**: `catalog/` and `car/` start their JSON requests in an inline `<head>` script and park the
  fetch promises on `window.__rzPre[path]`; `src/lib/api.js` (`takePrefetch`) consumes each one once, so the data
  arrives with the HTML even when the HTTP cache is cold or disabled. The car page also gets its detail chunk as soon
  as `meta.json` lands (`window.__rzChunk` + `rz:chunk` event) and preloads the first gallery photo from it.
* **Mock data**: trims are brand-correct (`BRAND_TRIMS` in `scripts/gen-data.mjs`), and «Колір» follows the colour
  of the car's main photo (`EXT_COLOR` in `scripts/photo-catalog.mjs`). Both keep the RNG sequence, so ids, prices,
  statuses and dates are unchanged.
* `docs/shots/` — final QA screenshots (desktop 1440, mobile 390 @2x), regenerated from `npm run preview`.

## Client review pass (brief §4–12, §14, §16)

* Internal fields out of the public files (above). `npm run check` asserts it (96 checks).
* LCP: the inline `<head>` scripts of `catalog/` and `car/` also preload the first photos (same `srcset`/`sizes`;
  `check-logic` guards the inline URL builder against `photo.js` and the `sizes` against `media.js` / `gallery.js`);
  `catalog.json` is fetched at low priority; car thumbnails wait for the main photo; the first catalog row enters
  with a transform-only photo settle (`appendCards(..., { enter: 'body' })`) — an opacity fade delayed LCP to the end
  of the animation. `catalog/main.js` imports `page.js` statically so the whole graph is modulepreloaded.
* `?sync=stale` demo (brief §3/§14): `api.meta().stale` (last sync older than 13 h) → catalog label «Дані станом на …»
  + note, footer and home teaser wording; availability is never presented as confirmed.
* The cross-document view-transition opt-in is inline in `head.html` (Chrome decided before the external CSS was in
  and aborted with an uncaught «ViewTransition opt-in disabled»).
