/**
 * Europe/Kyiv calendar helpers (DST-aware via Intl; no libraries). Pure, work in browsers and Node.
 *   kyivParts(date)            → { y, m, d, h, min } wall-clock parts in Kyiv
 *   kyivDayNumber(date)        → Kyiv calendar date as a day count since 1970-01-01
 *   kyivDaysBetween(a, b)      → whole Kyiv calendar days from a to b (b − a)
 *   kyivWallToUtc(y,m,d,h,min) → epoch ms of that Kyiv wall-clock time
 *   latestSyncSlot(ms)         → epoch ms of the newest Rezar sync slot (08:00 / 20:00 Kyiv, brief §19) at or before ms
 */
const fmtParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const toDate = (v) => (v instanceof Date ? v : new Date(v));

/** @param {Date|string|number} date */
export function kyivParts(date) {
  const o = {};
  for (const p of fmtParts.formatToParts(toDate(date))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, min: o.minute };
}

/** @param {Date|string|number} date */
export function kyivDayNumber(date) {
  const { y, m, d } = kyivParts(date);
  return Math.round(Date.UTC(y, m - 1, d) / 86400e3);
}

/** whole Kyiv calendar days from `then` to `now` */
export function kyivDaysBetween(then, now = new Date()) {
  return kyivDayNumber(now) - kyivDayNumber(then);
}

/** Kyiv offset from UTC in minutes at instant ms (+120 in winter, +180 in summer) */
export function kyivOffsetMin(ms) {
  const { y, m, d, h, min } = kyivParts(ms);
  const asUtc = Date.UTC(y, m - 1, d, h, min);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

export function kyivWallToUtc(y, m, d, h = 0, min = 0) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess - kyivOffsetMin(guess) * 60000;
  t = guess - kyivOffsetMin(t) * 60000; // second pass settles DST edges
  return t;
}

/** newest 08:00 / 20:00 Kyiv slot at or before ms */
export function latestSyncSlot(ms) {
  const { y, m, d, h } = kyivParts(ms);
  if (h >= 20) return kyivWallToUtc(y, m, d, 20);
  if (h >= 8) return kyivWallToUtc(y, m, d, 8);
  const prev = new Date(Date.UTC(y, m - 1, d) - 86400e3);
  return kyivWallToUtc(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), 20);
}
