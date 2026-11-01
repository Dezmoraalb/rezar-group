/**
 * Corporate contacts of Rezar Group — PLACEHOLDERS (real ones unknown, brief §15). Every element that shows one carries
 * data-placeholder so they are easy to find; replace here + in src/partials/*.html. Only Rezar's own contacts are ever
 * shown (brief §11): no supplier / partner names, links or phones anywhere on the site.
 */
export const CONTACTS = {
  phone: { display: '+380 (XX) XXX-XX-XX', href: 'tel:+380000000000' },
  telegram: { display: '@rezar_group', href: 'https://t.me/rezar_group_placeholder' },
  email: { display: 'info@rezar.example', href: 'mailto:info@rezar.example' },
  address: { display: 'Київ, адреса уточнюється' },
  hours: 'Пн–Сб, 9:00–19:00',
};

/**
 * Attributes for a tracked contact link (spread into a template):
 *   `<a ${contactAttrs('phone', 'car-page', car.id)}>Зателефонувати</a>`
 * @param {'phone'|'telegram'} kind @param {string} place @param {number|string} [carId]
 */
export function contactAttrs(kind, place, carId) {
  const c = CONTACTS[kind];
  const ext = kind === 'telegram' ? ' target="_blank" rel="noopener"' : '';
  const ev = kind === 'phone' ? 'call' : 'message';
  return `href="${c.href}"${ext} data-contact="${kind}" data-track="${ev}" data-track-place="${place}"${carId != null ? ` data-track-id="${carId}"` : ''} data-placeholder`;
}
