/**
 * Searchable make picker (brief §7 «марка — поиск в списке»): an ARIA 1.2 combobox over a listbox.
 *   initCombo({ root, onSelect }) → { setItems(items), setValue(make), close() }
 *   items: [{ value: 'BMW', count: 42 }]  (count 0 → shown dimmed, still selectable)
 * Typing filters the list (latin or Ukrainian spelling: «мерседес», «бмв», «шкода»…), ↑/↓ move, Enter picks,
 * Esc closes and restores the current value. Picking the same make again keeps it; × clears it.
 */
const ALIASES = {
  Audi: 'ауді ауди',
  BMW: 'бмв бэмвэ бумер',
  Ford: 'форд',
  Honda: 'хонда',
  Hyundai: 'хюндай хендай хундай хьюндай',
  Jeep: 'джип',
  Kia: 'кіа киа',
  'Land Rover': 'ленд ровер лендровер рейндж range',
  Lexus: 'лексус',
  Mazda: 'мазда',
  'Mercedes-Benz': 'мерседес мерс бенц mercedes',
  Nissan: 'ніссан ниссан нісан',
  Opel: 'опель',
  Porsche: 'порше порш',
  Renault: 'рено',
  Skoda: 'шкода škoda',
  Tesla: 'тесла',
  Toyota: 'тойота таёта',
  Volkswagen: 'фольксваген фольц вв vw',
  Volvo: 'вольво',
};

const norm = (s) => String(s).toLowerCase().replace(/[\s-]+/g, ' ').trim();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** @param {{root: Element, onSelect: (make: string) => void}} o */
export function initCombo({ root, onSelect }) {
  const input = /** @type {HTMLInputElement} */ (root.querySelector('[data-combo-input]'));
  const list = /** @type {HTMLElement} */ (root.querySelector('[data-combo-list]'));
  const clear = /** @type {HTMLButtonElement} */ (root.querySelector('[data-combo-clear]'));
  /** @type {{value: string, count: number}[]} */
  let items = [];
  let value = '';
  let active = -1;
  let shown = [];
  let open = false;

  const matchesQuery = (it, q) => {
    if (!q) return true;
    const hay = `${norm(it.value)} ${ALIASES[it.value] ?? ''}`;
    return hay.split(' ').some((w) => w.startsWith(q)) || norm(it.value).includes(q) || hay.includes(q);
  };

  function mark(text, q) {
    const n = norm(text);
    const i = q ? n.indexOf(q) : -1;
    if (i < 0) return esc(text);
    return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
  }

  function render() {
    // while the field shows the chosen make, the list shows every make (the user is browsing, not searching)
    const raw = input.value === value ? '' : input.value;
    const q = norm(raw);
    shown = [{ value: '', count: -1 }, ...items.filter((it) => matchesQuery(it, q))];
    if (q) shown.shift(); // «Усі марки» only when not searching
    if (!shown.length) {
      list.innerHTML = `<li class="combo__empty" role="presentation">Немає такої марки</li>`;
      active = -1;
      return;
    }
    if (active >= shown.length) active = shown.length - 1;
    list.innerHTML = shown
      .map((it, i) => {
        const sel = it.value === value;
        const id = `cf-make-opt-${i}`;
        const label = it.value ? mark(it.value, q) : 'Усі марки';
        const count = it.count >= 0 ? `<span class="combo__count">${it.count}</span>` : '';
        return `<li class="combo__opt${it.count === 0 ? ' is-zero' : ''}${i === active ? ' is-active' : ''}" id="${id}" role="option" aria-selected="${sel}" data-i="${i}">${sel ? '<svg class="icon combo__check" aria-hidden="true"><use href="#i-check"/></svg>' : ''}<span class="combo__name">${label}</span>${count}</li>`;
      })
      .join('');
    input.setAttribute('aria-activedescendant', active >= 0 ? `cf-make-opt-${active}` : '');
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function show() {
    if (open) return;
    open = true;
    list.hidden = false;
    root.classList.add('is-open');
    input.setAttribute('aria-expanded', 'true');
    active = Math.max(0, shownIndexOf(value));
    render();
    requestAnimationFrame(() => list.classList.add('is-in'));
  }
  function hide({ restore = true } = {}) {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    list.classList.remove('is-in');
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    if (restore) input.value = value;
  }
  const shownIndexOf = (v) => {
    const q = norm(input.value === value ? '' : input.value);
    const arr = q ? items.filter((it) => matchesQuery(it, q)) : [{ value: '' }, ...items];
    return arr.findIndex((it) => it.value === v);
  };

  function pick(i) {
    const it = shown[i];
    if (!it) return;
    const changed = it.value !== value;
    value = it.value;
    input.value = value;
    clear.hidden = !value;
    hide({ restore: false });
    if (changed) onSelect(value);
  }

  input.addEventListener('focus', () => {
    input.select();
    show();
  });
  input.addEventListener('click', show);
  input.addEventListener('input', () => {
    active = 0;
    show();
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return show();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      active = (active + d + shown.length) % Math.max(1, shown.length);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0) pick(active);
      else show();
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        hide();
      }
    } else if (e.key === 'Tab') {
      // Tab with a typed, unambiguous query picks it (typing «bmw» + Tab feels natural)
      if (open && input.value !== value && shown.length === 1) pick(0);
      else hide();
    }
  });
  input.addEventListener('blur', () => {
    // pointerdown on an option keeps focus (preventDefault there); any other blur closes and restores
    setTimeout(() => {
      if (document.activeElement !== input) hide();
    }, 0);
  });
  list.addEventListener('pointerdown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = /** @type {Element} */ (e.target).closest?.('[data-i]');
    if (li) pick(Number(li.getAttribute('data-i')));
  });
  list.addEventListener('pointermove', (e) => {
    const li = /** @type {Element} */ (e.target).closest?.('[data-i]');
    const i = li ? Number(li.getAttribute('data-i')) : -1;
    if (i >= 0 && i !== active) {
      list.querySelector('.is-active')?.classList.remove('is-active');
      li.classList.add('is-active');
      active = i;
      input.setAttribute('aria-activedescendant', li.id);
    }
  });
  clear.addEventListener('click', () => {
    const had = !!value;
    value = '';
    input.value = '';
    clear.hidden = true;
    hide({ restore: false });
    input.focus({ preventScroll: true });
    if (had) onSelect('');
  });

  return {
    /** @param {{value: string, count: number}[]} next */
    setItems(next) {
      items = next;
      if (open) render();
    },
    /** @param {string} v */
    setValue(v) {
      value = v || '';
      if (document.activeElement !== input || !open) input.value = value;
      clear.hidden = !value;
      if (open) render();
    },
    close: () => hide(),
  };
}
