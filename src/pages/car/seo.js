/**
 * Per-car SEO, set at runtime (the static host has one HTML file for every car; the real backend will render the
 * same tags server-side): <title>, meta description, canonical, Open Graph, JSON-LD (Car + Offer, BreadcrumbList).
 *   applySeo(car) · applyMissing()
 */
import { carUrl, url } from '../../lib/env.js';
import { BODY, DRIVE, FUEL, GEARBOX, formatEngine, formatMileage, formatPrice, STATUS } from '../../lib/format.js';
import { photoUrl } from '../../lib/photo.js';
import { carFullName } from './render.js';

const abs = (path) => new URL(path, location.origin).href;

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) return el?.remove();
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.setAttribute('content', content);
}
function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.append(el);
  }
  el.href = href;
}
function setJsonLd(data) {
  let el = document.head.querySelector('script[data-car-ld]');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.carLd = '';
    document.head.append(el);
  }
  el.textContent = JSON.stringify(data);
}

const AVAILABILITY = {
  in_stock: 'https://schema.org/InStock',
  in_transit: 'https://schema.org/PreOrder',
  sold: 'https://schema.org/SoldOut',
};
const DRIVE_LD = {
  fwd: 'https://schema.org/FrontWheelDriveConfiguration',
  rwd: 'https://schema.org/RearWheelDriveConfiguration',
  awd: 'https://schema.org/AllWheelDriveConfiguration',
};
const plainSpaces = (s) => String(s).replace(/[  ]/g, ' ');

/** @param {object} car api.getCar() result */
export function applySeo(car) {
  const name = carFullName(car);
  const price = plainSpaces(formatPrice(car.price));
  const sold = car.status === 'sold';
  const canonical = abs(carUrl(car.id));
  const title = `${name}${car.trim ? ` ${car.trim}` : ''}${sold ? ' — продано' : price ? ` — ${price}` : ''} · Rezar Group`;
  const facts = [formatMileage(car.mileage), FUEL[car.fuel], formatEngine(car.engine), DRIVE[car.drive] && `${DRIVE[car.drive].toLowerCase()} привід`, GEARBOX[car.gearbox]?.toLowerCase()]
    .filter(Boolean)
    .map(plainSpaces)
    .join(', ');
  const description = `${name}${facts ? `: ${facts}` : ''}.${price && !sold ? ` Ціна ${price}.` : ''} ${STATUS[car.status]?.long ?? ''}. Фото, характеристики й комплектація в каталозі Rezar Group.`
    .replace(/\s+/g, ' ')
    .slice(0, 300);
  const images = (car.gallery ?? [car.photo]).filter(Boolean).slice(0, 6).map((id) => photoUrl(id, { w: 1200, ratio: 1.5 }));

  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', null);
  setLink('canonical', canonical);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:image', images[0]);
  setMeta('name', 'twitter:card', 'summary_large_image');

  const vehicle = {
    '@type': 'Car',
    '@id': `${canonical}#car`,
    name,
    url: canonical,
    brand: { '@type': 'Brand', name: car.make },
    model: car.model,
    vehicleModelDate: car.year ? String(car.year) : undefined,
    vehicleConfiguration: car.trim,
    bodyType: BODY[car.body],
    color: car.color,
    vehicleIdentificationNumber: car.vin,
    itemCondition: 'https://schema.org/UsedCondition',
    mileageFromOdometer: car.mileage != null ? { '@type': 'QuantitativeValue', value: car.mileage, unitCode: 'KMT' } : undefined,
    fuelType: FUEL[car.fuel],
    vehicleTransmission: GEARBOX[car.gearbox],
    driveWheelConfiguration: DRIVE_LD[car.drive],
    vehicleEngine:
      car.engine || car.power
        ? {
            '@type': 'EngineSpecification',
            engineDisplacement: car.engine ? { '@type': 'QuantitativeValue', value: car.engine, unitCode: 'LTR' } : undefined,
            enginePower: car.power ? { '@type': 'QuantitativeValue', value: car.power, unitCode: 'BHP' } : undefined,
          }
        : undefined,
    image: images,
    description: car.description,
    offers: car.price
      ? {
          '@type': 'Offer',
          price: car.price,
          priceCurrency: 'USD',
          availability: AVAILABILITY[car.status],
          itemCondition: 'https://schema.org/UsedCondition',
          url: canonical,
          seller: { '@type': 'AutoDealer', name: 'Rezar Group', url: abs(url('')) },
        }
      : undefined,
  };
  setJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      vehicle,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: abs(url('')) },
          { '@type': 'ListItem', position: 2, name: 'Каталог', item: abs(url('catalog/')) },
          { '@type': 'ListItem', position: 3, name, item: canonical },
        ],
      },
    ],
  });
}

/** unknown / missing id: keep it out of the index */
export function applyMissing() {
  document.title = 'Авто не знайдено · Rezar Group';
  setMeta('name', 'robots', 'noindex');
  setMeta('name', 'description', 'Оголошення не знайдено. Перегляньте авто в наявності та в дорозі в каталозі Rezar Group.');
  setLink('canonical', abs(url('catalog/')));
}
