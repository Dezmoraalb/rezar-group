/**
 * Scroll system (ported from the nbtire reference): Lenis + GSAP ScrollTrigger.
 *
 * - Lenis smooth scroll on fine pointers only, never on tier 'low' or under reduced motion.
 * - Lenis is driven by gsap.ticker; ScrollTrigger updates on every Lenis scroll.
 * - Touch devices: native scroll + ScrollTrigger.config({ ignoreMobileResize: true }).
 * Every module that needs scrolling uses getScroll() (never `new Lenis`).
 *
 * @typedef {Object} ScrollAPI
 * @property {import('lenis').default|null} lenis
 * @property {(target: string|Element|number, opts?: {offset?: number, duration?: number, immediate?: boolean, onComplete?: () => void}) => void} scrollTo
 * @property {() => void} stop     freeze scrolling (sheets, dialogs)
 * @property {() => void} start    resume scrolling
 * @property {() => void} resize   re-measure after the page height changed (infinite scroll appends)
 * @property {(fn: (y: number) => void) => () => void} onScroll  subscribe; returns unsubscribe
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

/** @type {ScrollAPI|null} */
let api = null;
export const getScroll = () => api;

/**
 * One debounced ScrollTrigger.refresh for everything that settles during load (fonts, images, appended cards).
 * Never lands mid-gesture.
 */
let refreshT = 0;
let lastInput = 0;
const markInput = () => (lastInput = performance.now());
['scroll', 'touchstart', 'touchmove'].forEach((e) => addEventListener(e, markInput, { passive: true }));
export function requestRefresh() {
  clearTimeout(refreshT);
  refreshT = window.setTimeout(() => {
    const run = () => {
      if (performance.now() - lastInput < 250) {
        refreshT = window.setTimeout(requestRefresh, 200);
        return;
      }
      ScrollTrigger.refresh();
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 300 });
    else run();
  }, 120);
}

/**
 * @param {{ tier?: 'high'|'mid'|'low', reduced?: boolean }} [opts]
 * @returns {ScrollAPI}
 */
export function initScroll({ tier = 'high', reduced = false } = {}) {
  if (api) return api;
  const fine = matchMedia('(pointer: fine)').matches;
  const useLenis = fine && !reduced && tier !== 'low';
  ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,resize' });

  /** @type {Lenis|null} */
  let lenis = null;
  if (useLenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -96 } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add('lenis-on');
  } else {
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(scrollY));
  if (lenis) lenis.on('scroll', emit);
  else addEventListener('scroll', emit, { passive: true });

  api = {
    lenis,
    scrollTo(target, { offset = 0, duration, immediate = false, onComplete } = {}) {
      if (lenis) {
        lenis.scrollTo(/** @type {any} */ (target), {
          offset,
          duration: duration ?? 1.2,
          immediate,
          easing: (t) => 1 - Math.pow(1 - t, 4),
          onComplete: onComplete ? () => onComplete() : undefined,
        });
        return;
      }
      let y;
      if (typeof target === 'number') y = target;
      else {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return;
        y = el.getBoundingClientRect().top + scrollY;
      }
      window.scrollTo({ top: y + offset, behavior: immediate || reduced ? 'auto' : 'smooth' });
      if (onComplete) setTimeout(onComplete, immediate ? 0 : 700);
    },
    stop: () => {
      if (lenis) lenis.stop();
      document.documentElement.classList.add('is-scroll-locked');
    },
    start: () => {
      if (lenis) lenis.start();
      document.documentElement.classList.remove('is-scroll-locked');
    },
    resize: () => {
      lenis?.resize();
      requestRefresh();
    },
    onScroll(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  document.fonts?.ready.then(() => requestRefresh());
  addEventListener('load', () => requestRefresh(), { once: true });
  return api;
}
