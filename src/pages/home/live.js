/**
 * Live data on the home page — the same client API the catalog uses (src/lib/api.js), so it keeps working unchanged
 * when the real Rezar backend replaces the static JSON.
 *   meta (small, right away)       hero pill (in stock / in transit), about figures, «Оновлено 01.11.2026, 08:26»
 *   catalog (52 KB gz, lazily)     the 8 newest cars, make chips with counts, «нових за 14 днів», total on the button
 * The catalog loads when the teaser comes within ~1.5 screens or the browser is idle after `load` — never before
 * the hero (LCP) has painted. The HTML carries sensible fallback numbers, so without JS nothing is empty.
 */
import { api, DEFAULT_FILTERS } from '../../lib/api.js';
import { appendCards, cardSkeletonHTML } from '../../lib/card.js';
import { formatDateTime, formatNumber, plural } from '../../lib/format.js';
import { catalogUrl } from '../../lib/env.js';
import { initCounters } from '../../motion/count.js';
import { inViewNow, onEnter } from '../../motion/core.js';

const TEASER = 8;
const MAKES = 10;
const $ = (s, r = document) => /** @type {HTMLElement|null} */ (r.querySelector(s));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** @param {{ reduced: boolean, scroll: import('../../core/scroll.js').ScrollAPI }} ctx */
export function initLive({ reduced, scroll }) {
  api
    .meta()
    .then((m) => {
      const c = m.counts ?? {};
      setLive('in_stock', c.in_stock);
      setLive('in_transit', c.in_transit);
      setFig('in_stock', c.in_stock, reduced);
      setFig('in_transit', c.in_transit, reduced);
      if (m.makes?.length) setFig('makes', m.makes.length, reduced);
      const sync = $('[data-teaser-sync]');
      const t = sync?.querySelector('time');
      if (sync && t && m.lastSyncAt) {
        // brief §3: show the time of the last successful sync (exact, Kyiv time)
        t.dateTime = m.lastSyncAt;
        t.textContent = formatDateTime(m.lastSyncAt);
        if (m.stale) {
          sync.classList.add('is-stale');
          sync.querySelector('span').firstChild.textContent = 'Дані станом на ';
        }
        sync.hidden = false;
      }
    })
    .catch(() => {});

  const rail = $('[data-teaser]');
  if (!rail) return;
  rail.innerHTML = Array.from({ length: TEASER }, cardSkeletonHTML).join('');

  let started = false;
  const load = () => {
    if (started) return;
    started = true;
    teaser(rail, { reduced, scroll });
  };
  const near = new IntersectionObserver(
    (es) => {
      if (es.some((e) => e.isIntersecting)) {
        near.disconnect();
        load();
      }
    },
    { rootMargin: '150% 0px' },
  );
  near.observe(rail);
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(load, { timeout: 3000 }) : setTimeout(load, 1500));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}

/* ---------- the teaser ---------- */
async function teaser(rail, { reduced, scroll }) {
  rail.setAttribute('aria-busy', 'true');
  try {
    const [page, facets] = await Promise.all([api.query({ ...DEFAULT_FILTERS }, { limit: TEASER }), api.facets({ ...DEFAULT_FILTERS })]);
    rail.innerHTML = '';
    if (!page.items.length) {
      rail.innerHTML = stateHTML('Каталог оновлюється', 'Свіжі авто з’являться після найближчої синхронізації о 08:00 або 20:00.');
    } else {
      const animate = !reduced && document.documentElement.classList.contains('mo');
      const els = appendCards(rail, page.items, { now: api.now(), place: 'home', animate: false });
      if (animate) enter(rail, els);
    }
    const total = $('[data-teaser-total]');
    if (total && page.total) total.textContent = ` · ${formatNumber(page.total)} ${plural(page.total, ['авто', 'авто', 'авто'])}`;
    setFig('new', facets.sections?.new, reduced);
    makes(facets.makes ?? [], reduced);
  } catch (err) {
    console.error('[home] teaser', err);
    rail.innerHTML = stateHTML('Не вдалося завантажити авто', 'Перевірте з’єднання й спробуйте ще раз.', true);
    rail.querySelector('[data-retry]')?.addEventListener('click', () => teaser(rail, { reduced, scroll }), { once: true });
  } finally {
    rail.setAttribute('aria-busy', 'false');
    scroll.resize();
  }
}

/** cards rise in when the rail comes on screen (or right away when it already is) */
function enter(rail, els) {
  const go = () => {
    rail.classList.remove('is-wait');
    els.forEach((el, i) => {
      el.classList.add('card--enter');
      el.style.setProperty('--k', String(i));
      el.addEventListener('animationend', () => el.classList.remove('card--enter'), { once: true });
    });
  };
  if (inViewNow(rail)) return go();
  rail.classList.add('is-wait');
  onEnter(rail, go, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
}

function stateHTML(title, text, retry = false) {
  return `<div class="state"><p class="state__title">${title}</p><p class="state__text">${text}</p>${
    retry ? '<button class="btn btn--outline btn--sm" type="button" data-retry><span class="btn__label">Спробувати ще раз</span></button>' : ''
  }</div>`;
}

/* ---------- make chips (counts = the default catalog view: in stock + in transit) ---------- */
function makes(list, reduced) {
  const nav = $('[data-makes]');
  if (!nav || !list.length) return;
  const top = [...list].sort((a, b) => b.count - a.count || a.make.localeCompare(b.make)).slice(0, MAKES);
  nav.innerHTML =
    top
      .map(
        (m) =>
          `<a class="chip" href="${catalogUrl(`?make=${encodeURIComponent(m.make)}`)}">${esc(m.make)} <span class="home-makes__n">${formatNumber(m.count)}</span></a>`,
      )
      .join('') +
    `<a class="chip chip--all" href="${catalogUrl()}">Усі марки<svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>`;
  nav.hidden = false;
  if (!reduced) nav.classList.add('is-new');
}

/* ---------- numbers ---------- */
function setLive(key, value) {
  if (value == null) return;
  document.querySelectorAll(`[data-live="${key}"]`).forEach((el) => (el.textContent = formatNumber(value)));
}

/**
 * About figures: replace the fallback with the live value; if the figure is still below the fold it rolls up when it
 * arrives (count.js), otherwise it simply changes.
 */
function setFig(key, value, reduced) {
  if (value == null) return;
  document.querySelectorAll(`[data-fig="${key}"]`).forEach((node) => {
    const el = /** @type {HTMLElement} */ (node);
    if (el.dataset.counted) return; // already rolling / rolled with an earlier value
    el.textContent = formatNumber(value);
    if (reduced || inViewNow(el) || value < 10) return;
    el.setAttribute('data-count', '');
    if (el.parentElement) initCounters(el.parentElement);
  });
}
