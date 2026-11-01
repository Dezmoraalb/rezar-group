/**
 * Home page micro-motion (VELAR-calm, desktop-first, everything opt-out under reduced motion / tier low):
 *   read      the about statement «reads itself»: words go from faint to full as it scrolls through (GSAP scrub)
 *   drift     the hero photo follows the pointer by a few pixels (`translate`, overscan in home.css)
 *   magnetic  [data-magnetic] buttons lean towards the pointer (≤ 6 px, eased `translate`)
 *   spotlight [data-spot] cards get a soft light under the pointer (--mx / --my)
 *   prefetch  hovering a [data-prefetch] link warms the catalog data
 */
import { gsap } from '../../core/scroll.js';
import { desktop, splitWords } from '../../motion/core.js';

const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/** @param {{ tier: string, reduced: boolean }} ctx */
export function initFx({ tier, reduced }) {
  prefetch();
  if (reduced || tier === 'low') return;
  readOnScroll();
  if (!fine()) return;
  magnetic();
  spotlight();
  if (desktop()) heroDrift();
}

/* ---------- read: words fade up as the statement scrolls through ---------- */
function readOnScroll() {
  document.querySelectorAll('[data-read]').forEach((el) => {
    splitWords(/** @type {HTMLElement} */ (el));
    const words = el.querySelectorAll('.mw__i');
    if (!words.length) return;
    gsap.fromTo(
      words,
      { opacity: 0.16 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.12,
        scrollTrigger: { trigger: el, start: 'top 86%', end: 'bottom 52%', scrub: 0.4 },
      },
    );
  });
}

/* ---------- hero: the photo follows the pointer ---------- */
function heroDrift() {
  const hero = document.querySelector('.home-hero');
  const img = hero?.querySelector('.hero__img');
  if (!hero || !img) return;
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let raf = 0;
  const step = () => {
    x += (tx - x) * 0.06;
    y += (ty - y) * 0.06;
    /** @type {HTMLElement} */ (img).style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(step) : 0;
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * -28;
    ty = ((e.clientY - r.top) / r.height - 0.5) * -16;
    kick();
  });
  hero.addEventListener('pointerleave', () => {
    tx = 0;
    ty = 0;
    kick();
  });
}

/* ---------- magnetic buttons ---------- */
function magnetic() {
  document.querySelectorAll('[data-magnetic]').forEach((node) => {
    const el = /** @type {HTMLElement} */ (node);
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const step = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(step) : 0;
      if (!raf && !tx && !ty) el.style.translate = '';
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      tx = Math.max(-1, Math.min(1, dx)) * 6;
      ty = Math.max(-1, Math.min(1, dy)) * 4;
      kick();
    });
    el.addEventListener('pointerleave', () => {
      tx = 0;
      ty = 0;
      kick();
    });
  });
}

/* ---------- spotlight cards ---------- */
function spotlight() {
  document.querySelectorAll('[data-spot]').forEach((node) => {
    const el = /** @type {HTMLElement} */ (node);
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
      el.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
    });
  });
}

/* ---------- warm the catalog data on intent ---------- */
function prefetch() {
  let done = false;
  const warm = () => {
    if (done) return;
    done = true;
    import('../../lib/api.js').then(({ api }) => api.prefetch()).catch(() => {});
  };
  document.querySelectorAll('[data-prefetch]').forEach((a) => {
    a.addEventListener('pointerenter', warm, { once: true, passive: true });
    a.addEventListener('focus', warm, { once: true });
    a.addEventListener('touchstart', warm, { once: true, passive: true });
  });
}
