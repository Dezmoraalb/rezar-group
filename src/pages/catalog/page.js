/**
 * Catalog page (brief §7 filters · §8 cards · §9 time · §10 loading). Owner: CATALOG builder.
 *
 *   page head   «Каталог оновлено …» (last successful sync, §3) · title + lede per «Розділ» · «Розділ» tabs with counts
 *   sidebar     filters (panel.js): sticky graphite panel ≥1280, sheet below (sheet.js) with a draft + «Показати N авто»
 *   toolbar     result count · active-filter chips with reset · «Фільтри» (<1280) · sort
 *   grid        24 per page, keyset cursor (no dupes / gaps), next page prefetched as soon as one lands, sentinel
 *               1200px ahead, skeletons only if a page is late, empty / error states
 *   URL         every change → history.replaceState (shareable, crawlable section links)
 *   back nav    phones open cars in the same tab: filters, sort, loaded cards and the scroll anchor are saved on leave
 *               and restored on «Назад» (state.js, sessionStorage)
 * Demo switch: ?state=error shows the error state once (the retry then works).
 */
import { api, normalizeFilters, PAGE_SIZE } from '../../lib/api.js';
import { boot } from '../../core/boot.js';
import { appendCards, cardSkeletonHTML } from '../../lib/card.js';
import { filtersToSearch, searchToFilters, saveCatalogState, loadCatalogState, clearCatalogState, isBackNavigation } from '../../lib/state.js';
import { favorites } from '../../lib/favorites.js';
import { formatDateTime, formatMileage, formatNumber, formatPrice, plural, SORTS } from '../../lib/format.js';
import { track } from '../../lib/track.js';
import { contactAttrs } from '../../lib/contacts.js';
import { catalogUrl } from '../../lib/env.js';
import { markCurrent } from '../../ui/header.js';
import { initPanel, applyLabel } from './panel.js';
import { initSheet } from './sheet.js';
import { sizeCards } from './media.js';

try {
  history.scrollRestoration = 'manual';
} catch {}

const { reduced, scroll } = boot();

/* ------------------------------------------------------------------ elements */
const $ = (s, r = document) => /** @type {HTMLElement} */ (r.querySelector(s));
const $$ = (s, r = document) => /** @type {HTMLElement[]} */ (Array.from(r.querySelectorAll(s)));
const el = {
  title: $('[data-cat-title]'),
  lede: $('[data-cat-lede]'),
  sync: $('[data-cat-sync]'),
  syncTime: $('[data-cat-sync-time]'),
  tabs: $('[data-cat-tabs]'),
  pill: $('[data-cat-pill]'),
  bar: $('[data-cat-bar]'),
  n: $('[data-cat-n]'),
  nWord: $('[data-cat-n-word]'),
  chips: $('[data-cat-chips]'),
  sort: /** @type {HTMLSelectElement} */ ($('[data-cat-sort]')),
  grid: $('[data-cat-grid]'),
  state: $('[data-cat-state]'),
  more: $('[data-cat-more]'),
  sentinel: $('[data-cat-sentinel]'),
  dock: $('[data-cat-dock]'),
  panel: $('[data-cf]'),
  backdrop: $('[data-cf-backdrop]'),
  apply: $('[data-cf-apply]'),
  applyLabel: $('[data-cf-apply-label]'),
};

const HEAD = {
  all: ['Каталог авто', 'Авто в наявності та в дорозі до України.'],
  new: ['Нові надходження', 'Вперше опубліковані за останні 14 днів.'],
  in_stock: ['Авто в наявності', 'Уже в Україні — можна оглянути наживо.'],
  in_transit: ['Авто в дорозі', 'Уже викуплені й прямують в Україну.'],
  sold: ['Продані авто', 'Архів проданих: фото, характеристики й ціна продажу.'],
  fav: ['Обрані авто', 'Авто, які ви зберегли в цьому браузері.'],
};
const KEEP = ['now', 'rebase', 'tier']; // test params survive replaceState

/* ------------------------------------------------------------------ state */
const q0 = new URLSearchParams(location.search);
let demoError = q0.get('state') === 'error';
const saved = isBackNavigation() ? loadCatalogState() : null;
let applied = saved?.filters ?? searchToFilters(location.search, { favIds: favorites.list() });
if (applied.ids) applied = { ...applied, ids: favorites.list() };

