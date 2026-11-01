/**
 * Catalog image sizing. The grid here is narrower than the shared CARD_SIZES assume (sidebar from 1280), and on
 * 3× phones a 2-column card does not need a 640px photo — 480w is sharp at that size and roughly halves the bytes
 * of the first row, which is this page's LCP. One `sizes` value is used by the grid and by the early preloads, so
 * the browser fetches exactly one candidate per photo.
 */
import { photoSrcset } from '../../lib/photo.js';

export const CAT_SIZES =
  '(min-width: 1520px) 340px, (min-width: 1280px) 23vw, (min-width: 1024px) 31vw, (min-width: 768px) 46vw, (min-resolution: 2.5dppx) 30vw, 46vw';

/** apply CAT_SIZES to freshly appended cards (sync, before the browser picks a candidate) */
export function sizeCards(els) {
  for (const el of els) el.querySelector('.card__media img')?.setAttribute('sizes', CAT_SIZES);
}

/** <link rel=preload> for the first photos as soon as the first page of data is known (before the page module) */
export function preloadPhotos(cars) {
  cars.forEach((c, i) => {
    if (!c.photo) return;
    const l = document.createElement('link');
    l.rel = 'preload';
    l.as = 'image';
    l.setAttribute('imagesrcset', photoSrcset(c.photo, { ratio: 4 / 3 }));
    l.setAttribute('imagesizes', CAT_SIZES);
    if (i === 0) l.setAttribute('fetchpriority', 'high');
    document.head.append(l);
  });
}
