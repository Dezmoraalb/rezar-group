/**
 * Catalog card (brief §8). One renderer for the catalog grid, the «Схожі автомобілі» grid and the home page.
 *
 *   cardHTML(car, { now, eager, newTab, index, place })  → '<article class="card">…</article>'
 *   cardSkeletonHTML()                                    → placeholder card while a page loads
 *   bindCards(container)                                  → favourite toggles (delegated, once per container)
 *   appendCards(container, cars, opts)                    → append + enter animation; returns the new elements
 *
 * On the photo: status badge · favourite heart (localStorage) · photo counter.
 * Under the photo: make model · year · final price USD · mileage · fuel · publication time (relTime).
 * Empty fields are omitted entirely — never «немає даних» (brief §8).
 * Desktop opens the car in a new tab, mobile in the same tab (brief §10) — `newTab` defaults to env.isDesktop().
 */
import { carUrl, isDesktop } from './env.js';
import { formatMileage, formatPrice, FUEL, STATUS } from './format.js';
import { photoSrcset, photoUrl, CARD_SIZES } from './photo.js';
import { relTime } from './relTime.js';
import { favorites } from './favorites.js';
import { track } from './track.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (name, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** status badge for photos (also used by the car page gallery): badgeHTML('in_stock', 'gallery__badge') */
export function badgeHTML(status, cls = '') {
  const s = STATUS[status];
  if (!s) return '';
  return `<span class="badge badge--${status}${cls ? ` ${cls}` : ''}"><span class="badge__long">${s.long}</span><span class="badge__short">${s.short}</span></span>`;
}

/**
 * @param {object} car  catalog item (api.query / api.similar / api.byIds)
 * @param {{now?: Date, eager?: boolean, newTab?: boolean, index?: number, place?: string}} [o]
 */
export function cardHTML(car, { now = new Date(), eager = false, newTab = isDesktop(), index = 0, place = 'catalog' } = {}) {
  const title = `${esc(car.make)} ${esc(car.model)}`;
  const price = formatPrice(car.price);
  const km = formatMileage(car.mileage);
  const fuel = car.fuel ? FUEL[car.fuel] : '';
  const time = car.publishedAt ? relTime(car.publishedAt, now) : '';
  const fav = favorites.has(car.id);
  const sold = car.status === 'sold';
  const specs = [
    km && `<li>${icon('gauge')}<span>${km}</span></li>`,
    fuel && `<li>${icon(car.fuel === 'electric' ? 'bolt' : 'fuel')}<span>${fuel}</span></li>`,
  ].filter(Boolean);
  const img = car.photo
    ? `<img src="${photoUrl(car.photo, { w: 640, ratio: 4 / 3 })}" srcset="${photoSrcset(car.photo, { ratio: 4 / 3 })}" sizes="${CARD_SIZES}" width="800" height="600" alt="${title}${car.year ? `, ${car.year}` : ''}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager && index === 0 ? ' fetchpriority="high"' : ''}>`
    : '';
  const target = newTab ? ' target="_blank" rel="noopener"' : '';
  return `<article class="card${sold ? ' card--sold' : ''}" data-car-id="${car.id}" style="--k:${index % 12}">
  <a class="card__link" href="${carUrl(car.id)}"${target} data-card-link data-place="${place}">
    <div class="card__media">${img}${badgeHTML(car.status, 'card__badge')}${car.photos > 1 ? `<span class="card__count">${icon('camera')}${car.photos}</span>` : ''}</div>
    <div class="card__body">
      <div class="card__head"><h3 class="card__title">${title}</h3>${car.year ? `<span class="card__year">${car.year}</span>` : ''}</div>
      ${price ? `<p class="card__price">${price}</p>` : ''}
      ${specs.length ? `<ul class="card__specs" role="list">${specs.join('')}</ul>` : ''}
      ${time ? `<p class="card__time"><time datetime="${esc(car.publishedAt)}">${time}</time></p>` : ''}
    </div>
  </a>
  <button class="card__fav" type="button" aria-pressed="${fav}" aria-label="${fav ? 'Прибрати з обраних' : 'Додати в обрані'}: ${title}" data-fav="${car.id}">${icon('heart', 'icon i-off')}${icon('heart-fill', 'icon i-on')}</button>
</article>`;
}

export function cardSkeletonHTML() {
  return `<div class="card card--skeleton" aria-hidden="true"><div class="card__media"></div><div class="card__body"><span class="sk sk--title"></span><span class="sk sk--price"></span><span class="sk sk--meta"></span></div></div>`;
}

const bound = new WeakSet();
/** delegated favourite toggles + click tracking for a container of cards */
export function bindCards(container) {
  if (!container || bound.has(container)) return;
  bound.add(container);
  container.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-fav]');
    if (!btn || !container.contains(btn)) return;
    e.preventDefault();
    const id = Number(btn.getAttribute('data-fav'));
    const on = favorites.toggle(id);
    // keep every rendering of this car in sync (catalog + similar on one page)
    document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      const t = b.getAttribute('aria-label')?.split(': ').slice(1).join(': ') ?? '';
      b.setAttribute('aria-label', `${on ? 'Прибрати з обраних' : 'Додати в обрані'}: ${t}`);
    });
    track(on ? 'favorite_add' : 'favorite_remove', { carId: id });
  });
  // fade photos in once decoded (no pop-in on slow lines)
  container.addEventListener(
    'load',
    (e) => {
      if (e.target instanceof HTMLImageElement) e.target.removeAttribute('data-loading');
    },
    true,
  );
}

/**
 * Append cards with the enter animation (styles/motion.css .card--enter). Returns the new card elements.
 * @param {Element} container @param {object[]} cars @param {object} [opts] cardHTML options (+ animate: boolean)
 */
export function appendCards(container, cars, { animate = true, enter = 'full', ...opts } = {}) {
  const tpl = document.createElement('template');
  const base = container.children.length;
  tpl.innerHTML = cars.map((c, i) => cardHTML(c, { ...opts, index: base + i })).join('');
  const els = Array.from(tpl.content.children);
  // enter 'full': the whole card rises and fades in (infinite scroll); 'body': the photo is painted at once and
  // only settles (transform), the text rises — for the first row on page load, whose photo is the LCP element
  // (an opacity fade would push LCP to the end of the animation)
  const cls = enter === 'body' ? 'card--enter-body' : 'card--enter';
  if (animate) els.forEach((el, i) => {
    el.classList.add(cls);
    el.style.setProperty('--k', String(i % 12));
    const end = (e) => {
      if (cls === 'card--enter-body' && !(e.target instanceof HTMLImageElement)) return;
      el.classList.remove(cls);
      el.removeEventListener('animationend', end);
    };
    el.addEventListener('animationend', end);
  });
  container.append(tpl.content);
  bindCards(container);
  return els;
}
