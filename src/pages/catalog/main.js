/**
 * Catalog entry. Owner: CATALOG builder. It pulls the stylesheets (so they stay <link>s in the head) and the page
 * module. The data requests and the first row's photo preloads already start in the inline <head> script (default
 * view); for other views the first photos are preloaded here as soon as the first page is known.
 * ./page.js is a static import on purpose: Vite then lists the whole module graph (incl. the GSAP / Lenis chunk) as
 * <link rel=modulepreload> in the HTML, so it downloads in parallel with the data instead of after this module —
 * the first cards (this page's LCP) are rendered by page.js.
 */
import '../../styles/main.css';
import '../../styles/catalog.css';
import { api } from '../../lib/api.js';
import { searchToFilters, isBackNavigation } from '../../lib/state.js';
import { favorites } from '../../lib/favorites.js';
import { preloadPhotos } from './media.js';
import './page.js';

if (!isBackNavigation()) {
  const phone = matchMedia('(max-width: 767px)').matches;
  api
    .query(searchToFilters(location.search, { favIds: favorites.list() }), { limit: phone ? 2 : 3 })
    .then((r) => window.__rzCardsPre || preloadPhotos(r.items), () => {}); // default view: the inline head script did it
} else api.prefetch();

