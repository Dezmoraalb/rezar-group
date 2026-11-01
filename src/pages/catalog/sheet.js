/**
 * The filter panel as a sheet below 1280px: a bottom sheet on phones (drag the head down to close), a floating side
 * drawer on tablets / small laptops. From 1280px the same element is a sticky sidebar and this module stays idle.
 *   initSheet({ panel, backdrop, scroll, onOpen, onClose }) → { open(opener?), close(), isSheet(), isOpen() }
 * Open: html[data-sheet-open] (the header stays put), scroll locked (Lenis stop), page behind inert, focus moves in
 * and is kept inside; Esc / backdrop / × close and focus returns to the button that opened it.
 */
const SHEET_MQ = '(max-width: 1279px)';
const PHONE_MQ = '(max-width: 767px)';

/**
 * @param {{panel: HTMLElement, backdrop: HTMLElement, scroll: any, onOpen?: () => void, onClose?: (how: string) => void}} o
 */
export function initSheet({ panel, backdrop, scroll, onOpen, onClose }) {
  const mq = matchMedia(SHEET_MQ);
  const phone = matchMedia(PHONE_MQ);
  const html = document.documentElement;
  let opened = false;
  /** @type {HTMLElement|null} */
  let opener = null;
  let hideT = 0;

  const isSheet = () => mq.matches;

  function setMode() {
    panel.classList.remove('is-ready');
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('is-ready')));
    if (isSheet()) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
    } else {
      if (opened) close('resize');
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
    }
  }
  setMode();
  mq.addEventListener('change', setMode);

  const outside = () => [document.querySelector('[data-site-header]'), document.querySelector('.site-footer'), ...document.querySelectorAll('.cat-head, .cat__main, .cat-dock')].filter(Boolean);

  function open(from) {
    if (!isSheet() || opened) return;
    opened = true;
    opener = /** @type {HTMLElement|null} */ (from ?? document.activeElement);
    clearTimeout(hideT);
    backdrop.hidden = false;
    panel.setAttribute('data-open', '');
    html.setAttribute('data-sheet-open', '');
    requestAnimationFrame(() => backdrop.classList.add('is-in'));
    scroll?.stop();
    outside().forEach((el) => el.setAttribute('inert', ''));
    document.querySelectorAll('[data-cf-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    onOpen?.();
    // focus the panel itself (not the first input: on phones that would pop the keyboard over the sheet)
    panel.setAttribute('tabindex', '-1');
    setTimeout(() => panel.focus({ preventScroll: true }), 30);
  }

  function close(how = 'close') {
    if (!opened) return;
    opened = false;
    panel.removeAttribute('data-open');
    panel.style.removeProperty('--drag');
    backdrop.classList.remove('is-in');
    hideT = window.setTimeout(() => (backdrop.hidden = true), 420);
    html.removeAttribute('data-sheet-open');
    scroll?.start();
    outside().forEach((el) => el.removeAttribute('inert'));
    document.querySelectorAll('[data-cf-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    onClose?.(how);
    if (how !== 'resize' && opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  backdrop.addEventListener('click', () => close('backdrop'));
  panel.addEventListener('keydown', (e) => {
    if (!opened) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close('escape');
      return;
    }
    if (e.key !== 'Tab') return;
    const f = Array.from(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(
      (el) => !el.hasAttribute('disabled') && !el.closest('[hidden]') && /** @type {HTMLElement} */ (el).offsetParent !== null,
    );
    if (!f.length) return;
    const first = /** @type {HTMLElement} */ (f[0]);
    const last = /** @type {HTMLElement} */ (f[f.length - 1]);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // phones: drag the head down to dismiss (follows the finger, closes past 110px or on a quick flick)
  const grab = panel.querySelector('[data-cf-grab]');
  let startY = 0;
  let lastY = 0;
  let lastT = 0;
  let v = 0;
  let dragging = false;
  grab?.addEventListener('pointerdown', (e) => {
    const pe = /** @type {PointerEvent} */ (e);
    if (!opened || !phone.matches || /** @type {Element} */ (pe.target).closest('button')) return;
    dragging = true;
    startY = lastY = pe.clientY;
    lastT = performance.now();
    v = 0;
    panel.classList.add('is-dragging');
    /** @type {Element} */ (grab).setPointerCapture(pe.pointerId);
  });
  grab?.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const pe = /** @type {PointerEvent} */ (e);
    const t = performance.now();
    v = (pe.clientY - lastY) / Math.max(1, t - lastT);
    lastY = pe.clientY;
    lastT = t;
    const dy = Math.max(0, pe.clientY - startY);
    panel.style.setProperty('--drag', `${dy}px`);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('is-dragging');
    const dy = Math.max(0, lastY - startY);
    if (dy > 110 || v > 0.6) close('drag');
    else panel.style.removeProperty('--drag');
  };
  grab?.addEventListener('pointerup', end);
  grab?.addEventListener('pointercancel', end);

  return { open, close, isSheet, isOpen: () => opened };
}
