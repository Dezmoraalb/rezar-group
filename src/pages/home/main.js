/** Home page entry. Owner: HOME builder (index.html + src/pages/home/** + src/styles/home.css). */
import { boot } from '../../core/boot.js';
import '../../styles/home.css';
import '../../styles/film.css';
import { initFx } from './fx.js';
import { initSteps } from './steps.js';
import { initLive } from './live.js';
import { initFilm } from './film.js';
import { initIntro } from './intro.js';

const { tier, reduced, scroll } = boot();

// each block on its own: one failing never takes the others down
const safe = (name, fn) => {
  try {
    fn();
  } catch (err) {
    console.error(`[home] ${name}`, err);
  }
};
safe('intro', () => initIntro({ reduced }));
safe('fx', () => initFx({ tier, reduced }));
safe('film', () => initFilm({ tier, reduced, scroll }));
safe('steps', () => initSteps({ tier, reduced, scroll }));
safe('live', () => initLive({ reduced, scroll }));

/* Deep links (/rezar-group/#contacts from another page): the browser jumps before the steps pin exists, which moves
   everything below it. Re-land on the anchor once the layout has settled — unless the visitor already scrolled. */
if (location.hash.length > 1) {
  let target = null;
  try {
    target = document.querySelector(decodeURIComponent(location.hash));
  } catch {
    target = null;
  }
  if (target) {
    let moved = false;
    const mark = () => (moved = true);
    ['wheel', 'touchstart', 'keydown'].forEach((e) => addEventListener(e, mark, { once: true, passive: true }));
    const land = () => {
      if (moved) return;
      const off = -(parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 96);
      scroll.scrollTo(target, { offset: off, immediate: true });
    };
    addEventListener('load', () => setTimeout(land, 60), { once: true });
    document.fonts?.ready.then(() => setTimeout(land, 200));
  }
}