let gen = 0; // bumps on every new result set; stale responses are dropped
let cursor = null;
let loading = false;
/** @type {{cursor: string, p: Promise<any>}|null} */
let next = null;
let total = 0;
let shownTotal = 0;
let facetsApplied = null;
let previewT = 0;
let typingT = 0;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(normalizeFilters(a)) === JSON.stringify(normalizeFilters(b));
const autos = (n) => plural(n, ['авто', 'авто', 'авто']);

function search(filters) {
  const s = new URLSearchParams(filtersToSearch(filters).slice(1));
  for (const k of KEEP) if (q0.has(k)) s.set(k, /** @type {string} */ (q0.get(k)));
  const str = s.toString();
  return str ? `?${str}` : '';
}

/* ------------------------------------------------------------------ filters panel + sheet */
const meta0 = await api.meta().catch(() => null);
const panel = initPanel({
  root: el.panel,
  years: meta0?.ranges?.year ?? [2014, new Date().getFullYear()],
  onChange(draft, { typing }) {
    const merged = { ...applied, ...draft };
    if (sheet.isOpen()) {
      clearTimeout(previewT);
      previewT = window.setTimeout(() => preview(merged), typing ? 220 : 0);
      return;
    }
    clearTimeout(typingT);
    if (typing) typingT = window.setTimeout(() => apply(merged), 650);
    else apply(merged);
  },
});
const sheet = initSheet({
  panel: el.panel,
  backdrop: el.backdrop,
  scroll,
  onOpen() {
    panel.set(applied);
    preview(applied);
  },
  onClose(how) {
    if (how === 'apply') return;
    // dismissed without applying: the draft goes back to what the grid shows
    clearTimeout(previewT);
    panel.set(applied);
    panel.render(facetsApplied);
  },
});

async function preview(f) {
  const g = gen;
  const [fc, res] = await Promise.all([api.facets(f), api.query(f, { limit: 1 })]).catch(() => [null, null]);
  if (g !== gen && !sheet.isOpen()) return;
  if (fc) panel.render(fc);
  if (res) {
    el.applyLabel.textContent = applyLabel(res.total);
    el.apply.setAttribute('aria-disabled', String(res.total === 0 && !same(f, applied)));
  }
  $('[data-cf-reset-sheet]').setAttribute('aria-disabled', String(activeCount(f) === 0));
}

$$('[data-cf-open]').forEach((b) => b.addEventListener('click', () => sheet.open(b)));
$('[data-cf-close]').addEventListener('click', () => sheet.close('close'));
el.apply.addEventListener('click', () => {
  const merged = { ...applied, ...panel.draft };
  sheet.close('apply');
  apply(merged, { toTop: true });
});
$('[data-cf-reset-sheet]').addEventListener('click', () => {
  panel.set({ ...applied, ...clearedFilters() });
  preview({ ...applied, ...clearedFilters() });
});
$('[data-cf-reset]').addEventListener('click', () => resetFilters());

/* ------------------------------------------------------------------ sort */
el.sort.innerHTML = SORTS.map((s) => `<option value="${s.value}">${s.label}</option>`).join('');
el.sort.addEventListener('change', () => apply({ ...applied, sort: el.sort.value }, { toTop: true }));

/* ------------------------------------------------------------------ «Розділ» tabs */
el.tabs.addEventListener('click', (e) => {
  const a = /** @type {Element} */ (e.target).closest?.('[data-section]');
  const me = /** @type {MouseEvent} */ (e);
  if (!a || me.metaKey || me.ctrlKey || me.shiftKey || me.button > 0) return;
  e.preventDefault();
  apply({ ...applied, section: a.getAttribute('data-section'), ids: null }, { toTop: true });
});

