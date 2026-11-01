/**
 * «Етапи замовлення» — the six steps of buying a car «в дорозі».
 *
 *   pinned  (≥1024 wide & ≥700 tall, fine pointer or not): the section pins for ~half a screen per step; the scroll
 *           walks through the steps — the active one opens (the others show their titles), its dot turns lime, the
 *           rail fills to the next dot, the big counter rolls 01 → 06. Clicking a step scrolls to it.
 *   flow    (phones, tablets, short screens): no pin; the rail fills as the list passes the 62 % line and each dot
 *           lights up when the fill reaches it. All texts stay open.
 *   static  (no JS, reduced motion, tier low): a complete list with a solid rail — nothing hidden.
 */
import { gsap, ScrollTrigger, requestRefresh } from '../../core/scroll.js';

const LINE = 62; // % of the viewport where a flow step «arrives»

/** @param {{ tier: string, reduced: boolean, scroll: import('../../core/scroll.js').ScrollAPI }} ctx */
export function initSteps({ tier, reduced, scroll }) {
  const sec = /** @type {HTMLElement|null} */ (document.querySelector('[data-steps]'));
  if (!sec || reduced || tier === 'low') return;
  const list = /** @type {HTMLElement} */ (sec.querySelector('[data-steps-list]'));
  const items = /** @type {HTMLElement[]} */ (Array.from(sec.querySelectorAll('[data-step]')));
  const mores = items.map((el) => /** @type {HTMLElement} */ (el.querySelector('.hstep__more')));
  const digits = /** @type {HTMLElement|null} */ (sec.querySelector('[data-steps-digits]'));
  const n = items.length;
  if (!list || n < 2) return;
  sec.classList.add('is-live');

  let cur = -2;
  const setActive = (i) => {
    if (i === cur) return;
    cur = i;
    items.forEach((el, k) => {
      el.classList.toggle('is-active', k === i);
      el.classList.toggle('is-past', k < i);
    });
    if (digits) digits.style.setProperty('--si', String(Math.max(0, i)));
  };
  const fill = (px) => list.style.setProperty('--fill-px', `${Math.max(0, px).toFixed(1)}px`);

  const mm = gsap.matchMedia();

  mm.add('(min-width: 1024px) and (min-height: 700px)', () => {
    sec.classList.add('is-pinned');
    setActive(0);
    /** collapsed height of every step = its height minus the rendered part of its (animating) text */
    const heads = () => items.map((el, k) => el.offsetHeight - (mores[k]?.offsetHeight ?? 0));
    const st = ScrollTrigger.create({
      trigger: sec,
      start: 'top top',
      end: () => `+=${Math.round(innerHeight * 0.55 * n)}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        const raw = Math.min(n - 0.0001, p * n);
        const i = Math.floor(raw);
        setActive(i);
        sec.style.setProperty('--p', p.toFixed(4));
        // the fill reaches dot i+1 exactly when step i+1 becomes active (steps above the active one are collapsed)
        const h = heads();
        let px = 0;
        for (let k = 0; k < i; k++) px += h[k];
        const max = h.slice(0, n - 1).reduce((a, b) => a + b, 0);
        fill(Math.min(max, px + (raw - i) * (h[i] ?? 0)));
      },
    });
    const onClick = (e) => {
      const li = /** @type {Element} */ (e.target).closest?.('[data-step]');
      if (!li) return;
      const i = items.indexOf(/** @type {HTMLElement} */ (li));
      if (i < 0) return;
      scroll.scrollTo(st.start + ((i + 0.35) / n) * (st.end - st.start), { duration: 1 });
    };
    list.addEventListener('click', onClick);
    requestRefresh();
    return () => {
      list.removeEventListener('click', onClick);
      sec.classList.remove('is-pinned');
      sec.style.removeProperty('--p');
    };
  });

  mm.add('(max-width: 1023px), (max-height: 699px)', () => {
    setActive(-1);
    fill(0);
    const offs = () => items.map((el) => el.offsetTop - items[0].offsetTop);
    const dot0 = /** @type {HTMLElement|null} */ (items[0].querySelector('.hstep__dot'));
    // y of the first dot's centre inside the list (the list and the steps are positioned)
    const dy = () => items[0].offsetTop + (dot0 ? dot0.offsetTop + dot0.offsetHeight / 2 : 0);
    let o = offs();
    ScrollTrigger.create({
      trigger: list,
      start: () => `top+=${Math.round(dy())} ${LINE}%`,
      end: () => `top+=${Math.round(dy() + o[n - 1])} ${LINE}%`,
      invalidateOnRefresh: true,
      onRefresh: () => (o = offs()),
      onUpdate: (self) => {
        const px = self.progress * o[n - 1];
        fill(px);
        let a = -1;
        for (let k = 0; k < n; k++) if (o[k] <= px + 2) a = k;
        setActive(self.progress > 0 ? a : -1);
      },
      onLeaveBack: () => {
        setActive(-1);
        fill(0);
      },
    });
    requestRefresh();
  });
}
