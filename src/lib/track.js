/**
 * Click tracking (brief §11: «отслеживать клики» on «Зателефонувати» / «Написати менеджеру»).
 * Any element with data-track="call|message|…" is tracked on click (delegated, one listener):
 *   data-track-place="header|card|car-page|…"  data-track-id="<car id>" (optional)
 * Events go to window.dataLayer (GTM / GA4-ready) and are kept in sessionStorage 'rezar:events' for the demo.
 *   track(event, props)   manual call
 */
export function track(event, props = {}) {
  const payload = { event: `rezar_${event}`, ...props, ts: Date.now(), page: location.pathname + location.search };
  try {
    /** @type {any} */ (window).dataLayer = /** @type {any} */ (window).dataLayer || [];
    /** @type {any} */ (window).dataLayer.push(payload);
    const log = JSON.parse(sessionStorage.getItem('rezar:events') || '[]');
    log.push(payload);
    sessionStorage.setItem('rezar:events', JSON.stringify(log.slice(-50)));
  } catch {}
  if (import.meta.env?.DEV) console.debug('[track]', payload);
}

let bound = false;
export function initTracking() {
  if (bound) return;
  bound = true;
  document.addEventListener(
    'click',
    (e) => {
      const el = /** @type {Element} */ (e.target)?.closest?.('[data-track]');
      if (!el) return;
      track(el.getAttribute('data-track'), {
        place: el.getAttribute('data-track-place') || undefined,
        carId: el.getAttribute('data-track-id') || undefined,
        href: el.getAttribute('href') || undefined,
      });
    },
    { capture: true },
  );
}
