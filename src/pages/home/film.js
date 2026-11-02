/**
 * «Шлях авто» — the home-page film (nbtire «Нічний рейс» language, re-cut for a car importer):
 *   I  Пошук      auction lots in the USA / dealers in Europe, coordinates type in
 *   II Перевірка  the 17 VIN characters decode segment by segment (WMI · VDS · VIS), checks tick in
 *   III Дорога    the route draws itself New Jersey → Klaipėda → Kyiv (+ Germany by road), km odometer, live «в дорозі»
 *   IV Ключі      the in-stock count rolls up like an odometer → catalog CTAs
 * One GSAP timeline (1 unit per act) scrubbed by a ScrollTrigger over the tall section; the stage is CSS-sticky,
 * so scrolling stays native on every device (no pin, no scroll-jacking). Acts change on hard cuts: shot swap under a
 * 3-frame white flash. The letterbox bars carry the HUD: REC, timecode (tracks the scrub), chapter, reel progress.
 * Under reduced motion / tier low the section stays four static stacked panels (film.css fallback).
 */
import { gsap, ScrollTrigger } from '../../core/scroll.js';
import { api } from '../../lib/api.js';
import { formatNumber } from '../../lib/format.js';
import { rollTo } from '../../motion/odometer.js';

const ACTS = 4;
const RUNTIME = 94; // seconds of «running time» the timecode maps the track onto
const KM = 8240; // New Jersey → Klaipėda by sea + Klaipėda → Kyiv by road, rounded
const CHAPTERS = ['Частина I · Пошук', 'Частина II · Перевірка', 'Частина III · Дорога', 'Частина IV · Ключі'];
const GLYPHS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЮЯ0123456789';

const $ = (s, r = document) => /** @type {HTMLElement|null} */ (r.querySelector(s));
const $$ = (s, r = document) => /** @type {HTMLElement[]} */ ([...r.querySelectorAll(s)]);

