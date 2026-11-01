/**
 * Car page entry (brief §11, §16). Owner: CAR builder (car/index.html + src/pages/car/** + src/styles/car.css).
 * Route: car/?id=<id>.
 *
 * Flow: the data request starts before boot (it is on the LCP path) → the skeleton in the HTML is replaced by the
 * gallery + summary panel + details in one pass and the entrance plays (CSS, car.css) → below-the-fold blocks are
 * armed for scroll reveals → for sold cars «Схожі автомобілі» mounts under a thin rule (hidden when empty).
 * Unknown id → not-found state (noindex); failed request → error state with a retry.
 */
import { boot } from '../../core/boot.js';
import '../../styles/car.css';
import { api } from '../../lib/api.js';
import { favorites } from '../../lib/favorites.js';
import { track } from '../../lib/track.js';
import { catalogUrl } from '../../lib/env.js';
import { toast } from '../../ui/toast.js';
import { initReveals } from '../../motion/reveal.js';
import { barHTML, carFullName, detailsHTML, panelHTML, stateHTML } from './render.js';
import { createLightbox, mountGallery, STAGE_RATIO, STAGE_SIZES } from './gallery.js';
import { photoSrcset, GALLERY_WIDTHS } from '../../lib/photo.js';
import { mountSimilar } from './similar.js';
import { applyMissing, applySeo } from './seo.js';

const id = new URLSearchParams(location.search).get('id');
const valid = id != null && /^\d+$/.test(id);
// start fetching before anything else: the first gallery photo is the LCP and depends on this data
const carP = valid ? api.getCar(id) : Promise.resolve(null);
carP.catch(() => {});

// the inline <head> script hands over this car's detail chunk as soon as it lands (window.__rzChunk / 'rz:chunk'),
// usually before the larger catalog.json: preload the first gallery photo right then, with the gallery's own
// srcset/sizes, so the LCP image does not wait for the whole getCar() chain
function preloadStage() {
  if (window.__rzStagePre) return; // the inline head script already did it
  const d = valid && Array.isArray(window.__rzChunk) ? window.__rzChunk.find((x) => x.id === Number(id)) : null;
  const ph = d?.gallery?.[0];
  if (!ph) return;
  const l = document.createElement('link');
  l.rel = 'preload';
  l.as = 'image';
  l.imageSrcset = photoSrcset(ph, { widths: GALLERY_WIDTHS, ratio: STAGE_RATIO });
  l.imageSizes = STAGE_SIZES;
  l.fetchPriority = 'high';
  document.head.append(l);
}
if (window.__rzChunk) preloadStage();
else addEventListener('rz:chunk', preloadStage, { once: true });

const { reduced, scroll } = boot({ reveals: false });

const root = document.querySelector('[data-car-root]');
const top = root.querySelector('[data-car-top]');
const crumb = root.querySelector('[data-car-crumb]');
const back = root.querySelector('[data-car-back]');
const section = root.querySelector('[data-similar]');
const bar = document.querySelector('[data-car-bar]');
const dialog = document.querySelector('[data-lightbox]');

// «Каталог» goes back to the exact listing the visitor came from (filters in the URL)
try {
  const ref = document.referrer && new URL(document.referrer);
  if (ref && ref.origin === location.origin && ref.pathname === new URL(catalogUrl(), location.origin).pathname) back.href = ref.href;
} catch {}

run(carP);

async function run(p) {
  let car;
  try {
    car = await p;
  } catch (err) {
    console.error(err);
    return renderState('error');
  }
  if (!car) return renderState('missing');
  render(car);
}

function renderState(kind) {
  if (kind === 'missing') applyMissing();
  crumb.textContent = kind === 'missing' ? 'Не знайдено' : 'Помилка';
  top.className = 'vh__grid vh__grid--state';
  top.innerHTML = stateHTML(kind);
  root.removeAttribute('aria-busy');
  root.classList.add('is-ready');
  top.querySelector('[data-retry]')?.addEventListener('click', () => location.reload());
}

function render(car) {
  const now = api.now();
  const sold = car.status === 'sold';
  const name = carFullName(car);
  applySeo(car);
  crumb.textContent = name;

  const gal = top.querySelector('[data-gallery]');
  const aside = top.querySelector('[data-aside]');
  const details = top.querySelector('[data-details]');
  // the entrance (car.css) runs from the frame the content is first painted in
  root.classList.add('is-ready');
  let gallery = null;
  const lightbox = createLightbox(dialog, car, { scroll, reduced, onClose: (i) => gallery?.goTo(i, false) });
  gallery = mountGallery(gal, car, { lightbox, reduced });
  aside.innerHTML = panelHTML(car, now);
  details.innerHTML = detailsHTML(car);
  details.hidden = false;
  root.removeAttribute('aria-busy');
  root.classList.toggle('car--sold', sold);

  bindPanel(car, aside);
  stickAside(aside);
  initReveals(details);
  track('car_view', { carId: car.id, status: car.status });

  bar.innerHTML = barHTML(car);
  bar.hidden = false;
  initBar(aside.querySelector('[data-panel-actions]'));

  document.addEventListener('click', onCopy);
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('[data-to-similar]');
    if (!a) return;
    e.preventDefault();
    toSimilar();
  });

  if (sold) {
    mountSimilar(section, car, { scroll, now })
      .then((total) => {
        if (total) {
          initReveals(section);
          scroll.resize();
          if (location.hash === '#similar') toSimilar(true);
          return;
        }
        // nothing comparable right now: «Підібрати схоже» becomes a link to the same make in the catalog
        const q = `?make=${encodeURIComponent(car.make)}`;
        document.querySelectorAll('[data-to-similar]').forEach((a) => {
          a.removeAttribute('data-to-similar');
          a.href = catalogUrl(q);
          const label = a.querySelector('.btn__label');
          if (label) label.textContent = `Усі ${car.make} у каталозі`;
          a.querySelector('.btn__arrow--down')?.remove();
        });
      })
      .catch((err) => console.error(err));
  }
}

