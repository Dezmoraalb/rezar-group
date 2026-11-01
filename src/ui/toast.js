/**
 * Toast: toast('VIN скопійовано', { icon: 'check' }). One at a time, 2.4 s, polite live region.
 */
let el = null;
let t = 0;
/** @param {string} text @param {{icon?: string, ms?: number}} [o] */
export function toast(text, { icon = 'check', ms = 2400 } = {}) {
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  el.innerHTML = `${icon ? `<svg class="icon" aria-hidden="true"><use href="#i-${icon}"/></svg>` : ''}<span></span>`;
  el.querySelector('span').textContent = text;
  requestAnimationFrame(() => el.classList.add('is-on'));
  clearTimeout(t);
  t = window.setTimeout(() => el.classList.remove('is-on'), ms);
}
