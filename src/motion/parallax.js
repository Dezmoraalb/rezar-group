/**
 * Depth on desktop (GSAP ScrollTrigger scrub; VELAR's calm amounts).
 *   <div data-parallax="0.08">   drifts against the scroll by that share of its distance from the viewport centre
 *                                (positive = slower than the page), capped at ±48px. Uses `y`, so it composes with
 *                                CSS transforms on children.
 * Off below 1024 / on touch / tier 'low' / reduced motion.
 */
import { gsap, ScrollTrigger } from '../core/scroll.js';
import { desktop, reduced } from './core.js';

/** @param {ParentNode} [root] @param {{tier?: string}} [opts] */
export function initParallax(root = document, { tier = 'high' } = {}) {
  if (reduced() || !desktop() || tier === 'low') return;
  root.querySelectorAll('[data-parallax]').forEach((el) => {
    if (el.dataset.pxArmed) return;
    el.dataset.pxArmed = '1';
    const f = Number(el.dataset.parallax) || 0.06;
    const amp = Math.min(48, innerHeight * f * 0.5);
    gsap.fromTo(
      el,
      { y: -amp },
      {
        y: amp,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
      },
    );
  });
  ScrollTrigger.refresh();
}
