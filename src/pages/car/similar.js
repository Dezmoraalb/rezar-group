/**
 * «Схожі автомобілі» on a sold car's page (brief §16).
 *
 *   mountSimilar(section, car, { first, scroll, now }) → Promise<number>  (total candidates; 0 → block stays hidden)
 *
 * Only in_stock / in_transit cars (api.similar never returns sold ones), tiers never mixed, pages of ≤ 12,
 * keyset cursor → no duplicates and a stable order while loading. The next page is prefetched as soon as the
 * previous one is on screen and appended when the sentinel comes within ~1200 px of the viewport.
 * Cards rise as they scroll into view (not when appended off screen), staggered by column.
 */
import { api } from '../../lib/api.js';
import { appendCards, cardSkeletonHTML } from '../../lib/card.js';
import { plural } from '../../lib/format.js';
import { inViewNow, onEnter } from '../../motion/core.js';
import { requestRefresh } from '../../core/scroll.js';

const AHEAD = 1200;
const html = document.documentElement;

const cols = () => (matchMedia('(min-width: 1024px)').matches ? 3 : 2);

/** cards rise into view one row at a time (only when the reveal system is armed: html.mo) */
function armCards(els) {
  if (!html.classList.contains('mo')) return;
  const c = cols();
  els.forEach((el, i) => {
    if (inViewNow(el)) return;
    el.classList.add('sim-pend');
    el.style.setProperty('--c', String(i % c));
    onEnter(el, () => {
      el.classList.add('is-in');
      setTimeout(() => el.classList.remove('sim-pend', 'is-in'), 1400);
    });
  });
}

/**
 * @param {HTMLElement} section
 * @param {object} car
 * @param {{ first?: Promise<object>, scroll?: { resize(): void }, now: Date }} o
 * @returns {Promise<number>}
 */
export async function mountSimilar(section, car, { first, scroll, now }) {
  const grid = section.querySelector('[data-similar-grid]');
  const sentinel = section.querySelector('[data-similar-sentinel]');
  const meta = section.querySelector('[data-similar-meta]');
  const page = await (first ?? api.similar(car.id));
  if (!page.total || !page.items.length) {
    section.hidden = true;
    return 0;
  }

  const seen = new Set();
  const fresh = (items) => items.filter((c) => c.status !== 'sold' && !seen.has(c.id) && seen.add(c.id));
  const opts = { now, place: 'similar', animate: false };

  section.hidden = false;
  meta.textContent = `${page.total} ${plural(page.total, ['авто', 'авто', 'авто'])} в наявності та в дорозі · підібрано за маркою, класом, ціною й роком`;
  armCards(appendCards(grid, fresh(page.items), opts));

  let cursor = page.nextCursor;
  /** @type {Promise<object>|null} */
  let nextP = cursor ? api.similar(car.id, { cursor }) : null;
  let busy = false;

  async function more() {
    if (busy || !nextP) return;
    busy = true;
    const pending = nextP;
    let settled = false;
    pending.then(() => (settled = true), () => (settled = true));
    // skeletons only if the prefetched page is not in yet
    await Promise.resolve();
    let sk = [];
    if (!settled) {
      const tpl = document.createElement('template');
      tpl.innerHTML = Array.from({ length: cols() }, cardSkeletonHTML).join('');
      sk = Array.from(tpl.content.children);
      grid.append(tpl.content);
    }
    try {
      const p = await pending;
      sk.forEach((el) => el.remove());
      armCards(appendCards(grid, fresh(p.items), opts));
      cursor = p.nextCursor;
      nextP = cursor ? api.similar(car.id, { cursor }) : null;
    } catch {
      sk.forEach((el) => el.remove());
      nextP = cursor ? api.similar(car.id, { cursor }) : null; // retry on the next intersection
    } finally {
      busy = false;
    }
    scroll?.resize();
    requestRefresh();
    if (!nextP) io.disconnect();
    else if (sentinel.getBoundingClientRect().top < innerHeight + AHEAD) requestAnimationFrame(more);
  }

  const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more(), {
    rootMargin: `0px 0px ${AHEAD}px 0px`,
  });
  if (nextP) io.observe(sentinel);
  return page.total;
}
