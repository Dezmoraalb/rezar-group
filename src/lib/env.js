/** Base path of the deployed site ('/rezar-group/' on GitHub Pages, '/' in Node checks). */
export const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';

/** Absolute in-site URL: url('catalog/') → '/rezar-group/catalog/' */
export const url = (path = '') => BASE + String(path).replace(/^\/+/, '');

/** Car page URL (query-string routing; static hosting has no per-car files) */
export const carUrl = (id) => url(`car/?id=${encodeURIComponent(id)}`);

/** Catalog URL with an optional query string built from params (see state.js paramsToSearch) */
export const catalogUrl = (search = '') => url(`catalog/${search}`);

/** Desktop = fine pointer and wide viewport: car pages open in a new tab there (brief §10). */
export const isDesktop = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches && matchMedia('(min-width: 1024px)').matches;
