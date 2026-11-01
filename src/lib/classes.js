/**
 * «Аналогічний клас» reference (brief §16: «справочник соответствий»).
 * One class per make+model. Used by the data generator (car.cls) and by similar.js
 * (tier 2: same make, other model, same class; tier 3: other make, same class + budget).
 * EVs sit in the class of their size/segment; the powertrain is scored separately.
 */
export const CLASS_LABEL = {
  city: 'Міський (B)',
  compact: 'Компактний (C)',
  midsize: 'Середній (D)',
  premium_compact: 'Преміум компактний',
  premium_executive: 'Преміум бізнес (E)',
  luxury: 'Представницький',
  sports: 'Спорткар / купе',
  crossover_small: 'Компактний кросовер',
  crossover_compact: 'Кросовер (C-SUV)',
  suv_midsize: 'Середній позашляховик',
  premium_suv_compact: 'Преміум кросовер',
  premium_suv_large: 'Великий преміум SUV',
  pickup: 'Пікап',
};

/** make → model → class */
export const CLASS_OF = {
  Toyota: { Camry: 'midsize', RAV4: 'crossover_compact', Corolla: 'compact', 'Land Cruiser Prado': 'suv_midsize', Highlander: 'suv_midsize', Tacoma: 'pickup' },
  BMW: {
    '3 Series': 'premium_compact',
    '4 Series': 'premium_compact',
    '5 Series': 'premium_executive',
    '7 Series': 'luxury',
    X3: 'premium_suv_compact',
    X5: 'premium_suv_large',
    X6: 'premium_suv_large',
    i4: 'premium_compact',
    iX3: 'premium_suv_compact',
  },
  Audi: { A4: 'premium_compact', A5: 'premium_compact', A6: 'premium_executive', A7: 'premium_executive', Q5: 'premium_suv_compact', Q7: 'premium_suv_large', Q8: 'premium_suv_large', 'e-tron': 'premium_suv_large' },
  'Mercedes-Benz': { 'C-Class': 'premium_compact', CLA: 'premium_compact', 'E-Class': 'premium_executive', 'S-Class': 'luxury', GLC: 'premium_suv_compact', GLE: 'premium_suv_large', 'G-Class': 'premium_suv_large' },
  Volkswagen: { Polo: 'city', Golf: 'compact', 'e-Golf': 'compact', Jetta: 'compact', Passat: 'midsize', Tiguan: 'crossover_compact', 'ID.4': 'crossover_compact', Touareg: 'suv_midsize' },
  Skoda: { Octavia: 'compact', Superb: 'midsize', Kodiaq: 'crossover_compact', Enyaq: 'crossover_compact' },
  Hyundai: { Accent: 'city', Elantra: 'compact', Sonata: 'midsize', Tucson: 'crossover_compact', 'Ioniq 5': 'crossover_compact', 'Kona Electric': 'crossover_small', 'Santa Fe': 'suv_midsize' },
  Kia: { Ceed: 'compact', K5: 'midsize', Sportage: 'crossover_compact', EV6: 'crossover_compact', 'Niro EV': 'crossover_small', Sorento: 'suv_midsize' },
  Tesla: { 'Model 3': 'premium_compact', 'Model Y': 'premium_suv_compact', 'Model S': 'premium_executive', 'Model X': 'premium_suv_large' },
  Nissan: { Leaf: 'compact', Altima: 'midsize', Juke: 'crossover_small', Qashqai: 'crossover_compact', 'X-Trail': 'crossover_compact' },
  Lexus: { ES: 'premium_executive', NX: 'premium_suv_compact', RX: 'premium_suv_large', LC: 'sports' },
  Porsche: { Macan: 'premium_suv_compact', Cayenne: 'premium_suv_large', Panamera: 'luxury', Taycan: 'luxury', 911: 'sports' },
  Volvo: { S60: 'premium_compact', XC40: 'premium_suv_compact', XC60: 'premium_suv_compact', XC90: 'premium_suv_large' },
  Mazda: { Mazda3: 'compact', Mazda6: 'midsize', 'CX-30': 'crossover_small', 'CX-5': 'crossover_compact', 'CX-9': 'suv_midsize' },
  Ford: { Focus: 'compact', Fusion: 'midsize', Escape: 'crossover_compact', 'Mustang Mach-E': 'crossover_compact', Explorer: 'suv_midsize', Expedition: 'suv_midsize', Mustang: 'sports', Ranger: 'pickup' },
  Renault: { Zoe: 'city', Megane: 'compact', Arkana: 'crossover_small', Duster: 'crossover_small', Kadjar: 'crossover_compact' },
  Honda: { Civic: 'compact', Accord: 'midsize', 'CR-V': 'crossover_compact' },
  Jeep: { Compass: 'crossover_compact', Wrangler: 'suv_midsize', 'Grand Cherokee': 'suv_midsize' },
  'Land Rover': { 'Range Rover Evoque': 'premium_suv_compact', 'Discovery Sport': 'premium_suv_compact', 'Range Rover Sport': 'premium_suv_large' },
  Opel: { Astra: 'compact', Insignia: 'midsize' },
};

/** @returns {string|null} */
export function classOf(make, model) {
  return CLASS_OF[make]?.[model] ?? null;
}

/**
 * Engine-volume proximity (ICE / hybrids only; EVs never compare litres).
 * |Δ litres| → points (max 5): ≤0.1 → 5, ≤0.3 → 4, ≤0.5 → 3, ≤0.8 → 2, ≤1.2 → 1, else 0.
 */
export const ENGINE_BANDS = [
  [0.1, 5],
  [0.3, 4],
  [0.5, 3],
  [0.8, 2],
  [1.2, 1],
];

/**
 * Fuel proximity (max 5): same fuel → 5; related pair → 2; otherwise 0.
 * Related: petrol↔lpg, petrol↔hybrid, hybrid↔plugin_hybrid. Electric relates to nothing.
 */
export const FUEL_RELATED = [
  ['petrol', 'lpg'],
  ['petrol', 'hybrid'],
  ['hybrid', 'plugin_hybrid'],
];