let pillReady = false;
function placePill() {
  const a = $('[data-section][aria-current]', el.tabs);
  if (!a) return;
  el.pill.style.setProperty('--x', `${a.offsetLeft}px`);
  el.pill.style.setProperty('--w', `${a.offsetWidth}px`);
  if (!pillReady) {
    pillReady = true;
    requestAnimationFrame(() => el.tabs.classList.add('has-pill'));
  }
  // phones: bring the active tab into view inside the scrolling row
  const t = el.tabs;
  if (t.scrollWidth > t.clientWidth) {
    const left = a.offsetLeft - (t.clientWidth - a.offsetWidth) / 2;
    t.scrollTo({ left, behavior: pillReady && !reduced ? 'smooth' : 'auto' });
  }
}
addEventListener('resize', () => placePill());
document.fonts?.ready.then(placePill);

/* ------------------------------------------------------------------ head, chips, url */
const clearedFilters = () => ({ make: '', model: '', yearFrom: null, yearTo: null, priceFrom: null, priceTo: null, mileageFrom: null, mileageTo: null });

function activeCount(f) {
  let n = 0;
  if (f.make) n++;
  if (f.model) n++;
  if (f.yearFrom != null || f.yearTo != null) n++;
  if (f.priceFrom != null || f.priceTo != null) n++;
  if (f.mileageFrom != null || f.mileageTo != null) n++;
  return n;
}

const span = (a, b, fmt, unitFrom = '', unitTo = '') =>
  a != null && b != null ? `${fmt(a)} – ${fmt(b)}${unitTo}` : a != null ? `від ${fmt(a)}${unitFrom}` : `до ${fmt(b)}${unitTo}`;

function chipList(f) {
  const out = [];
  if (f.ids) out.push({ key: 'ids', text: 'Обрані', icon: 'heart-fill' });
  if (f.make) out.push({ key: 'make', text: f.make });
  if (f.model) out.push({ key: 'model', text: f.model });
  if (f.yearFrom != null || f.yearTo != null) out.push({ key: 'year', text: `Рік ${span(f.yearFrom, f.yearTo, String)}` });
  if (f.priceFrom != null || f.priceTo != null) out.push({ key: 'price', text: span(f.priceFrom, f.priceTo, formatPrice) });
  if (f.mileageFrom != null || f.mileageTo != null)
    out.push({ key: 'mileage', text: span(f.mileageFrom, f.mileageTo, (v) => (f.mileageFrom != null && f.mileageTo != null && v === f.mileageFrom ? formatNumber(v) : formatMileage(v))) });
  return out;
}

const chipsHTML = (f, { reset = true } = {}) => {
  const list = chipList(f);
  if (!list.length) return '';
  return (
    list
      .map(
        (c, i) =>
          `<button class="chip cat-chip" type="button" data-rm="${c.key}" style="--k:${i}" aria-label="Прибрати фільтр: ${c.text}">${c.icon ? `<svg class="icon" aria-hidden="true"><use href="#i-${c.icon}"/></svg>` : ''}<span>${c.text}</span><svg class="icon cat-chip__x" aria-hidden="true"><use href="#i-close"/></svg></button>`,
      )
      .join('') + (reset && list.length > 1 ? `<button class="cat-chips__reset" type="button" data-rm="all">Скинути все</button>` : '')
  );
};

function removeFilter(key) {
  const f = { ...applied };
  if (key === 'all') return resetFilters();
  if (key === 'ids') f.ids = null;
  if (key === 'make') Object.assign(f, { make: '', model: '' });
  if (key === 'model') f.model = '';
  if (key === 'year') Object.assign(f, { yearFrom: null, yearTo: null });
  if (key === 'price') Object.assign(f, { priceFrom: null, priceTo: null });
  if (key === 'mileage') Object.assign(f, { mileageFrom: null, mileageTo: null });
  apply(f);
}
function resetFilters() {
  apply({ ...applied, ...clearedFilters(), ids: null }, { toTop: true });
}
document.addEventListener('click', (e) => {
  const me = /** @type {MouseEvent} */ (e);
  const t = /** @type {Element} */ (e.target);
  const b = t.closest?.('[data-rm]');
  if (b && b.closest('.cat-page')) {
    if (b.tagName === 'A') e.preventDefault();
    removeFilter(/** @type {string} */ (b.getAttribute('data-rm')));
    return;
  }
  // header / menu / footer links to another catalog view (?section=new, ?fav=1 …) switch in place, no reload
  const a = /** @type {HTMLAnchorElement|null} */ (t.closest?.('a[href]'));
  if (!a || a.target === '_blank' || me.metaKey || me.ctrlKey || me.shiftKey || me.button > 0 || a.closest('.cat-tabs, [data-cat-grid]')) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || u.pathname !== location.pathname || u.hash) return;
  e.preventDefault();
  const f = searchToFilters(u.search, { favIds: favorites.list() });
  scroll.scrollTo(0, { duration: 0.9 });
  if (same(f, applied)) return;
  apply(f); // a link means a fresh view of that list (its own filters and sort)
});

