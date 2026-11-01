/**
 * Filter panel (brief §7): make (searchable) → model (appears after make) · year from/to · price USD from/to ·
 * mileage from/to. «Розділ» and sort live in the page head / toolbar (main.js).
 *   initPanel({ root, years, onChange }) → { draft, set(filters), render(facets), commitTyping() }
 * The panel edits a draft. onChange(draft, { typing }) fires on every edit; main.js decides whether to apply it at
 * once (sidebar) or only preview it (sheet: the «Показати N авто» button applies).
 */
import { formatNumber, plural } from '../../lib/format.js';
import { DEFAULT_FILTERS } from '../../lib/api.js';
import { initCombo } from './combo.js';

const KEYS = ['make', 'model', 'yearFrom', 'yearTo', 'priceFrom', 'priceTo', 'mileageFrom', 'mileageTo'];
const digits = (s) => {
  const d = String(s ?? '').replace(/\D+/g, '').slice(0, 9);
  return d ? Number(d) : null;
};

/** @param {{root: HTMLElement, years: [number, number], onChange: (draft: object, o: {typing: boolean}) => void}} o */
export function initPanel({ root, years, onChange }) {
  const form = /** @type {HTMLFormElement} */ (root.querySelector('[data-cf-form]'));
  const modelWrap = /** @type {HTMLElement} */ (root.querySelector('[data-cf-model-wrap]'));
  const model = /** @type {HTMLSelectElement} */ (root.querySelector('[data-cf-model]'));
  const yFrom = /** @type {HTMLSelectElement} */ (root.querySelector('[data-cf-year="from"]'));
  const yTo = /** @type {HTMLSelectElement} */ (root.querySelector('[data-cf-year="to"]'));
  const nums = /** @type {HTMLInputElement[]} */ (Array.from(root.querySelectorAll('[data-cf-num]')));

  /** @type {Record<string, any>} */
  const draft = Object.fromEntries(KEYS.map((k) => [k, DEFAULT_FILTERS[k]]));

  // years: newest first (people think «від 2019»), fixed list so options never jump while filtering
  const yearOpts = [];
  for (let y = years[1]; y >= years[0]; y--) yearOpts.push(`<option value="${y}">${y}</option>`);
  yFrom.insertAdjacentHTML('beforeend', yearOpts.join(''));
  yTo.insertAdjacentHTML('beforeend', yearOpts.join(''));

  const emit = (typing = false) => onChange({ ...draft }, { typing });

  const combo = initCombo({
    root: /** @type {Element} */ (root.querySelector('[data-combo]')),
    onSelect(make) {
      draft.make = make;
      draft.model = '';
      syncModel([]);
      emit();
    },
  });

  function syncModel(models) {
    const on = !!draft.make;
    modelWrap.toggleAttribute('data-on', on);
    model.disabled = !on;
    if (!on) {
      model.innerHTML = '<option value="">Усі моделі</option>';
      return;
    }
    const opts = models.map((m) => `<option value="${m.model}"${m.model === draft.model ? ' selected' : ''}>${m.model} · ${m.count}</option>`);
    // keep a chosen model even if it fell to 0 with the other filters
    if (draft.model && !models.some((m) => m.model === draft.model)) opts.unshift(`<option value="${draft.model}" selected>${draft.model} · 0</option>`);
    model.innerHTML = `<option value="">Усі моделі ${draft.make}</option>${opts.join('')}`;
    model.value = draft.model || '';
  }

  model.addEventListener('change', () => {
    draft.model = model.value;
    emit();
  });
  for (const sel of [yFrom, yTo]) {
    sel.addEventListener('change', () => {
      draft[sel.name] = sel.value ? Number(sel.value) : null;
      // a reversed pair is swapped instead of giving an empty list
      if (draft.yearFrom != null && draft.yearTo != null && draft.yearFrom > draft.yearTo) {
        [draft.yearFrom, draft.yearTo] = [draft.yearTo, draft.yearFrom];
        yFrom.value = String(draft.yearFrom);
        yTo.value = String(draft.yearTo);
      }
      emit();
    });
  }

  // number fields: digits while typing, «24 500» once done; typing debounces, change / Enter commits
  for (const inp of nums) {
    inp.addEventListener('input', () => {
      const pos = inp.selectionStart ?? inp.value.length;
      const before = inp.value.slice(0, pos).replace(/\D+/g, '').length;
      const n = digits(inp.value);
      inp.value = n == null ? '' : formatNumber(n);
      // keep the caret after the same digit
      let i = 0;
      let seen = 0;
      while (i < inp.value.length && seen < before) {
        if (/\d/.test(inp.value[i])) seen++;
        i++;
      }
      inp.setSelectionRange(i, i);
      draft[inp.name] = n;
      emit(true);
    });
    inp.addEventListener('change', () => commitPair(inp.name));
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitPair(inp.name);
        inp.blur();
      }
    });
  }
  function commitPair(name) {
    const base = name.replace(/From$|To$/, '');
    const a = draft[`${base}From`];
    const b = draft[`${base}To`];
    if (a != null && b != null && a > b) {
      draft[`${base}From`] = b;
      draft[`${base}To`] = a;
      writeNums();
    }
    emit();
  }
  form.addEventListener('submit', (e) => e.preventDefault());

  function writeNums() {
    for (const inp of nums) {
      if (document.activeElement === inp) continue;
      const v = draft[inp.name];
      inp.value = v == null ? '' : formatNumber(v);
    }
  }

  return {
    draft,
    /** load filters into the draft and the controls */
    set(filters) {
      for (const k of KEYS) draft[k] = filters[k] ?? DEFAULT_FILTERS[k];
      combo.setValue(draft.make);
      yFrom.value = draft.yearFrom != null ? String(draft.yearFrom) : '';
      yTo.value = draft.yearTo != null ? String(draft.yearTo) : '';
      writeNums();
      syncModel([]);
    },
    /** facets for the draft: make counts, model list, placeholders from the price / mileage span */
    render(facets) {
      if (!facets) return;
      combo.setItems(facets.makes.map((m) => ({ value: m.make, count: m.count })));
      syncModel(facets.models);
      const r = facets.ranges;
      const ph = (k, i, word) => (r?.[k] ? `${word} ${formatNumber(r[k][i])}` : word);
      for (const inp of nums) {
        const k = inp.name.startsWith('price') ? 'price' : 'mileage';
        const from = inp.name.endsWith('From');
        inp.placeholder = ph(k, from ? 0 : 1, from ? 'від' : 'до');
      }
    },
    closeCombo: () => combo.close(),
  };
}

/** «Показати 128 авто» */
export const applyLabel = (n) => (n === 0 ? 'Немає авто за цими фільтрами' : `Показати ${formatNumber(n)} ${plural(n, ['авто', 'авто', 'авто'])}`);
