/**
 * Device tier (ported from the nbtire reference). Decides how much motion a device gets.
 *
 *   'low'  : Save-Data, deviceMemory < 4, hardwareConcurrency < 4  → no Lenis, no parallax, reveals only
 *   'mid'  : coarse pointer or viewport < 900px                    → native scroll, light parallax off
 *   'high' : everything else                                       → Lenis smooth scroll + parallax
 *
 * Override for testing: ?tier=low|mid|high. Mirrored to <html data-tier="…"> for CSS.
 * @typedef {'high'|'mid'|'low'} Tier
 */

/** @returns {Tier} */
export function detectTier() {
  let forced = null;
  try {
    forced = new URLSearchParams(location.search).get('tier');
  } catch {}
  if (forced === 'low' || forced === 'mid' || forced === 'high') return apply(forced);

  const nav = /** @type {any} */ (navigator);
  if (nav.connection?.saveData) return apply('low');
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return apply('low');
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return apply('low');
  if (matchMedia('(pointer: coarse)').matches || innerWidth < 900) return apply('mid');
  return apply('high');
}

/** @param {Tier} t */
function apply(t) {
  document.documentElement.dataset.tier = t;
  return t;
}

/** True when the user asked for reduced motion (html.reduced is set before first paint by the head script). */
export const prefersReducedMotion = () =>
  document.documentElement.classList.contains('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;
