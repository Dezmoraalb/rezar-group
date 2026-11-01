/**
 * Car gallery (brief §11): a large photo, thumbnails, swipe, counter, fullscreen lightbox.
 *
 *   mountGallery(host, car, { lightbox, reduced }) → { goTo(i, smooth?), index() }
 *
 * The stage is a native scroll-snap track: swipe on touch, trackpad on desktop, arrows / thumbnails / keyboard
 * (← → Home End, Enter opens the lightbox). Only the first photo loads eagerly (it is the page LCP); the next ones are
 * promoted to eager as the viewer approaches them, so a swipe never lands on an empty frame.
 */
import { photoSrcset, photoUrl, GALLERY_WIDTHS } from '../../lib/photo.js';
import { badgeHTML } from '../../lib/card.js';
import { track } from '../../lib/track.js';
import { carFullName, esc, icon } from './render.js';

export const STAGE_RATIO = 3 / 2;
export const STAGE_SIZES = '(min-width: 1520px) 900px, (min-width: 1280px) 62vw, (min-width: 1024px) 58vw, 100vw';
const THUMB_W = 160;

/**
 * @param {HTMLElement} host
 * @param {object} car  api.getCar() result (gallery: photo ids)
 * @param {{ lightbox?: { open: (i: number) => void }, reduced?: boolean }} [o]
 */