function renderHead() {
  const key = applied.ids ? 'fav' : applied.section;
  const [title, lede] = HEAD[key] ?? HEAD.all;
  if (el.title.textContent !== title) {
    el.title.textContent = title;
    if (!reduced && pillReady) {
      el.title.classList.remove('is-swap');
      void el.title.offsetWidth;
      el.title.classList.add('is-swap');
    }
  }
  el.lede.textContent = lede;
  document.title = `${title} — Rezar Group`;
  $$('[data-section]', el.tabs).forEach((a) => {
    if (!applied.ids && a.getAttribute('data-section') === applied.section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  el.tabs.classList.toggle('is-none', !!applied.ids);
  placePill();
  el.sort.value = applied.sort;

  const n = activeCount(applied);
  $$('[data-cf-badge]').forEach((b) => {
    b.textContent = String(n);
    b.hidden = n === 0;
  });
  $('[data-cf-reset]').hidden = n === 0;
  // only chips that were not there before pop in
  const had = new Set($$('[data-rm]', el.chips).map((c) => `${c.dataset.rm}:${c.textContent}`));
  const html = chipsHTML(applied);
  el.chips.innerHTML = html;
  el.chips.hidden = !html;
  if (pillReady && !reduced) $$('[data-rm]', el.chips).forEach((c) => !had.has(`${c.dataset.rm}:${c.textContent}`) && c.classList.add('is-new'));
}

function syncUrl() {
  const s = search(applied);
  history.replaceState(history.state, '', location.pathname + s);
  markCurrent();
}

/* ------------------------------------------------------------------ count */
let countRaf = 0;
function setCount(n) {
  total = n;
  el.nWord.textContent = autos(n);
  const from = shownTotal;
  shownTotal = n;
  cancelAnimationFrame(countRaf);
  if (reduced || from === n || !pillReady) {
    el.n.textContent = formatNumber(n);
    return;
  }
  const t0 = performance.now();
  const dur = 520;
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 4);
    el.n.textContent = formatNumber(Math.round(from + (n - from) * e));
    if (p < 1) countRaf = requestAnimationFrame(tick);
  };
  countRaf = requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ results */
const cols = () => (matchMedia('(min-width: 1024px)').matches ? 3 : 2);

function setState(html) {
  el.state.innerHTML = html;
  el.state.hidden = !html;
  if (html && !reduced) {
    el.state.classList.remove('is-in');
    void el.state.offsetWidth;
    el.state.classList.add('is-in');
  }
}

function emptyHTML() {
  if (applied.ids && !applied.ids.length) {
    return `<div class="state cat-empty">
      <span class="cat-empty__icon" aria-hidden="true"><svg class="icon"><use href="#i-heart"/></svg></span>
      <h2 class="state__title">Обраних поки немає</h2>
      <p class="state__text">Натисніть на серце на фото авто, щоб зберегти його тут. Обрані зберігаються в цьому браузері.</p>
      <div class="cat-empty__actions"><a class="btn btn--outline btn--sm" href="${catalogUrl()}" data-rm="ids"><span class="btn__label">Перейти до каталогу</span></a></div>
    </div>`;
  }
  const chips = chipsHTML(applied, { reset: false });
  return `<div class="state cat-empty">
    <span class="cat-empty__icon" aria-hidden="true"><svg class="icon"><use href="#i-search"/></svg></span>
    <h2 class="state__title">За цими фільтрами авто немає</h2>
    <p class="state__text">Розширте діапазон ціни, року чи пробігу або приберіть частину фільтрів. Не знайшли потрібне — менеджер підбере й привезе авто під замовлення.</p>
    ${chips ? `<div class="cat-empty__chips"><span class="t-meta">Прибрати:</span>${chips}</div>` : ''}
    <div class="cat-empty__actions">
      ${activeCount(applied) || applied.ids ? `<button class="btn btn--outline btn--sm" type="button" data-rm="all"><span class="btn__label">Скинути фільтри</span></button>` : ''}
      <a class="btn btn--link" ${contactAttrs('telegram', 'catalog-empty')}><span class="btn__label">Написати менеджеру</span></a>
    </div>
  </div>`;
}

const errorHTML = (more = false) =>
  more
    ? `<p class="cat-more__text">Не вдалося завантажити наступні авто.</p><button class="btn btn--outline btn--sm" type="button" data-cat-retry-more><svg class="icon" aria-hidden="true"><use href="#i-refresh"/></svg><span class="btn__label">Спробувати ще</span></button>`
    : `<div class="state cat-empty cat-error" role="alert">
    <span class="cat-empty__icon" aria-hidden="true"><svg class="icon"><use href="#i-refresh"/></svg></span>
    <h2 class="state__title">Не вдалося завантажити каталог</h2>
    <p class="state__text">Схоже, зв’язок перервався. Перевірте інтернет і спробуйте ще раз — фільтри збережуться.</p>
    <div class="cat-empty__actions">
      <button class="btn btn--outline btn--sm" type="button" data-cat-retry><svg class="icon" aria-hidden="true"><use href="#i-refresh"/></svg><span class="btn__label">Спробувати ще</span></button>
      <a class="btn btn--link" ${contactAttrs('telegram', 'catalog-error')}><span class="btn__label">Написати менеджеру</span></a>
    </div>
  </div>`;

function endHTML() {
  if (total <= PAGE_SIZE) return '';
  return `<p class="cat-more__text">Ви переглянули всі ${formatNumber(total)} ${autos(total)}</p><button class="btn btn--link" type="button" data-cat-up><span class="btn__label">Нагору</span></button>`;
}

function setMore(html, cls = '') {
  el.more.innerHTML = html;
  el.more.hidden = !html;
  el.more.className = `cat-more${cls ? ` ${cls}` : ''}`;
}

/** fade the old set out, render the new one (restore: no animation, then scroll back to the saved anchor) */
async function loadFirst({ restore = null, toTop = false } = {}) {
  const g = ++gen;
  cursor = null;
  next = null;
  loading = true;
  io.unobserve(el.sentinel);
  setMore('');
  el.grid.setAttribute('aria-busy', 'true');
  const hasCards = !!el.grid.querySelector('.card[data-car-id]');
  if (hasCards) el.grid.classList.add('is-swapping');
  const limit = restore ? Math.max(PAGE_SIZE, Math.min(restore.loaded || 0, 2400)) : PAGE_SIZE;
  let page;
  try {
    if (demoError) {
      demoError = false;
      await wait(500);
      throw new Error('demo error');
    }
    [page] = await Promise.all([api.query(applied, { limit }), hasCards && !reduced ? wait(200) : null]);
  } catch (err) {
    if (g !== gen) return;
    loading = false;
    el.grid.classList.remove('is-swapping');
    el.grid.innerHTML = '';
    el.grid.setAttribute('aria-busy', 'false');
    el.n.textContent = '—';
    el.nWord.textContent = '';
    shownTotal = 0;
    setState(errorHTML());
    return;
  }
  if (g !== gen) return;
  if (toTop) scrollToResults();
  el.grid.classList.remove('is-swapping');
  el.grid.innerHTML = '';
  el.grid.setAttribute('aria-busy', 'false');
  setCount(page.total);
  if (!page.total) {
    loading = false;
    setState(emptyHTML());
    scroll.resize();
    return;
  }
  setState('');
  const now = api.now();
  const animate = !restore && !reduced;
  const eagerN = cols() * (matchMedia('(min-width: 768px)').matches ? 1 : 2);
  const els = [
    ...appendCards(el.grid, page.items.slice(0, eagerN), { now, eager: !restore, animate, enter: hasCards ? 'full' : 'body' }),
    ...appendCards(el.grid, page.items.slice(eagerN), { now, animate }),
  ];
  sizeCards(els);
  if (animate) els.forEach((c, i) => c.style.setProperty('--k', String(Math.min(i, 11))));
  cursor = page.nextCursor;
  loading = false;
  if (restore) restoreScroll(restore);
  afterPage();
}

async function loadMore() {
  if (loading || !cursor) return;
  loading = true;
  const g = gen;
  const c = cursor;
  const p = next?.cursor === c ? next.p : api.query(applied, { cursor: c });
  // skeletons only when the page is actually late (the prefetched one is usually there already)
  let sk = null;
  const skT = setTimeout(() => {
    sk = document.createElement('template');
    sk.innerHTML = Array.from({ length: cols() * 2 }, cardSkeletonHTML).join('');
    const nodes = Array.from(sk.content.children);
    el.grid.append(sk.content);
    sk = nodes;
    scroll.resize();
  }, 140);
  let page;
  try {
    page = await p;
  } catch {
    clearTimeout(skT);
    if (Array.isArray(sk)) sk.forEach((n) => n.remove());
    if (g !== gen) return;
    loading = false;
    next = null;
    setMore(errorHTML(true), 'is-error');
    return;
  }
  clearTimeout(skT);
  if (Array.isArray(sk)) sk.forEach((n) => n.remove());
  if (g !== gen) return;
  sizeCards(appendCards(el.grid, page.items, { now: api.now(), animate: !reduced }));
  cursor = page.nextCursor;
  loading = false;
  track('catalog_page', { loaded: el.grid.children.length, total });
  afterPage();
}

function afterPage() {
  scroll.resize();
  if (cursor) {
    const c = cursor;
    const f = applied;
    next = { cursor: c, p: api.query(f, { cursor: c }) };
    next.p.catch(() => {});
    // re-observe: fires again at once if the sentinel is still within reach (short pages, tall screens)
    io.unobserve(el.sentinel);
    io.observe(el.sentinel);
    setMore('');
  } else {
    next = null;
    setMore(endHTML(), 'is-end');
  }
}

// the sentinel counts as «near» from 1200px below the fold and anywhere above it (a fling / End key can jump past it)
const io = new IntersectionObserver((entries) => entries.at(-1)?.isIntersecting && loadMore(), { rootMargin: '1000% 0px 1200px 0px' });
let nearRaf = 0;
scroll.onScroll(() => {
  if (nearRaf || loading || !cursor) return;
  nearRaf = requestAnimationFrame(() => {
    nearRaf = 0;
    if (el.sentinel.getBoundingClientRect().top < innerHeight + 1200) loadMore();
  });
});

document.addEventListener('click', (e) => {
  const t = /** @type {Element} */ (e.target);
  if (t.closest?.('[data-cat-retry]')) loadFirst();
  else if (t.closest?.('[data-cat-retry-more]')) {
    setMore('');
    loadMore();
  } else if (t.closest?.('[data-cat-up]')) scroll.scrollTo(0, { duration: 1.4 });
});

function scrollToResults() {
  const top = el.bar.getBoundingClientRect().top;
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-space')) || 80;
  if (top < header) scroll.scrollTo(el.bar, { offset: -(header + 12), duration: 0.9 });
}

/* ------------------------------------------------------------------ apply */
async function apply(nextFilters, { toTop = false } = {}) {
  const f = normalizeFilters(nextFilters);
  if (same(f, applied)) return;
  applied = f;
  clearTimeout(typingT);
  syncUrl();
  renderHead();
  if (!sheet.isOpen()) panel.set(applied);
  loadFirst({ toTop });
  refreshFacets();
}

async function refreshFacets() {
  const g = gen;
  const fc = await api.facets(applied).catch(() => null);
  if (!fc || g !== gen) return;
  facetsApplied = fc;
  if (!sheet.isOpen()) panel.render(fc);
  for (const [k, v] of Object.entries(fc.sections)) {
    const s = $(`[data-count="${k}"]`, el.tabs);
    if (s) s.textContent = formatNumber(v);
  }
  placePill();
}

/* ------------------------------------------------------------------ cards: open, favourites, back-nav state */
function snapshot() {
  const cards = $$('.card[data-car-id]', el.grid);
  if (!cards.length) return clearCatalogState();
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-space')) || 80;
  const anchor = cards.find((c) => c.getBoundingClientRect().bottom > header) ?? cards[0];
  saveCatalogState({
    filters: applied,
    loaded: cards.length,
    scrollY: scrollY,
    anchorId: Number(anchor.dataset.carId),
    anchorTop: anchor.getBoundingClientRect().top,
  });
}

function restoreScroll(s) {
  requestAnimationFrame(() => {
    const a = s.anchorId != null ? el.grid.querySelector(`.card[data-car-id="${s.anchorId}"]`) : null;
    const y = a ? a.getBoundingClientRect().top + scrollY - (s.anchorTop ?? 0) : s.scrollY;
    scroll.resize();
    scroll.scrollTo(Math.max(0, y), { immediate: true });
    if (!scroll.lenis) window.scrollTo(0, Math.max(0, y));
  });
}

el.grid.addEventListener('click', (e) => {
  const t = /** @type {Element} */ (e.target);
  const link = t.closest?.('[data-card-link]');
  if (link) {
    const card = link.closest('.card');
    snapshot();
    track('catalog_card_open', { carId: card?.getAttribute('data-car-id'), newTab: link.getAttribute('target') === '_blank' });
    return;
  }
  const fav = /** @type {HTMLElement|null} */ (t.closest?.('[data-fav]'));
  if (!fav) return;
  // card.js toggles after this listener; read the new state on the next task
  setTimeout(() => {
    const on = fav.getAttribute('aria-pressed') === 'true';
    if (on && !reduced) {
      fav.classList.remove('is-burst');
      void fav.offsetWidth;
      fav.classList.add('is-burst');
      fav.onanimationend = (ev) => ev.animationName === 'fav-burst' && fav.classList.remove('is-burst');
    }
    if (!on && applied.ids) leaveFavourite(/** @type {HTMLElement} */ (fav.closest('.card')));
  }, 0);
});

/** favourites view: an un-hearted card folds away */
function leaveFavourite(card) {
  if (!card) return;
  const id = Number(card.dataset.carId);
  applied = { ...applied, ids: (applied.ids ?? []).filter((x) => x !== id) };
  setCount(Math.max(0, total - 1));
  const done = () => {
    card.remove();
    if (!el.grid.querySelector('.card[data-car-id]')) setState(emptyHTML());
    if (total <= PAGE_SIZE) setMore('');
    scroll.resize();
  };
  if (reduced) return done();
  card.classList.add('is-leaving');
  setTimeout(done, 380);
}

addEventListener('pagehide', snapshot);
addEventListener('pageshow', (e) => {
  // bfcache: the page comes back intact; only the sheet and header lock need a reset
  if (/** @type {PageTransitionEvent} */ (e).persisted && sheet.isOpen()) sheet.close('resize');
});

/* ------------------------------------------------------------------ dock (filters + up) */
const dockIO = new IntersectionObserver(
  ([e]) => {
    const past = !e.isIntersecting && e.boundingClientRect.top < 0;
    if (past) el.dock.hidden = false;
    requestAnimationFrame(() => el.dock.classList.toggle('is-in', past));
  },
  { threshold: 0 },
);
dockIO.observe(el.bar);

/* ------------------------------------------------------------------ last successful sync (brief §3) */
api
  .meta()
  .then((m) => {
    el.syncTime.dateTime = m.lastSyncAt;
    el.syncTime.textContent = formatDateTime(m.lastSyncAt);
    if (m.stale) {
      // brief §3 / §14: the supplier API is unreachable — the catalogue keeps working from Rezar's own database,
      // shows how old the data is and does not claim the availability is confirmed
      el.sync.classList.add('is-stale');
      el.sync.querySelector('.label__text').firstChild.textContent = 'Дані станом на ';
      el.sync.insertAdjacentHTML('beforeend', '<span class="cat-sync__note">Оновлення з джерела затримується — наявність і ціну підтвердить менеджер.</span>');
    }
    el.sync.hidden = false;
  })
  .catch(() => {});

/* ------------------------------------------------------------------ go */
panel.set(applied);
syncUrl();
renderHead();
loadFirst({ restore: saved });
refreshFacets();
if (saved) clearCatalogState();
