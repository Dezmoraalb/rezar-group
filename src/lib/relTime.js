/**
 * Publication time label (brief §9), Europe/Kyiv calendar. Pure.
 *
 *   < 24 h since publication      → 'N годину / години / годин тому'  (under 1 h → 'менше години тому')
 *   previous Kyiv calendar day    → 'Вчора'
 *   2–6 Kyiv calendar days ago    → 'N дні / днів тому'
 *   7+ calendar days ago          → 'DD.MM.YYYY'
 *
 * The 24-hour rule is checked first, so something published at 23:00 yesterday reads '3 години тому' at 02:00
 * today (the brief lists hours before «Вчора»).
 * Example (brief): now = 29.10.2026 → published 25.10 → '4 дні тому', 21.10 → '21.10.2026'.
 *
 * @param {Date|string|number} published
 * @param {Date|string|number} [now]
 * @returns {string}
 */
import { formatDate, plural } from './format.js';
import { kyivDayNumber, kyivDaysBetween } from './kyiv.js';

export { kyivDayNumber, kyivDaysBetween };

const HOUR = 3600e3;

export function relTime(published, now = new Date()) {
  const p = published instanceof Date ? published : new Date(published);
  const n = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(p.getTime())) return '';
  const ms = n.getTime() - p.getTime();
  if (ms < 0) return 'щойно';
  if (ms < 24 * HOUR) {
    const h = Math.floor(ms / HOUR);
    if (h < 1) return 'менше години тому';
    return `${h} ${plural(h, ['годину', 'години', 'годин'])} тому`;
  }
  const days = kyivDaysBetween(p, n);
  if (days <= 1) return 'Вчора';
  if (days <= 6) return `${days} ${plural(days, ['день', 'дні', 'днів'])} тому`;
  return formatDate(p);
}
