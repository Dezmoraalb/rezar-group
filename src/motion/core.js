/**
 * Shared motion core (vanilla port of VELAR motion/core.ts). Every motion hook imports from here:
 *   reduced()            true under prefers-reduced-motion (html.reduced, set before first paint)
 *   desktop()            ≥1024 with a fine pointer that hovers
 *   inViewNow(el)        the element already intersects the first screen (shown at once, never animated)
 *   onEnter(el, fn, io?) run fn once when el enters the viewport (one shared IntersectionObserver per option set)
 *   flushEnters()        run every pending onEnter job now (beforeprint)
 *   onScrollFrame(fn)    fn(scrollY) once per animation frame while the page scrolls (one passive listener)
 *   splitWords(el)       wrap every word of a heading in a mask: <span class="mw"><span class="mw__i">word</span></span>
 *   markLines(el)        give each word its line index (--i) from the current layout, for a line-by-line stagger
 *   drawable(svg)        give every stroke shape pathLength=1, so CSS can draw it with stroke-dashoffset 1 → 0
 * The HTML is always the final frame: hooks only add classes/styles, and only when motion is allowed.
 */
const html = document.documentElement;
export const reduced = () => html.classList.contains('reduced');
export const desktop = () => matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;

/** @param {Element} el */
export function inViewNow(el) {
  const r = el.getBoundingClientRect();
  return r.top < innerHeight && r.bottom > 0 && r.width > 0;
}

const jobs = new WeakMap();
const pending = new Set();
const observers = new Map();
const DEFAULT_IO = { threshold: 0, rootMargin: '0px 0px -12% 0px' };
function observer(opts) {
  const key = `${opts.rootMargin ?? ''}|${String(opts.threshold ?? 0)}`;
  let io = observers.get(key);
  if (io) return io;
  io = new IntersectionObserver((entries, self) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      self.unobserve(e.target);
      run(e.target);
    }
  }, opts);
  observers.set(key, io);
  return io;
}
function run(el) {
  const fn = jobs.get(el);
  jobs.delete(el);
  pending.delete(el);
  fn?.();
}

/** @param {Element} el @param {() => void} fn @param {IntersectionObserverInit} [opts] */
export function onEnter(el, fn, opts = DEFAULT_IO) {
  if (!('IntersectionObserver' in window)) return fn();
  jobs.set(el, fn);
  pending.add(el);
  observer(opts).observe(el);
}

export function flushEnters() {
  observers.forEach((o) => pending.forEach((el) => o.unobserve(el)));
  Array.from(pending).forEach(run);
}

const scrollFns = new Set();
let ticking = 0;
const tick = () => {
  ticking = 0;
  const y = scrollY;
  for (const fn of scrollFns) fn(y);
};
const onScroll = () => {
  if (!ticking) ticking = requestAnimationFrame(tick);
};
/** @param {(y: number) => void} fn @returns {() => void} */
export function onScrollFrame(fn) {
  if (!scrollFns.size) {
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
  }
  scrollFns.add(fn);
  fn(scrollY);
  return () => {
    scrollFns.delete(fn);
    if (!scrollFns.size) {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    }
  };
}

// split on ordinary whitespace only: non-breaking spaces («$ 24 500», «3 години») keep their words together
const WS = /([ \t\n\r]+)/;
/** @param {HTMLElement} el */
export function splitWords(el) {
  if (el.dataset.split === 'done') return;
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent ?? '').split(WS);
        if (parts.every((p) => !p.trim())) continue;
        const frag = document.createDocumentFragment();
        for (const p of parts) {
          if (!p) continue;
          if (!p.trim()) {
            frag.append(' ');
            continue;
          }
          const mask = document.createElement('span');
          mask.className = 'mw';
          const inner = document.createElement('span');
          inner.className = 'mw__i';
          inner.textContent = p;
          mask.append(inner);
          frag.append(mask);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && !child.matches('.sr-only, svg, br')) {
        walk(child);
      }
    }
  };
  walk(el);
  el.dataset.split = 'done';
}

/** @param {HTMLElement} el @returns {number} line count */
export function markLines(el) {
  let line = -1;
  let last = -Infinity;
  el.querySelectorAll('.mw').forEach((w) => {
    const top = /** @type {HTMLElement} */ (w).offsetTop;
    if (top > last + 2) {
      line++;
      last = top;
    }
    /** @type {HTMLElement} */ (w).style.setProperty('--i', String(line));
  });
  el.style.setProperty('--lines', String(line + 1));
  return line + 1;
}

const SHAPES = 'path, circle, rect, line, polyline, polygon, ellipse';
/** @param {SVGElement} svg */
export function drawable(svg) {
  svg.querySelectorAll(SHAPES).forEach((s, i) => {
    s.setAttribute('pathLength', '1');
    /** @type {SVGElement} */ (s).style.setProperty('--n', String(i));
  });
}
