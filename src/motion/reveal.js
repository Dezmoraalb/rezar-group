/**
 * Scroll reveals (vanilla port of VELAR motion/reveal.ts). styles/motion.css holds every from/to state; this file
 * only arms elements and flips .is-in.
 *   headings             main .t-h1/.t-h2/.t-statement or [data-split]: words rise line by line inside masks
 *   [data-reveal]        the block rises; if it holds a split heading, the heading leads and its siblings follow
 *   [data-reveal-group]  its children rise with a stagger (60ms, capped at 300ms)
 *   [data-reveal-media]  a photo frame unclips while the picture settles from a slight zoom
 *   .label               the lime dot pops, the text slides in
 *   [data-draw] > svg    line icons draw their strokes
 *   .band / [data-band]  ink bands open from a rounded card to full bleed
 *   [data-count]         the number rolls up to its value (count.js)
 * Elements already on the first screen at load are left as they are. Reduced motion / no IntersectionObserver:
 * nothing is armed (no html.mo), the page stays static and complete.
 * Content added later (infinite scroll): call initReveals(container) again — it only arms what it finds inside.
 */
import { drawable, flushEnters, inViewNow, markLines, onEnter, reduced, splitWords } from './core.js';
import { initCounters } from './count.js';

const HEADINGS = ':is(.t-h1, .t-h2, .t-statement, [data-split]):not(.hero *, .phero *, [data-nosplit])';
const BLOCKS = '[data-reveal], [data-reveal-group]';
const LABELS = '.label:not(.hero *, .phero *, [data-noreveal])';
const MEDIA = '[data-reveal-media]';
const ICONS = '[data-draw] > svg';
const BANDS = ':is(.band, [data-band])';

const done = (el) => setTimeout(() => el.classList.add('is-done'), 2200);

function arm(el, cls, onIn, io) {
  el.classList.add(cls);
  onEnter(
    el,
    () => {
      onIn?.();
      el.classList.add('is-in');
      done(el);
    },
    io,
  );
}

function revealHeading(h) {
  markLines(h);
  h.classList.add('is-in');
}

const html = document.documentElement;
let printHooked = false;

/** @param {ParentNode} [root] */
export function initReveals(root = document) {
  if (reduced() || !('IntersectionObserver' in window)) return;
  html.classList.add('mo');
  try {
    arming(root);
  } catch (err) {
    html.classList.remove('mo');
    throw err;
  }
  if (!printHooked) {
    printHooked = true;
    addEventListener('beforeprint', () => {
      flushEnters();
      html.classList.remove('mo');
    });
    addEventListener('afterprint', () => html.classList.add('mo'));
  }
}

function arming(root) {
  const all = (sel) => Array.from(root.querySelectorAll(sel));
  const scope = (sel) => (root === document ? `main ${sel}` : sel);

  const led = new Set();
  for (const h of all(scope(HEADINGS))) {
    if (h.dataset.split === 'done' || inViewNow(h) || !h.textContent?.trim()) continue;
    splitWords(h);
    h.classList.add('rv-split');
    const block = h.closest('[data-reveal]');
    if (block && !inViewNow(block)) {
      led.add(block);
      block.classList.add('rv-seq');
      let n = 0;
      for (const c of Array.from(block.children)) {
        if (c === h || c.contains(h)) continue;
        c.classList.add('rv-after');
        c.style.setProperty('--n', String(n++));
      }
    } else {
      onEnter(h, () => revealHeading(h));
    }
  }

  for (const el of all(BLOCKS)) {
    if (el.classList.contains('is-in') || el.dataset.armed) continue;
    el.dataset.armed = '1';
    if (inViewNow(el)) {
      el.classList.add('is-now', 'is-in');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.classList.add('is-done');
          el.classList.remove('is-now');
        }),
      );
      continue;
    }
    onEnter(el, () => {
      if (led.has(el)) el.querySelectorAll('.rv-split').forEach(revealHeading);
      el.classList.add('is-in');
      done(el);
    });
  }

  const below = (sel) => all(sel).filter((el) => !inViewNow(el) && !el.classList.contains('is-in'));
  below(scope(LABELS)).forEach((el) => arm(el, 'rv-label'));
  below(MEDIA).forEach((el) => arm(el, 'rv-media'));
  below(scope(BANDS)).forEach((el) => arm(el, 'rv-band'));
  for (const svg of below(ICONS)) {
    drawable(svg);
    arm(svg, 'rv-draw', () => setTimeout(() => svg.classList.add('drawn'), 1800));
  }
  initCounters(root);
}
