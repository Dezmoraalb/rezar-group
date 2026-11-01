/**
 * Car page templates (brief §11). Pure string builders — no DOM access, no side effects.
 *   panelHTML(car, now)    the sticky summary panel: status, title, trim, price, key facts, VIN, contact buttons
 *   detailsHTML(car, now)  Характеристики · Опис · Комплектація
 *   barHTML(car)           the phone action bar
 *   stateHTML(kind)        not-found / error state
 * Every field is optional: a missing value removes its whole row / tile / block (never «немає даних»).
 */
import { CONTACTS, contactAttrs } from '../../lib/contacts.js';
import { badgeHTML } from '../../lib/card.js';
import { catalogUrl } from '../../lib/env.js';
import { BODY, DRIVE, FUEL, GEARBOX, formatBattery, formatEngine, formatMileage, formatNumber, formatPrice, NNBSP } from '../../lib/format.js';
import { relTime } from '../../lib/relTime.js';
import { favorites } from '../../lib/favorites.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const icon = (name, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export const carName = (car) => `${car.make} ${car.model}`;
export const carFullName = (car) => `${carName(car)}${car.year ? ` ${car.year}` : ''}`;
const isEV = (car) => car.fuel === 'electric';
const power = (car) => (car.power ? `${formatNumber(car.power)}${NNBSP}к.с.` : '');
/** engine line: «2.0 л · 265 к.с.» / EV «82 кВт·год · 498 к.с.» */
export function powertrain(car) {
  const parts = isEV(car) ? [formatBattery(car.battery)] : [formatEngine(car.engine), car.fuel === 'hybrid' || car.fuel === 'plugin_hybrid' ? formatBattery(car.battery) : ''];
  return [...parts, power(car)].filter(Boolean).join(' · ');
}

/** [label, value, kind?] rows for «Характеристики», brief §11 order first */
export function specRows(car) {
  return [
    ['Марка', car.make],
    ['Модель', car.model],
    ['Комплектація', car.trim],
    ['Рік випуску', car.year ? String(car.year) : ''],
    ['Пробіг', formatMileage(car.mileage)],
    ['Двигун', isEV(car) ? 'Електродвигун' : formatEngine(car.engine)],
    ['Батарея', formatBattery(car.battery)],
    ['Потужність', power(car)],
    ['Паливо', FUEL[car.fuel]],
    ['Привід', DRIVE[car.drive]],
    ['Коробка передач', GEARBOX[car.gearbox]],
    ['Кузов', BODY[car.body]],
    ['Колір', car.color],
    ['Країна походження', car.origin],
    ['VIN', car.vin, 'vin'],
  ].filter(([, v]) => v != null && v !== '' && v !== undefined);
}

const STATUS_NOTE = {
  in_stock: 'Авто в Україні — доступне для огляду.',
  in_transit: 'Уже викуплене й прямує в Україну. Орієнтовну дату прибуття підкаже менеджер.',
  sold: 'Цей автомобіль уже продано. Підберемо схожий — тієї ж марки, класу й бюджету.',
};

function vinHTML(vin, place) {
  return `<span class="vin"><code class="vin__code" translate="no">${esc(vin)}</code><button class="vin__copy" type="button" data-copy-vin="${esc(vin)}" data-place="${place}" aria-label="Скопіювати VIN ${esc(vin)}">${icon('copy')}<span class="vin__copy-t">Копіювати</span></button></span>`;
}

function factsHTML(car) {
  const ev = isEV(car);
  const tiles = [
    car.year && ['calendar', String(car.year), 'Рік'],
    formatMileage(car.mileage) && ['gauge', formatMileage(car.mileage), 'Пробіг'],
    FUEL[car.fuel] && [ev ? 'bolt' : 'fuel', FUEL[car.fuel], ev ? formatBattery(car.battery) || 'Паливо' : formatEngine(car.engine) || 'Паливо'],
    DRIVE[car.drive] && ['drive', DRIVE[car.drive], 'Привід'],
    GEARBOX[car.gearbox] && ['gearbox', GEARBOX[car.gearbox], 'Коробка'],
    car.power && ['engine', power(car), 'Потужність'],
  ]
    .filter(Boolean)
    .slice(0, 4);
  // an even number of tiles keeps the 2-column grid closed
  if (tiles.length % 2) tiles.length = tiles.length > 1 ? tiles.length - 1 : tiles.length;
  if (!tiles.length) return '';
  return `<ul class="facts" role="list">${tiles
    .map(([ic, v, l]) => `<li class="facts__i">${icon(ic, 'icon facts__ic')}<span class="facts__v">${esc(v)}</span><span class="facts__l">${esc(l)}</span></li>`)
    .join('')}</ul>`;
}

