/** 404 page entry (shared, scaffold-owned): the message + a live row of the three newest in-stock cars. */
import { boot } from '../core/boot.js';
import { api, DEFAULT_FILTERS } from '../lib/api.js';
import { appendCards, bindCards } from '../lib/card.js';
import { initReveals } from '../motion/reveal.js';
import '../styles/404.css';

boot();

const box = document.querySelector('[data-nf-fresh]');
const grid = box?.querySelector('[data-nf-grid]');
if (box && grid) {
  const load = () =>
    api
      .query({ ...DEFAULT_FILTERS, section: 'in_stock' }, { limit: 3 })
      .then(({ items }) => {
        if (!items.length) return;
        box.hidden = false;
        bindCards(grid);
        appendCards(grid, items, { now: api.now(), place: '404' });
        initReveals(box);
      })
      .catch(() => {}); // the message + buttons above already do the job
  'requestIdleCallback' in window ? requestIdleCallback(load, { timeout: 1200 }) : setTimeout(load, 300);
}
