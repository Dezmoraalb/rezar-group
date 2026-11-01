/**
 * Car photo URLs. Demo photos come from the Unsplash CDN (imgix): `auto=format` serves AVIF/WebP
 * by Accept header, `w`/`h`/`fit=crop` give exact responsive sizes. In production this module is
 * the only place to change to point at Rezar's own Cloudflare R2 + CDN (brief §2, §17).
 *
 *   photoUrl(id, { w: 800, ratio: 4/3 })                 → single URL
 *   photoSrcset(id, { ratio: 4/3, widths: [...] })        → 'url 360w, url 540w, …'
 *   CARD_SIZES                                            → sizes attr for the 3/2-column grid
 */
const CDN = 'https://images.unsplash.com/photo-';

export const CARD_WIDTHS = [320, 480, 640, 800, 1000];
export const GALLERY_WIDTHS = [640, 960, 1280, 1600, 2000];
/** 3 columns ≥1024px (container max 1440), 2 columns below */
export const CARD_SIZES = '(min-width: 1520px) 470px, (min-width: 1024px) 31vw, 48vw';

/**
 * @param {string} id   Unsplash photo id ('1555215695-3004980ad54e')
 * @param {{w?: number, h?: number, ratio?: number, q?: number}} [o]  ratio = width / height
 */
export function photoUrl(id, { w = 800, h, ratio, q = 70 } = {}) {
  if (!id) return '';
  const hh = h ?? (ratio ? Math.round(w / ratio) : undefined);
  return `${CDN}${id}?w=${w}${hh ? `&h=${hh}&fit=crop&crop=entropy` : ''}&auto=format&q=${q}`;
}

/** @param {string} id @param {{widths?: number[], ratio?: number, q?: number}} [o] */
export function photoSrcset(id, { widths = CARD_WIDTHS, ratio, q = 70 } = {}) {
  if (!id) return '';
  return widths.map((w) => `${photoUrl(id, { w, ratio, q })} ${w}w`).join(', ');
}

/** Low-quality placeholder (blurred 24px) for a background-image while the real photo loads */
export const photoLqip = (id, ratio = 4 / 3) => photoUrl(id, { w: 24, ratio, q: 30 }) + '&blur=40';

/**
 * Home-page / editorial imagery (verified Unsplash ids). photoUrl(SCENES.hero, { w: 1600 }).
 * Also copied into public/data/meta.json → scenes.
 */
export const SCENES = {
  hero: '1618418721668-0d1f72aa4bab', // dark luxury saloon, chrome grille, near-black frame (LCP)
  heroAlt: '1760688962576-1e2ff91424ba', // dark car, headlights on, garage
  night: '1768822392574-9946895f063b', // saloon taillights at night
  dark: '1561924563-d9ad0f32b23f', // headlights out of total darkness
  matte: '1787178605268-36282fb87172', // matte black car in a white studio
  showroom: '1764013290175-2b76e9a00b2e', // showroom floor full of cars
  showroom2: '1692406069831-0bb7ea297645', // bright dealership hall
  handover: '1653565217811-85b41bcd1edb', // key handed over
  road: '1492144534655-ae79c964c9d7', // car front, soft light
};
