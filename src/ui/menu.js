/**
 * Mobile menu below 1024 (port of VELAR ui/menu.ts): a native popover sheet (works without JS: popovertarget toggles
 * it, Esc closes). JS adds aria-expanded sync, focus containment (inert outside + Tab trap), scroll lock (Lenis too)
 * and closes it after a link.
 */
import { getScroll } from '../core/scroll.js';

export function initMenu() {
  const sheet = document.querySelector('[data-menu]');
  const toggle = document.querySelector('[data-menu-toggle]');
  if (!sheet || !toggle) return;
  toggle.setAttribute('aria-expanded', 'false');
  const outside = () => Array.from(document.body.children).filter((n) => n !== sheet && !n.contains(sheet) && n.tagName !== 'SCRIPT');

  sheet.addEventListener('toggle', (e) => {
    const open = e.newState === 'open';
    toggle.setAttribute('aria-expanded', String(open));
    document.documentElement.toggleAttribute('data-menu-open', open);
    outside().forEach((n) => (n.inert = open));
    if (open) getScroll()?.stop();
    else getScroll()?.start();
    if (open) (sheet.querySelector('[data-menu-close]') ?? sheet.querySelector('a, button'))?.focus();
    else toggle.focus();
  });
  sheet.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(sheet.querySelectorAll('a[href], button:not([disabled])')).filter((n) => n.getClientRects().length > 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !sheet.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !sheet.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });
  sheet.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => sheet.hidePopover?.()));
  const mq = matchMedia('(min-width: 1024px)');
  mq.addEventListener('change', () => {
    if (mq.matches) sheet.hidePopover?.();
  });
}
