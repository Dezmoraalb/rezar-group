/**
 * Mechanical odometer roll (port of nbtire ui/odometer.js, trimmed): every digit is a column of 0–9 twice over,
 * rolled with yPercent; separators stay static. The first roll spins the low digits an extra turn, like a counter.
 *   rollTo(el, 637)          → Promise, resolves when the roll ends
 * Screen readers get the final value from a visually hidden twin; under reduced motion the text is just set.
 */
import { gsap } from '../core/scroll.js';
import { formatNumber } from '../lib/format.js';
import { reduced } from './core.js';

const CELLS = 20;

/** @param {HTMLElement} el @param {number} value @param {{duration?: number}} [o] */
export function rollTo(el, value, { duration = 1.4 } = {}) {
  const text = formatNumber(value);
  if (reduced()) {
    el.textContent = text;
    return Promise.resolve();
  }
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const box = document.createElement('span');
  box.className = 'odo';
  box.setAttribute('aria-hidden', 'true');
  const strips = [];
  [...text].forEach((ch) => {
    if (ch < '0' || ch > '9') {
      box.append(ch);
      return;
    }
    const col = document.createElement('span');
    col.className = 'odo__col';
    const strip = document.createElement('span');
    strip.className = 'odo__strip';
    strip.innerHTML = Array.from({ length: CELLS }, (_, i) => `<span>${i % 10}</span>`).join('');
    col.append(strip);
    box.append(col);
    strips.push({ strip, d: Number(ch) });
  });
  el.append(sr, box);
  const n = strips.length;
  return new Promise((resolve) => {
    strips.forEach(({ strip, d }, i) => {
      // low digits travel through one extra turn (10 + d cells), the leading one lands straight on its digit
      const cell = i === 0 ? d : 10 + d;
      gsap.fromTo(
        strip,
        { yPercent: 0 },
        {
          yPercent: (-100 * cell) / CELLS,
          duration: duration * (0.7 + (0.3 * i) / Math.max(1, n - 1)),
          ease: 'expo.out',
          onComplete: i === n - 1 ? resolve : undefined,
        },
      );
    });
    if (!n) resolve();
  });
}
