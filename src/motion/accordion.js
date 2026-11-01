/**
 * Accordion height (port of VELAR motion/accordion.ts): browsers with ::details-content animate it in CSS
 * (components.css). Elsewhere (Safari, Firefox) this eases the body's height with the Web Animations API; the
 * <details> stays native (keyboard, no-JS, exclusive `name` groups). Reduced motion: native instant toggle.
 */
import { reduced } from './core.js';

const supported = () => typeof CSS !== 'undefined' && CSS.supports('selector(::details-content)');

/** @param {ParentNode} [root] */
export function initAccordions(root = document) {
  if (reduced() || supported()) return;
  root.querySelectorAll('details.acc__item').forEach((d) => {
    const sum = d.querySelector('summary');
    const body = d.querySelector('.acc__body');
    if (!sum || !body || d.dataset.acc) return;
    d.dataset.acc = '1';
    let anim = null;
    sum.addEventListener('click', (e) => {
      e.preventDefault();
      anim?.cancel();
      const opening = !d.open;
      if (opening) {
        // exclusive groups: close the open sibling the same way
        if (d.name) d.parentElement?.querySelectorAll(`details[name="${d.name}"][open]`).forEach((o) => o !== d && (o.open = false));
        d.open = true;
        const h = body.offsetHeight;
        anim = body.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 360, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      } else {
        const h = body.offsetHeight;
        anim = body.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 280, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
        anim.onfinish = () => {
          d.open = false;
          anim = null;
        };
      }
      body.style.overflow = 'clip';
      anim.addEventListener('finish', () => (body.style.overflow = ''));
    });
  });
}