const btnContact = (kind, place, id, variant) => {
  const phone = kind === 'phone';
  return `<a class="btn ${variant} btn--full" ${contactAttrs(kind, place, id)}><span class="btn__label">${icon(phone ? 'phone' : 'telegram')}${phone ? 'Зателефонувати' : 'Написати менеджеру'}</span>${phone ? '' : icon('arrow-up-right', 'icon btn__arrow btn__arrow--ext')}</a>`;
};

/** @param {object} car @param {Date} now */
export function panelHTML(car, now) {
  const sold = car.status === 'sold';
  const price = formatPrice(car.price);
  const sub = [car.trim, powertrain(car), GEARBOX[car.gearbox]].filter(Boolean).join(' · ');
  const time = car.publishedAt && !sold ? relTime(car.publishedAt, now) : '';
  const fav = favorites.has(car.id);
  const actions = sold
    ? `<a class="btn btn--lime btn--full" href="#similar" data-to-similar><span class="btn__label">Підібрати схоже</span>${icon('chevron-down', 'icon btn__arrow btn__arrow--down')}</a>
       <div class="vpanel__more">${btnContact('phone', 'car-panel', car.id, 'btn--outline')}${btnContact('telegram', 'car-panel', car.id, 'btn--outline')}</div>`
    : `${btnContact('phone', 'car-panel', car.id, 'btn--lime')}${btnContact('telegram', 'car-panel', car.id, 'btn--outline')}`;

  return `<div class="vpanel${sold ? ' vpanel--sold' : ''}">
  <div class="vpanel__top vp-a">
    ${badgeHTML(car.status, 'vpanel__badge')}
    ${car.isNew ? '<span class="vpanel__new">Нове надходження</span>' : ''}
    ${time ? `<span class="vpanel__time">${icon('clock')}<time datetime="${esc(car.publishedAt)}">${esc(time)}</time></span>` : ''}
  </div>
  <h1 class="vpanel__title vp-a" id="car-title" data-car-title>${esc(carName(car))}${car.year ? ` <span class="soft">${car.year}</span>` : ''}</h1>
  ${sub ? `<p class="vpanel__sub vp-a">${esc(sub)}</p>` : ''}
  ${price ? `<div class="vpanel__price vp-a"><p class="vpanel__price-v">${price}</p><p class="vpanel__price-l">${sold ? 'Ціна продажу, USD' : 'Ціна, USD'}</p></div>` : ''}
  ${factsHTML(car) ? `<div class="vp-a">${factsHTML(car)}</div>` : ''}
  <p class="vpanel__note vp-a">${icon(sold ? 'info' : car.status === 'in_transit' ? 'ship' : 'pin')}<span>${STATUS_NOTE[car.status] ?? ''}</span></p>
  <div class="vpanel__actions vp-a" data-panel-actions>${actions}</div>
  <div class="vpanel__tools vp-a">
    <button class="vtool" type="button" data-car-fav aria-pressed="${fav}">${icon('heart', 'icon i-off')}${icon('heart-fill', 'icon i-on')}<span data-fav-label>${fav ? 'В обраних' : 'В обрані'}</span></button>
    <button class="vtool" type="button" data-car-share>${icon('arrow-up-right')}<span>Поділитися</span></button>
    ${car.vin ? `<span class="vtool vtool--vin">VIN ${vinHTML(car.vin, 'car-panel')}</span>` : ''}
  </div>
  <p class="vpanel__contact vp-a">Менеджер Rezar Group: <a ${contactAttrs('phone', 'car-panel-number', car.id)}>${esc(CONTACTS.phone.display)}</a> · <span class="nowrap">${esc(CONTACTS.hours)}</span></p>
</div>`;
}

const PROMISES = [
  ['shield', 'Перевірка історії за VIN', 'і технічна діагностика перед угодою'],
  ['doc', 'Ціна фіксується в договорі', 'остаточна сума в доларах США, без сюрпризів після підписання'],
  ['key', 'Супровід до ключів', 'оформлення й реєстрація разом із менеджером'],
];