/** @param {{ reduced: boolean, tier: string, scroll: import('../../core/scroll.js').ScrollAPI }} ctx */
export function initFilm({ reduced, tier, scroll }) {
  const root = $('[data-film]');
  if (!root) return;

  let stock = Number($('[data-film-stock]', root)?.textContent.replace(/\D/g, '')) || 0;
  api
    .meta()
    .then((m) => {
      const c = m.counts ?? {};
      if (c.in_transit != null) $$('[data-film-transit]', root).forEach((el) => (el.textContent = formatNumber(c.in_transit)));
      if (c.in_stock != null) {
        stock = c.in_stock;
        const el = $('[data-film-stock]', root);
        if (el && !el.querySelector('.odo')) el.textContent = formatNumber(stock);
      }
    })
    .catch(() => {});

  if (reduced || tier === 'low') return;
  root.classList.add('is-live');

  const shots = $$('.film__shot', root);
  const acts = $$('.film__act', root);
  const flash = $('.film__flash', root);
  const tc = $('[data-film-tc]', root);
  const chapter = $('[data-film-chapter]', root);
  const reel = $$('.film__reel li', root);
  const sweep = $('.film__sweep', root);

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  tl.set({}, {}, ACTS); // fixed length: exactly one unit per act

  shots.forEach((shot, i) => {
    const img = shot.querySelector('img');
    // slow push-in + drift across each act: the long-lens «breathing» of the nbtire hero
    tl.fromTo(img, { scale: 1.16, xPercent: i % 2 ? 2 : -2 }, { scale: 1.02, xPercent: i % 2 ? -2 : 2, ease: 'none', duration: 1 }, i);
  });
  for (let i = 0; i < ACTS; i++) {
    tl.fromTo(sweep, { xPercent: -60, opacity: 0 }, { xPercent: 60, opacity: 1, duration: 0.3, ease: 'none', immediateRender: false }, i + 0.08);
    tl.to(sweep, { opacity: 0, duration: 0.15, ease: 'none' }, i + 0.38);
  }

  acts.forEach((act, i) => {
    const items = [...act.children];
    if (i > 0) tl.fromTo(items, { y: 48, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2, stagger: 0.035 }, i + 0.02);
    if (i < ACTS - 1) tl.to(items, { y: -36, opacity: 0, duration: 0.14, stagger: 0.02, ease: 'power2.in', immediateRender: false }, i + 0.84);
  });

  // I · coordinates type in
  tl.fromTo($$('.film__coords li', acts[0]), { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.12, stagger: 0.08 }, 0.12);

  // II · VIN decode: segment lights up, its leader line drops, its legend appears; then the checks
  $$('.vin__seg', acts[1]).forEach((seg, k) => {
    const at = 1.22 + k * 0.13;
    const leg = $(`.vin__legend li[data-seg="${k}"]`, acts[1]);
    tl.fromTo(seg, { '--k': 0, color: 'rgba(243,245,242,0.34)' }, { '--k': 1, color: '#ffffff', duration: 0.1, ease: 'none' }, at);
    if (leg) tl.fromTo(leg, { '--k': 0, opacity: 0, y: 8 }, { '--k': 1, opacity: 1, y: 0, duration: 0.1 }, at + 0.04);
  });
  tl.fromTo($$('.film__checks li', acts[1]), { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.08, stagger: 0.04 }, 1.62);

  // III · the route draws, the car rides it, the odometer counts
  const line = /** @type {SVGPathElement|null} */ (root.querySelector('[data-route]'));
  const eu = /** @type {SVGPathElement|null} */ (root.querySelector('[data-route-eu]'));
  const car = root.querySelector('[data-route-car]');
  const km = $('[data-film-km]', root);
  if (line && car) {
    const len = line.getTotalLength();
    const euLen = eu?.getTotalLength() ?? 0;
    gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
    if (eu) gsap.set(eu, { strokeDasharray: euLen, strokeDashoffset: euLen });
    const ride = { t: 0 };
    const place = () => {
      const p = line.getPointAtLength(ride.t * len);
      car.setAttribute('cx', p.x.toFixed(1));
      car.setAttribute('cy', p.y.toFixed(1));
      if (km) km.textContent = formatNumber(Math.round(ride.t * KM));
    };
    tl.to(line, { strokeDashoffset: 0, duration: 0.6, ease: 'none' }, 2.18);
    tl.to(ride, { t: 1, duration: 0.6, ease: 'none', onUpdate: place }, 2.18);
    if (eu) tl.to(eu, { strokeDashoffset: 0, duration: 0.3, ease: 'none' }, 2.46);
    const pts = $$('.route__pt', root);
    [2.16, 2.62, 2.44, 2.76].forEach((at, k) => pts[k] && tl.fromTo(pts[k], { opacity: 0 }, { opacity: 1, duration: 0.05 }, at));
  }

  // HUD + hard cuts follow the *rendered* timeline time (it lags the scroll by the scrub smoothing)
  let cur = -1;
  const pad = (n) => String(n).padStart(2, '0');
  const hud = () => {
    const t = tl.time();
    const idx = Math.min(ACTS - 1, Math.floor(t + 1e-4));
    if (idx !== cur) cut(idx);
    const secs = (t / ACTS) * RUNTIME;
    if (tc) tc.textContent = `00:${pad(Math.floor(secs / 60))}:${pad(Math.floor(secs % 60))}:${pad(Math.floor((secs % 1) * 24))}`;
    reel.forEach((li, i) => li.style.setProperty('--p', String(Math.max(0, Math.min(1, t - i)))));
  };
  tl.eventCallback('onUpdate', hud);

  let rolled = false;
  function cut(idx) {
    const first = cur === -1;
    cur = idx;
    shots.forEach((s, i) => s.classList.toggle('is-on', i === idx));
    acts.forEach((a, i) => a.classList.toggle('is-on', i === idx));
    if (!first && flash) {
      flash.classList.remove('is-cut');
      void flash.offsetWidth; // restart the 3-frame flash
      flash.classList.add('is-cut');
    }
    scramble(chapter, CHAPTERS[idx]);
    if (idx === ACTS - 1 && !rolled) {
      rolled = true;
      const el = $('[data-film-stock]', root);
      if (el) rollTo(el, stock);
    }
  }

  ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: 'bottom bottom',
    scrub: tier === 'high' ? 0.6 : true,
    animation: tl,
  });
  hud();

  // act I is on screen while the section scrolls in: its copy rises as the stage arrives
  gsap.fromTo(
    [...acts[0].children],
    { y: 56, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: root, start: 'top 72%', end: 'top 8%', scrub: 0.5 } },
  );

  $('[data-film-skip]', root)?.addEventListener('click', (e) => {
    const next = root.nextElementSibling;
    if (!next) return;
    e.preventDefault();
    scroll.scrollTo(next, { offset: -80 });
  });
}

/** mono «decode» swap of the chapter label: random glyphs settle left → right in ~8 frames */
function scramble(el, text) {
  if (!el) return;
  cancelAnimationFrame(Number(el.dataset.raf || 0));
  let frame = 0;
  const step = () => {
    frame++;
    const done = Math.floor((frame / 8) * text.length);
    el.textContent = [...text].map((ch, i) => (i < done || ch === ' ' || ch === '·' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    if (done < text.length) el.dataset.raf = String(requestAnimationFrame(step));
    else el.textContent = text;
  };
  step();
}