/** --header-space resolved to px (it is a calc() token) */
let probe = null;
function headerSpace() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;inline-size:0;block-size:var(--header-space)';
    document.body.append(probe);
  }
  return probe.offsetHeight || 80;
}

function toSimilar(immediate = false) {
  if (section.hidden) return;
  const h = section.querySelector('#similar-h');
  // a numeric target: Lenis would add html's scroll-padding-top to an element target, native scrolling would not
  const y = (h || section).getBoundingClientRect().top + scrollY - (headerSpace() + 24);
  scroll.scrollTo(Math.max(0, Math.round(y)), { immediate });
  track('similar_jump', { carId: Number(id) });
}

/**
 * Sticky panel that is taller than the viewport would hide its bottom (buttons, VIN) until the end of the details:
 * then it sticks by its bottom edge instead (negative top), so the whole panel is always reachable.
 */
function stickAside(aside) {
  const set = () => {
    const ideal = headerSpace() + 16;
    const fit = innerHeight - aside.offsetHeight - 16;
    aside.style.setProperty('--aside-top', `${Math.round(Math.min(ideal, fit))}px`);
  };
  set();
  addEventListener('resize', set, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(set).observe(aside);
}

/** favourite + share in the panel */
function bindPanel(car, aside) {
  const fav = aside.querySelector('[data-car-fav]');
  const paint = () => {
    const on = favorites.has(car.id);
    fav.setAttribute('aria-pressed', String(on));
    fav.querySelector('[data-fav-label]').textContent = on ? 'В обраних' : 'В обрані';
  };
  fav.addEventListener('click', () => {
    const on = favorites.toggle(car.id);
    track(on ? 'favorite_add' : 'favorite_remove', { carId: car.id, place: 'car-panel' });
    toast(on ? 'Додано в обрані' : 'Прибрано з обраних', { icon: on ? 'heart-fill' : 'heart' });
  });
  favorites.onChange(paint);

  aside.querySelector('[data-car-share]').addEventListener('click', async () => {
    const shareUrl = document.querySelector('link[rel="canonical"]')?.href || location.href;
    const title = carFullName(car);
    track('share', { carId: car.id });
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    (await copyText(shareUrl)) ? toast('Посилання скопійовано') : toast('Не вдалося скопіювати', { icon: 'info' });
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    ta.remove();
    return ok;
  }
}

async function onCopy(e) {
  const b = e.target.closest?.('[data-copy-vin]');
  if (!b) return;
  const vin = b.getAttribute('data-copy-vin');
  const ok = await copyText(vin);
  track('vin_copy', { carId: Number(id), place: b.dataset.place });
  if (!ok) {
    // no clipboard access: select the code so it can be copied by hand
    const code = b.closest('.vin')?.querySelector('.vin__code');
    if (code) getSelection()?.selectAllChildren(code);
    return toast('VIN виділено — скопіюйте вручну', { icon: 'info' });
  }
  toast('VIN скопійовано');
  b.classList.add('is-copied');
  setTimeout(() => b.classList.remove('is-copied'), 1600);
}

/**
 * Phone action bar: shown while the panel's buttons are scrolled past, hidden over the footer and (sold) over the
 * similar block. CSS hides it from 1024 up, where the panel is sticky.
 */
function initBar(actions) {
  if (!actions || !('IntersectionObserver' in window)) return;
  let past = false;
  let footer = false;
  let similar = false;
  const set = () => bar.toggleAttribute('data-on', past && !footer && !similar);
  new IntersectionObserver(([e]) => {
    past = !e.isIntersecting && e.boundingClientRect.top < 0;
    set();
  }).observe(actions);
  const foot = document.querySelector('.site-footer');
  if (foot)
    new IntersectionObserver(([e]) => {
      footer = e.isIntersecting;
      set();
    }).observe(foot);
  const grid = section.querySelector('[data-similar-grid]');
  new IntersectionObserver(([e]) => {
    similar = e.isIntersecting && !section.hidden;
    set();
  }, { rootMargin: '0px 0px -40% 0px' }).observe(grid);
}