export function mountGallery(host, car, { lightbox, reduced = false } = {}) {
  const photos = car.gallery?.length ? car.gallery : car.photo ? [car.photo] : [];
  const name = carFullName(car);
  const n = photos.length;

  if (!n) {
    host.innerHTML = `<div class="gal gal--empty"><div class="gal__stage"><div class="gal__none">${icon('camera', 'icon icon--lg')}<span>Фото з’являться найближчим часом</span></div>${badgeHTML(car.status, 'gal__badge')}</div></div>`;
    return { goTo() {}, index: () => 0 };
  }

  const slides = photos
    .map(
      (id, i) => `<figure class="gal__slide" role="group" aria-roledescription="слайд" aria-label="${i + 1} з ${n}">
  <img src="${photoUrl(id, { w: 1280, ratio: STAGE_RATIO })}" srcset="${photoSrcset(id, { widths: GALLERY_WIDTHS, ratio: STAGE_RATIO })}" sizes="${STAGE_SIZES}" width="1500" height="1000" alt="${esc(name)}, фото ${i + 1}" ${i === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" draggable="false">
</figure>`,
    )
    .join('');
  const thumbs =
    n > 1
      ? `<div class="gal__thumbs" data-gal-thumbs>${photos
          .map(
            (id, i) =>
              `<button class="gal__thumb" type="button" style="--i:${i}" data-gal-thumb="${i}" aria-label="Фото ${i + 1} з ${n}"${i === 0 ? ' aria-current="true"' : ''}><img data-src="${photoUrl(id, { w: THUMB_W, ratio: 4 / 3, q: 60 })}" data-srcset="${photoUrl(id, { w: THUMB_W * 2, ratio: 4 / 3, q: 55 })} 2x" width="${THUMB_W}" height="120" alt="" decoding="async" draggable="false"></button>`,
          )
          .join('')}</div>`
      : '';

  host.innerHTML = `<div class="gal${n === 1 ? ' gal--single' : ''}${car.status === 'sold' ? ' gal--sold' : ''}">
  <div class="gal__stage">
    <div class="gal__track" data-gal-track tabindex="0" role="region" aria-roledescription="галерея" aria-label="Фото: ${esc(name)}. Стрілки — гортати, Enter — на весь екран" data-lenis-prevent-horizontal>${slides}</div>
    ${badgeHTML(car.status, 'gal__badge')}
    ${
      n > 1
        ? `<button class="gal__nav gal__nav--prev" type="button" data-gal-prev aria-label="Попереднє фото" disabled>${icon('chevron-left')}</button>
    <button class="gal__nav gal__nav--next" type="button" data-gal-next aria-label="Наступне фото">${icon('chevron-right')}</button>
    <div class="gal__bar" aria-hidden="true"><i data-gal-bar></i></div>`
        : ''
    }
    <button class="gal__open" type="button" data-gal-open aria-label="Відкрити фото на весь екран">${icon('camera')}<span data-gal-count>${n > 1 ? `1 / ${n}` : '1 фото'}</span></button>
  </div>
  ${thumbs}
</div>`;

  // thumbnails wait for the main photo (the LCP): on a slow line they would otherwise share its bandwidth
  const thumbImgs = Array.from(host.querySelectorAll('img[data-src]'));
  if (thumbImgs.length) {
    const first = host.querySelector('.gal__slide img');
    let done = false;
    const fill = () => {
      if (done) return;
      done = true;
      thumbImgs.forEach((im) => {
        im.srcset = im.dataset.srcset;
        im.src = im.dataset.src;
      });
    };
    if (!first || first.complete) requestAnimationFrame(fill);
    else {
      first.addEventListener('load', fill, { once: true });
      first.addEventListener('error', fill, { once: true });
      setTimeout(fill, 4000);
    }
  }

  const track_ = host.querySelector('[data-gal-track]');
  const count = host.querySelector('[data-gal-count]');
  const prev = host.querySelector('[data-gal-prev]');
  const next = host.querySelector('[data-gal-next]');
  const bar = host.querySelector('[data-gal-bar]');
  const thumbRow = host.querySelector('[data-gal-thumbs]');
  const thumbEls = Array.from(host.querySelectorAll('[data-gal-thumb]'));
  const imgs = Array.from(track_.querySelectorAll('img'));
  let cur = 0;

  // photos fade in once decoded (the first one is already painted by then on a warm cache)
  imgs.forEach((img, i) => {
    if (i === 0 || img.complete) return;
    img.dataset.loading = '';
    img.addEventListener('load', () => delete img.dataset.loading, { once: true });
    img.addEventListener('error', () => delete img.dataset.loading, { once: true });
  });

  const warm = (i) => {
    for (const j of [i - 1, i + 1, i + 2]) {
      const img = imgs[j];
      if (img && img.loading === 'lazy') img.loading = 'eager';
    }
  };
  // warm the second photo once the first is in, so the first swipe is instant
  const first = imgs[0];
  if (first) (first.complete ? warm(0) : first.addEventListener('load', () => warm(0), { once: true }));

  function paint(i) {
    if (i === cur) return;
    cur = i;
    if (count && n > 1) count.textContent = `${i + 1} / ${n}`;
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === n - 1;
    if (bar) bar.style.transform = `scaleX(${(i + 1) / n})`;
    thumbEls.forEach((t, j) => (j === i ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current')));
    // keep the active thumbnail in view without scrolling the page
    const t = thumbEls[i];
    if (thumbRow && t) {
      const l = t.offsetLeft - (thumbRow.clientWidth - t.offsetWidth) / 2;
      thumbRow.scrollTo({ left: Math.max(0, l), behavior: reduced ? 'auto' : 'smooth' });
    }
    warm(i);
  }
  if (bar) bar.style.transform = `scaleX(${1 / n})`;

  function goTo(i, smooth = true) {
    const k = Math.max(0, Math.min(n - 1, i));
    track_.scrollTo({ left: k * track_.clientWidth, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    paint(k);
  }

  let raf = 0;
  track_.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = track_.clientWidth || 1;
        paint(Math.round(track_.scrollLeft / w));
      });
    },
    { passive: true },
  );
  // keep the current slide aligned when the stage resizes (rotation, sidebar)
  if ('ResizeObserver' in window) new ResizeObserver(() => (track_.scrollLeft = cur * track_.clientWidth)).observe(track_);

  prev?.addEventListener('click', () => goTo(cur - 1));
  next?.addEventListener('click', () => goTo(cur + 1));
  thumbRow?.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-gal-thumb]');
    if (b) goTo(Number(b.dataset.galThumb));
  });

  const open = (i = cur) => {
    if (!lightbox) return;
    lightbox.open(i);
    track('gallery_open', { carId: car.id, photo: i + 1 });
  };
  host.querySelector('[data-gal-open]')?.addEventListener('click', () => open());
  track_.addEventListener('click', (e) => {
    if (e.target instanceof HTMLImageElement) open(imgs.indexOf(e.target));
  });
  track_.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: n - 1 }[e.key];
    if (k != null) {
      e.preventDefault();
      goTo(k);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });

  return { goTo, index: () => cur };
}

