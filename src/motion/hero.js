/**
 * Photo hero hooks (the intro timeline itself is CSS in styles/motion.css, so it starts with the first paint):
 *   cue     the scroll-cue button scrolls to the next section; it leaves after the first scroll
 *   depth   desktop only: while the hero scrolls away the media drifts slower than the page (GSAP scrub) and the copy
 *           lifts and fades — VELAR's amounts (media 0.35, copy −0.12, fade to 0.1)
 */
import { gsap, getScroll } from '../core/scroll.js';
import { desktop, reduced } from './core.js';

export function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const media = hero.querySelector('.hero__media');
  const content = hero.querySelector('.hero__content');
  const cue = hero.querySelector('.hero__cue');
  cue?.addEventListener('click', () => {
    const next = hero.nextElementSibling;
    if (next) getScroll()?.scrollTo(next, { offset: -8 });
  });
  if (cue) {
    const off = () => {
      if (scrollY > 40) {
        cue.classList.add('is-gone');
        removeEventListener('scroll', off);
      }
    };
    addEventListener('scroll', off, { passive: true });
  }
  if (reduced() || !desktop()) return;
  const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
  if (media) gsap.to(media, { yPercent: 18, ease: 'none', scrollTrigger: st });
  if (content) gsap.to(content, { y: () => -hero.offsetHeight * 0.12, opacity: 0.1, ease: 'none', scrollTrigger: { ...st, invalidateOnRefresh: true } });
}
