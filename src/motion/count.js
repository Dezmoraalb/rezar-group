/**
 * Number rolls (vanilla port of VELAR motion/count.ts): <p data-count>1 200+</p> rolls ~70% → 1 200 when it comes on
 * screen (0.9 s, ease-out expo). Until then the digits wait just below a clip line; the DOM keeps the FINAL value
 * until the roll starts (scrolling past, print, copy-paste and screen readers always get the real number).
 * The first number in the text rolls; the rest («+», «км», «$») stays put. Grouping keeps the original separator.
 * Without JS, under reduced motion or on the first screen nothing changes.
 */
import { inViewNow, onEnter } from './core.js';

const NUM = /\d[\d   ]*\d|\d/;
const DUR = 900;
const FROM = 0.7;
const fmt = (n, sep) => (sep ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep) : String(n));
const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

let printing = false;
const live = new Map();
const waiting = new Set();
let hooked = false;

/** @param {ParentNode} [root] */
export function initCounters(root = document) {
  if (!hooked) {
    hooked = true;
    addEventListener('beforeprint', () => {
      printing = true;
      waiting.forEach((w) => w.classList.remove('is-wait'));
      waiting.clear();
      live.forEach((settle) => settle());
    });
    addEventListener('afterprint', () => (printing = false));
  }
  root.querySelectorAll('[data-count]').forEach((el) => {
    if (el.dataset.counted || inViewNow(el)) return;
    el.dataset.counted = '1';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = null;
    let m = null;
    while ((node = walker.nextNode())) {
      m = NUM.exec(node.data);
      if (m) break;
    }
    if (!node || !m) return;
    const raw = m[0];
    const target = Number(raw.replace(/\D/g, ''));
    if (!Number.isFinite(target) || target < 10) return;
    const sep = raw.match(/[   ]/)?.[0] ?? '';
    const after = node.splitText(m.index);
    after.splitText(raw.length);
    const span = document.createElement('span');
    span.className = 'cnt is-wait';
    const digits = document.createElement('span');
    digits.className = 'cnt__i';
    digits.textContent = raw;
    span.append(digits);
    after.replaceWith(span);
    waiting.add(span);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = raw;
    const settle = () => {
      digits.textContent = raw;
      span.classList.remove('is-wait');
      waiting.delete(span);
      span.style.minInlineSize = '';
      span.removeAttribute('aria-hidden');
      sr.remove();
      live.delete(span);
    };
    onEnter(
      el,
      () => {
        if (printing) return settle();
        live.set(span, settle);
        span.setAttribute('aria-hidden', 'true');
        span.after(sr);
        span.style.minInlineSize = `${span.getBoundingClientRect().width}px`;
        const start = Math.round(target * FROM);
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / DUR);
          if (t < 1 && !printing) {
            digits.textContent = fmt(Math.round(start + (target - start) * ease(t)), sep);
            requestAnimationFrame(step);
          } else settle();
        };
        digits.textContent = fmt(start, sep);
        span.classList.remove('is-wait');
        waiting.delete(span);
        requestAnimationFrame(step);
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );
  });
}
