/**
 * Common page boot — every page entry calls it first:
 *   import { boot } from '../../core/boot.js';
 *   const { tier, reduced, scroll } = boot();   // then page-specific init
 * Does: tier detection, Lenis + ScrollTrigger, header, mobile menu, click tracking, favourite badges, footer year +
 * last-sync line, accordions, reveals (+ counters), parallax, hero hooks. Safe to call once per page.
 * Pages that render content later (catalog cards, car page) call initReveals(container) / initParallax(container)
 * on what they added.
 */
import '../styles/main.css';
import { detectTier, prefersReducedMotion } from './tier.js';
import { initScroll } from './scroll.js';
import { initHeader } from '../ui/header.js';
import { initMenu } from '../ui/menu.js';
import { initTracking } from '../lib/track.js';
import { favorites } from '../lib/favorites.js';
import { initReveals } from '../motion/reveal.js';
import { initParallax } from '../motion/parallax.js';
import { initAccordions } from '../motion/accordion.js';
import { initHero } from '../motion/hero.js';

/** @param {{ reveals?: boolean }} [o] reveals:false when the page arms its own content later */
export function boot({ reveals = true } = {}) {
  const reduced = prefersReducedMotion();
  const tier = detectTier();
  const scroll = initScroll({ tier, reduced });
  initHeader();
  initMenu();
  initTracking();
  favorites.syncBadges();
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));
  initAccordions();
  initHero();
  if (reveals) initReveals();
  initParallax(document, { tier });
  fillLastSync();
  return { tier, reduced, scroll };
}

/** footer «Каталог оновлено 01.11.2026, 08:26» (brief §3: show the time of the last successful sync) */
function fillLastSync() {
  const el = document.querySelector('[data-last-sync]');
  if (!el) return;
  const run = () =>
    import('../lib/api.js')
      .then(({ api }) => api.meta())
      .then(async (m) => {
        const { formatDateTime } = await import('../lib/format.js');
        const t = el.querySelector('time');
        if (t) {
          t.dateTime = m.lastSyncAt;
          t.textContent = formatDateTime(m.lastSyncAt);
        }
        // brief §3: never present stale availability as confirmed — after a missed sync say so
        if (m.stale) {
          el.classList.add('is-stale');
          el.firstChild.textContent = 'Дані каталогу станом на ';
          el.insertAdjacentHTML('beforeend', ' · наявність уточнює менеджер');
        }
        el.hidden = false;
      })
      .catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}