/** @param {object} car */
export function detailsHTML(car) {
  const rows = specRows(car);
  const paras = (car.description ?? '')
    .split(/\n{2,}|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const equip = Array.isArray(car.equipment) ? car.equipment.filter(Boolean) : [];
  const blocks = [];
  if (rows.length)
    blocks.push(`<section class="cd" aria-labelledby="cd-specs" data-reveal>
  <h2 class="cd__h" id="cd-specs">Характеристики</h2>
  <dl class="specs">${rows
    .map(([l, v, kind]) => `<div class="specs__row${kind ? ` specs__row--${kind}` : ''}"><dt>${esc(l)}</dt><dd>${kind === 'vin' ? vinHTML(v, 'car-specs') : esc(v)}</dd></div>`)
    .join('')}</dl>
</section>`);
  if (paras.length)
    blocks.push(`<section class="cd" aria-labelledby="cd-desc" data-reveal>
  <h2 class="cd__h" id="cd-desc">Опис</h2>
  <div class="cd__text">${paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
</section>`);
  if (equip.length)
    blocks.push(`<section class="cd" aria-labelledby="cd-equip">
  <h2 class="cd__h" id="cd-equip" data-reveal>Комплектація <span class="cd__n">${equip.length}</span></h2>
  <ul class="equip" role="list" data-reveal-group>${equip.map((e) => `<li>${icon('check')}<span>${esc(e)}</span></li>`).join('')}</ul>
</section>`);
  blocks.push(`<section class="cd cd--promise" aria-labelledby="cd-why" data-reveal>
  <h2 class="cd__h" id="cd-why">Як ми продаємо</h2>
  <ul class="promise" role="list" data-reveal-group>${PROMISES.map(([ic, t, d]) => `<li><span class="promise__ic">${icon(ic)}</span><p><b>${t}</b><span>${d}</span></p></li>`).join('')}</ul>
</section>`);
  return blocks.join('');
}

/** phone action bar (fixed at the bottom while the panel buttons are off screen) */
export function barHTML(car) {
  const price = formatPrice(car.price);
  const sold = car.status === 'sold';
  return `<div class="car-bar__in">
  <div class="car-bar__info"><span class="car-bar__name">${esc(carFullName(car))}</span>${price ? `<span class="car-bar__price">${price}${sold ? ' · продано' : ''}</span>` : ''}</div>
  ${
    sold
      ? `<a class="car-bar__icon" ${contactAttrs('phone', 'car-bar', car.id)} aria-label="Зателефонувати">${icon('phone')}</a><a class="btn btn--lime btn--sm" href="#similar" data-to-similar><span class="btn__label">Підібрати схоже</span></a>`
      : `<a class="car-bar__icon" ${contactAttrs('telegram', 'car-bar', car.id)} aria-label="Написати менеджеру">${icon('telegram')}</a><a class="btn btn--lime btn--sm" ${contactAttrs('phone', 'car-bar', car.id)}><span class="btn__label">${icon('phone')}Зателефонувати</span></a>`
  }
</div>`;
}

/** @param {'missing'|'error'} kind */
export function stateHTML(kind) {
  if (kind === 'error')
    return `<div class="state car-state">
  <h1 class="state__title" id="car-title">Не вдалося завантажити авто</h1>
  <p class="state__text">Схоже, зв’язок перервався. Спробуйте ще раз — або зателефонуйте, і менеджер розповість про це авто.</p>
  <div class="car-state__actions"><button class="btn btn--lime" type="button" data-retry><span class="btn__label">${icon('refresh')}Спробувати ще раз</span></button><a class="btn btn--outline" ${contactAttrs('phone', 'car-error')}><span class="btn__label">${icon('phone')}Зателефонувати</span></a></div>
</div>`;
  return `<div class="state car-state">
  <p class="label"><span class="label__dot"></span><span class="label__text">Помилка 404</span></p>
  <h1 class="state__title" id="car-title">Авто не знайдено</h1>
  <p class="state__text">Можливо, оголошення зняте або посилання неповне. У каталозі — сотні авто в наявності та в дорозі, а продані зберігаються в розділі «Продані».</p>
  <div class="car-state__actions"><a class="btn btn--lime" href="${catalogUrl()}"><span class="btn__label">Перейти до каталогу</span>${icon('arrow-right', 'icon btn__arrow')}</a><a class="btn btn--outline" href="${catalogUrl('?section=sold')}"><span class="btn__label">Продані авто</span></a></div>
</div>`;
}