/**
 * Fullscreen lightbox on a native <dialog> (focus trap, Esc and focus return for free).
 * Built lazily on the first open, so full-size photos never load unless asked for.
 *
 * @param {HTMLDialogElement} dialog
 * @param {object} car
 * @param {{ scroll?: { stop(): void, start(): void }, reduced?: boolean, onClose?: (i: number) => void }} [o]
 */
export function createLightbox(dialog, car, { scroll, reduced = false, onClose } = {}) {
  const photos = car.gallery?.length ? car.gallery : car.photo ? [car.photo] : [];
  const n = photos.length;
  const name = carFullName(car);
  const trackEl = dialog.querySelector('[data-lb-track]');
  const countEl = dialog.querySelector('[data-lb-count]');
  const prev = dialog.querySelector('[data-lb-prev]');
  const next = dialog.querySelector('[data-lb-next]');
  dialog.querySelector('[data-lb-title]').textContent = name;
  let built = false;
  let cur = 0;
  let imgs = [];

  function build() {
    if (built) return;
    built = true;
    trackEl.innerHTML = photos
      .map(
        (id, i) =>
          `<figure class="lb__slide" role="group" aria-roledescription="слайд" aria-label="${i + 1} з ${n}"><img src="${photoUrl(id, { w: 1600, q: 75 })}" srcset="${photoSrcset(id, { widths: GALLERY_WIDTHS, q: 75 })}" sizes="100vw" alt="${esc(name)}, фото ${i + 1}" loading="lazy" decoding="async" draggable="false"></figure>`,
      )
      .join('');
    imgs = Array.from(trackEl.querySelectorAll('img'));
    if (n < 2) dialog.classList.add('lb--single');
    let raf = 0;
    trackEl.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => paint(Math.round(trackEl.scrollLeft / (trackEl.clientWidth || 1))));
      },
      { passive: true },
    );
    // a click on the dark area around the photo closes; on the photo itself it does nothing
    trackEl.addEventListener('click', (e) => {
      if (!(e.target instanceof HTMLImageElement)) close();
    });
  }

  function paint(i) {
    cur = Math.max(0, Math.min(n - 1, i));
    countEl.textContent = n > 1 ? `${cur + 1} / ${n}` : '';
    prev.disabled = cur === 0;
    next.disabled = cur === n - 1;
    for (const j of [cur, cur - 1, cur + 1]) if (imgs[j]) imgs[j].loading = 'eager';
  }
  function goTo(i, smooth = true) {
    const k = Math.max(0, Math.min(n - 1, i));
    trackEl.scrollTo({ left: k * trackEl.clientWidth, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    paint(k);
  }

  let closing = 0;
  function close() {
    if (!dialog.open || closing) return;
    if (reduced) return dialog.close();
    dialog.classList.add('is-closing');
    closing = window.setTimeout(() => {
      closing = 0;
      dialog.classList.remove('is-closing');
      dialog.close();
    }, 220);
  }

  prev.addEventListener('click', () => goTo(cur - 1));
  next.addEventListener('click', () => goTo(cur + 1));
  dialog.querySelector('[data-lb-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(cur - 1);
    else if (e.key === 'ArrowRight') goTo(cur + 1);
    else if (e.key === 'Home') goTo(0);
    else if (e.key === 'End') goTo(n - 1);
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('lb-open');
    scroll?.start();
    onClose?.(cur);
  });

  return {
    /** @param {number} i */
    open(i = 0) {
      if (!n) return;
      build();
      document.documentElement.classList.add('lb-open');
      scroll?.stop();
      if (!dialog.open) dialog.showModal();
      paint(i);
      trackEl.scrollLeft = cur * trackEl.clientWidth;
      trackEl.focus({ preventScroll: true });
    },
    close,
  };
}
