/**
 * Hero letterbox intro (home.css «hero letterbox intro»): the bars are pure CSS, decided before first paint by
 * html.intro (head.html). This only runs the timecode in the top bar, lets any input skip the intro, and marks the
 * intro as seen for the rest of the browser session.
 */
const FPS = 24;
const pad = (n) => String(n).padStart(2, '0');

/** @param {{ reduced: boolean }} ctx */
export function initIntro({ reduced }) {
  const html = document.documentElement;
  if (!html.classList.contains('intro')) return;
  try {
    sessionStorage.setItem('rz-intro', '1');
  } catch {
    /* private mode: the intro simply plays on every visit */
  }
  const lb = document.querySelector('.home-hero__lb');
  if (reduced || !lb) return;
  const tc = lb.querySelector('.home-hero__tc');
  const t0 = performance.now();
  let raf = 0;
  const tick = (now) => {
    const f = Math.floor(((now - t0) / 1000) * FPS);
    if (tc) tc.textContent = `00:00:${pad(Math.floor(f / FPS))}:${pad(f % FPS)}`;
    if (now - t0 < 2700) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const skip = () => {
    cancelAnimationFrame(raf);
    html.classList.remove('intro');
  };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((e) => addEventListener(e, skip, { once: true, passive: true }));
  setTimeout(skip, 2800);
}
