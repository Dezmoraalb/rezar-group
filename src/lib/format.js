/**
 * Display formatting (uk-UA). Pure functions, no DOM.
 *   formatPrice(24500)      → '$ 24 500'
 *   formatMileage(86000)    → '86 000 км'
 *   formatNumber(1234567)   → '1 234 567'
 *   formatEngine(2.0)       → '2.0 л'
 *   formatDate(date)        → '21.10.2026' (Europe/Kyiv)
 *   FUEL / DRIVE / GEARBOX / BODY / STATUS label maps
 * Grouping uses a NARROW NO-BREAK SPACE (U+202F) so numbers never wrap; tests compare with
 * normalizeSpaces() if they need plain spaces.
 */
export const NNBSP = ' ';

/** @param {number|null|undefined} n */
export function formatNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return Math.round(Number(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

/** '$ 24 500' — the final Rezar price in USD; '' when unknown (caller hides the field) */
export function formatPrice(n) {
  const s = formatNumber(n);
  return s ? `$${NNBSP}${s}` : '';
}

/** '86 000 км'; 0 km → '0 км'; unknown → '' */
export function formatMileage(km) {
  const s = formatNumber(km);
  return s ? `${s}${NNBSP}км` : '';
}

/** '2.0 л' (EV / unknown → '') */
export function formatEngine(litres) {
  if (litres == null || !Number.isFinite(Number(litres)) || Number(litres) <= 0) return '';
  return `${Number(litres).toFixed(1)}${NNBSP}л`;
}

/** EV battery: '82 кВт·год' */
export function formatBattery(kwh) {
  if (!kwh) return '';
  return `${formatNumber(kwh)}${NNBSP}кВт·год`;
}

/** 'DD.MM.YYYY' in Europe/Kyiv */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/** 'DD.MM.YYYY, HH:MM' in Europe/Kyiv (last sync line) */
export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const t = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return `${formatDate(d)}, ${t}`;
}

export const normalizeSpaces = (s) => String(s).replace(/[  ]/g, ' ');

export const FUEL = {
  petrol: 'Бензин',
  diesel: 'Дизель',
  hybrid: 'Гібрид',
  plugin_hybrid: 'Плагін-гібрид',
  electric: 'Електро',
  lpg: 'Газ / бензин',
};
export const DRIVE = { fwd: 'Передній', rwd: 'Задній', awd: 'Повний' };
export const GEARBOX = { automatic: 'Автомат', manual: 'Механіка', robot: 'Робот', cvt: 'Варіатор' };
export const BODY = {
  sedan: 'Седан',
  hatchback: 'Хетчбек',
  wagon: 'Універсал',
  liftback: 'Ліфтбек',
  coupe: 'Купе',
  convertible: 'Кабріолет',
  suv: 'Позашляховик / кросовер',
  pickup: 'Пікап',
  minivan: 'Мінівен',
};
/** Public statuses (brief §4, §11). Badge on photos: `long` (≥480px) / `short` (phones). Archive section name: «Продані». */
export const STATUS = {
  in_stock: { short: 'В наявності', long: 'Авто в наявності' },
  in_transit: { short: 'В дорозі', long: 'Авто в дорозі' },
  sold: { short: 'Продано', long: 'Продано', section: 'Продані' },
};
/** «Розділ» filter options (brief §7), in display order */
export const SECTIONS = [
  { value: 'new', label: 'Нові надходження' },
  { value: 'in_stock', label: 'Авто в наявності' },
  { value: 'in_transit', label: 'Авто в дорозі' },
  { value: 'sold', label: 'Продано' },
];
/** Sort options (brief §7); first = default */
export const SORTS = [
  { value: 'date_desc', label: 'Спочатку нові' },
  { value: 'date_asc', label: 'Спочатку давні' },
  { value: 'price_asc', label: 'Ціна: за зростанням' },
  { value: 'price_desc', label: 'Ціна: за спаданням' },
];

/** Ukrainian plural: plural(5, ['авто', 'авто', 'авто']) / plural(n, ['година','години','годин']) */
const rules = new Intl.PluralRules('uk');
export function plural(n, [one, few, many]) {
  const r = rules.select(Math.abs(Math.trunc(n)));
  return r === 'one' ? one : r === 'few' ? few : many;
}
