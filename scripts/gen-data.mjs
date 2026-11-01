#!/usr/bin/env node
/**
 * Deterministic mock catalogue for the demo (no real API yet).  npm run gen:data  [-- --verify]
 *
 * Output (public/data/, served as static JSON; the client module src/lib/api.js mimics the future backend):
 *   catalog.json       every car's card + filter fields (one request feeds the catalog, filters and similar cars)
 *   first.json         first page (24) of the default catalog view
 *   cars/<n>.json      detail chunks of 100 cars: card fields + VIN, description, equipment, gallery (car page)
 *   ../../mock-db/internal.json  NOT served: apiPrice, markup, internal tags, history (the «database» side)
 *   meta.json          anchor time, last sync, totals, makes → models index, ranges, home-page scenes
 *
 * Rules mirrored from the brief:
 *   §4  statuses in_stock / in_transit / sold; sold stay in the archive; relisted cars keep one id + history,
 *       internal tag 'previously_sold', new publishedAt (so «Нові надходження» restarts for them)
 *   §5  publishedAt = first publication by Rezar (sync slots 08:00 / 20:00 Europe/Kyiv, §19)
 *   §6  price = apiPrice + 500 (both stored, markup separate)
 *   §8/§11  some fields intentionally missing (price, mileage, fuel, engine, drive, VIN, trim, description,
 *       equipment) to prove the front end hides empty fields entirely
 * Dates are generated relative to ANCHOR; api.js re-bases them onto the real clock at runtime (whole sync slots),
 * so the demo always looks freshly synced.
 * --verify: HEAD/GET every photo URL the site uses (expects HTTP 200) before writing.
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classOf } from '../src/lib/classes.js';
import { EXTERIOR, INTERIOR, DETAIL, DETAIL_EV, SCENES, ALL_IDS, EXT_COLOR } from './photo-catalog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/data');
const TOTAL = 1200;
const CHUNK = 100;
const FIRST_ID = 10001;
/** generation «now»: 01.11.2026 14:00 Kyiv (UTC+2). The newest sync slot before it: 08:00 the same day. */
export const ANCHOR = Date.parse('2026-11-01T12:00:00Z');
const HOUR = 3600e3;
const DAY = 24 * HOUR;

/* ---------- seeded PRNG (mulberry32) ---------- */
let seed = 0x5eed2026;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
function weighted(pairs) {
  const sum = pairs.reduce((s, [, w]) => s + w, 0);
  let x = rnd() * sum;
  for (const [v, w] of pairs) if ((x -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- model table ----------
   [model, body, yearFrom, yearTo, basePrice (USD, newest year, typical import condition), powertrains, weight]
   powertrain: [fuel, engineLitres|null, drive options, gearbox, hp, batteryKwh?] */
const P = (fuel, engine, drive, gearbox, hp, battery) => ({ fuel, engine, drive, gearbox, hp, battery });
const MODELS = {
  Toyota: [
    ['Camry', 'sedan', 2017, 2024, 27500, [P('petrol', 2.5, ['fwd'], 'automatic', 203), P('hybrid', 2.5, ['fwd'], 'cvt', 218)], 9],
    ['RAV4', 'suv', 2018, 2024, 31500, [P('petrol', 2.5, ['awd', 'fwd'], 'automatic', 203), P('hybrid', 2.5, ['awd'], 'cvt', 219), P('plugin_hybrid', 2.5, ['awd'], 'cvt', 302)], 10],
    ['Corolla', 'sedan', 2018, 2024, 19800, [P('petrol', 1.8, ['fwd'], 'cvt', 139), P('hybrid', 1.8, ['fwd'], 'cvt', 121)], 6],
    ['Land Cruiser Prado', 'suv', 2016, 2023, 47000, [P('diesel', 2.8, ['awd'], 'automatic', 204), P('petrol', 4.0, ['awd'], 'automatic', 282)], 4],
    ['Highlander', 'suv', 2017, 2023, 38500, [P('petrol', 3.5, ['awd'], 'automatic', 295), P('hybrid', 2.5, ['awd'], 'cvt', 243)], 4],
    ['Tacoma', 'pickup', 2017, 2023, 33000, [P('petrol', 3.5, ['awd'], 'automatic', 278)], 2],
  ],
  BMW: [
    ['3 Series', 'sedan', 2017, 2024, 33500, [P('petrol', 2.0, ['rwd', 'awd'], 'automatic', 255), P('diesel', 2.0, ['rwd', 'awd'], 'automatic', 190), P('plugin_hybrid', 2.0, ['rwd'], 'automatic', 292)], 9],
    ['4 Series', 'coupe', 2018, 2024, 41000, [P('petrol', 2.0, ['rwd', 'awd'], 'automatic', 255), P('petrol', 3.0, ['awd'], 'automatic', 382)], 3],
    ['5 Series', 'sedan', 2017, 2024, 42000, [P('petrol', 2.0, ['rwd', 'awd'], 'automatic', 248), P('diesel', 3.0, ['awd'], 'automatic', 286), P('plugin_hybrid', 2.0, ['awd'], 'automatic', 288)], 8],
    ['7 Series', 'sedan', 2016, 2023, 58000, [P('petrol', 3.0, ['awd'], 'automatic', 335), P('diesel', 3.0, ['awd'], 'automatic', 320)], 3],
    ['X3', 'suv', 2018, 2024, 41500, [P('petrol', 2.0, ['awd'], 'automatic', 248), P('diesel', 2.0, ['awd'], 'automatic', 190)], 8],
    ['X5', 'suv', 2017, 2024, 56000, [P('petrol', 3.0, ['awd'], 'automatic', 335), P('diesel', 3.0, ['awd'], 'automatic', 286), P('plugin_hybrid', 3.0, ['awd'], 'automatic', 389)], 8],
    ['X6', 'suv', 2017, 2023, 61000, [P('petrol', 3.0, ['awd'], 'automatic', 335), P('diesel', 3.0, ['awd'], 'automatic', 286)], 3],
    ['i4', 'liftback', 2022, 2024, 47000, [P('electric', null, ['rwd', 'awd'], 'automatic', 340, 81)], 3],
    ['iX3', 'suv', 2021, 2024, 43000, [P('electric', null, ['rwd'], 'automatic', 286, 80)], 2],
  ],
  Audi: [
    ['A4', 'sedan', 2017, 2024, 32000, [P('petrol', 2.0, ['fwd', 'awd'], 'robot', 201), P('diesel', 2.0, ['awd'], 'robot', 190)], 7],
    ['A5', 'liftback', 2017, 2024, 38000, [P('petrol', 2.0, ['awd'], 'robot', 261)], 3],
    ['A6', 'sedan', 2017, 2024, 41000, [P('petrol', 2.0, ['awd'], 'robot', 261), P('diesel', 3.0, ['awd'], 'automatic', 286)], 6],
    ['A7', 'liftback', 2018, 2023, 52000, [P('petrol', 3.0, ['awd'], 'robot', 335)], 2],
    ['Q5', 'suv', 2017, 2024, 41000, [P('petrol', 2.0, ['awd'], 'robot', 261), P('diesel', 2.0, ['awd'], 'robot', 204), P('plugin_hybrid', 2.0, ['awd'], 'robot', 362)], 8],
    ['Q7', 'suv', 2016, 2024, 52000, [P('petrol', 3.0, ['awd'], 'automatic', 335), P('diesel', 3.0, ['awd'], 'automatic', 286)], 6],
    ['Q8', 'suv', 2019, 2024, 66000, [P('petrol', 3.0, ['awd'], 'automatic', 335)], 2],
    ['e-tron', 'suv', 2019, 2023, 42000, [P('electric', null, ['awd'], 'automatic', 402, 95)], 4],
  ],
  'Mercedes-Benz': [
    ['C-Class', 'sedan', 2017, 2024, 36000, [P('petrol', 2.0, ['rwd', 'awd'], 'automatic', 255), P('diesel', 2.0, ['rwd'], 'automatic', 194)], 8],
    ['CLA', 'sedan', 2019, 2024, 32000, [P('petrol', 2.0, ['fwd', 'awd'], 'robot', 221)], 3],
    ['E-Class', 'sedan', 2017, 2024, 45000, [P('petrol', 2.0, ['rwd', 'awd'], 'automatic', 255), P('diesel', 2.0, ['awd'], 'automatic', 194), P('plugin_hybrid', 2.0, ['rwd'], 'automatic', 320)], 7],
    ['S-Class', 'sedan', 2016, 2023, 72000, [P('petrol', 3.0, ['awd'], 'automatic', 429), P('diesel', 2.9, ['awd'], 'automatic', 330)], 3],
    ['GLC', 'suv', 2017, 2024, 43000, [P('petrol', 2.0, ['awd'], 'automatic', 255), P('diesel', 2.0, ['awd'], 'automatic', 194)], 8],
    ['GLE', 'suv', 2017, 2024, 58000, [P('petrol', 3.0, ['awd'], 'automatic', 362), P('diesel', 2.9, ['awd'], 'automatic', 330)], 6],
    ['G-Class', 'suv', 2017, 2023, 125000, [P('petrol', 4.0, ['awd'], 'automatic', 416)], 1],
  ],
  Volkswagen: [
    ['Polo', 'hatchback', 2017, 2023, 13500, [P('petrol', 1.0, ['fwd'], 'robot', 95), P('petrol', 1.6, ['fwd'], 'manual', 110)], 4],
    ['Golf', 'hatchback', 2017, 2024, 18500, [P('petrol', 1.4, ['fwd'], 'robot', 150), P('diesel', 2.0, ['fwd'], 'robot', 150)], 8],
    ['e-Golf', 'hatchback', 2017, 2020, 15500, [P('electric', null, ['fwd'], 'automatic', 136, 35.8)], 4],
    ['Jetta', 'sedan', 2017, 2023, 17500, [P('petrol', 1.4, ['fwd'], 'automatic', 150)], 5],
    ['Passat', 'sedan', 2016, 2023, 21000, [P('petrol', 2.0, ['fwd'], 'automatic', 174), P('diesel', 2.0, ['fwd', 'awd'], 'robot', 190)], 8],
    ['Tiguan', 'suv', 2017, 2024, 27500, [P('petrol', 2.0, ['fwd', 'awd'], 'automatic', 184), P('diesel', 2.0, ['awd'], 'robot', 190)], 9],
    ['ID.4', 'suv', 2021, 2024, 31000, [P('electric', null, ['rwd', 'awd'], 'automatic', 204, 77)], 5],
    ['Touareg', 'suv', 2017, 2023, 48000, [P('diesel', 3.0, ['awd'], 'automatic', 286), P('petrol', 3.0, ['awd'], 'automatic', 340)], 3],
  ],
  Skoda: [
    ['Octavia', 'liftback', 2017, 2024, 19500, [P('petrol', 1.4, ['fwd'], 'robot', 150), P('diesel', 2.0, ['fwd'], 'robot', 150), P('lpg', 1.4, ['fwd'], 'manual', 150)], 9],
    ['Superb', 'liftback', 2017, 2024, 26500, [P('petrol', 2.0, ['fwd', 'awd'], 'robot', 190), P('diesel', 2.0, ['fwd'], 'robot', 190)], 6],
    ['Kodiaq', 'suv', 2017, 2024, 29000, [P('petrol', 2.0, ['awd'], 'robot', 190), P('diesel', 2.0, ['awd'], 'robot', 190)], 6],
    ['Enyaq', 'suv', 2021, 2024, 33000, [P('electric', null, ['rwd', 'awd'], 'automatic', 204, 77)], 3],
  ],
  Hyundai: [
    ['Accent', 'sedan', 2017, 2022, 12500, [P('petrol', 1.6, ['fwd'], 'automatic', 123)], 3],
    ['Elantra', 'sedan', 2017, 2024, 16500, [P('petrol', 2.0, ['fwd'], 'cvt', 147)], 6],
    ['Sonata', 'sedan', 2017, 2023, 19500, [P('petrol', 2.5, ['fwd'], 'automatic', 191), P('hybrid', 2.0, ['fwd'], 'automatic', 192), P('lpg', 2.0, ['fwd'], 'automatic', 146)], 6],
    ['Tucson', 'suv', 2017, 2024, 24500, [P('petrol', 2.0, ['fwd', 'awd'], 'automatic', 156), P('hybrid', 1.6, ['awd'], 'automatic', 230), P('diesel', 2.0, ['awd'], 'automatic', 185)], 8],
    ['Ioniq 5', 'suv', 2022, 2024, 36000, [P('electric', null, ['rwd', 'awd'], 'automatic', 320, 77.4)], 4],
    ['Kona Electric', 'suv', 2019, 2023, 22500, [P('electric', null, ['fwd'], 'automatic', 204, 64)], 4],
    ['Santa Fe', 'suv', 2017, 2023, 29000, [P('petrol', 2.5, ['awd'], 'automatic', 191), P('diesel', 2.2, ['awd'], 'automatic', 200)], 5],
  ],
  Kia: [
    ['Ceed', 'hatchback', 2018, 2024, 16500, [P('petrol', 1.6, ['fwd'], 'automatic', 128), P('petrol', 1.4, ['fwd'], 'robot', 140)], 4],
    ['K5', 'sedan', 2020, 2024, 22000, [P('petrol', 2.5, ['fwd'], 'automatic', 191), P('lpg', 2.0, ['fwd'], 'automatic', 146)], 5],
    ['Sportage', 'suv', 2017, 2024, 24000, [P('petrol', 2.0, ['fwd', 'awd'], 'automatic', 156), P('diesel', 2.0, ['awd'], 'automatic', 185), P('hybrid', 1.6, ['awd'], 'automatic', 230)], 8],
    ['EV6', 'suv', 2022, 2024, 38000, [P('electric', null, ['rwd', 'awd'], 'automatic', 325, 77.4)], 3],
    ['Niro EV', 'suv', 2019, 2023, 23500, [P('electric', null, ['fwd'], 'automatic', 204, 64)], 4],
    ['Sorento', 'suv', 2017, 2024, 30000, [P('petrol', 2.5, ['awd'], 'automatic', 191), P('diesel', 2.2, ['awd'], 'robot', 202), P('hybrid', 1.6, ['awd'], 'automatic', 230)], 5],
  ],
  Tesla: [
    ['Model 3', 'sedan', 2018, 2024, 29500, [P('electric', null, ['rwd'], 'automatic', 283, 60), P('electric', null, ['awd'], 'automatic', 498, 82)], 10],
    ['Model Y', 'suv', 2020, 2024, 34500, [P('electric', null, ['awd'], 'automatic', 384, 75), P('electric', null, ['rwd'], 'automatic', 299, 60)], 9],
    ['Model S', 'liftback', 2016, 2023, 47000, [P('electric', null, ['awd'], 'automatic', 670, 100)], 3],
    ['Model X', 'suv', 2017, 2023, 56000, [P('electric', null, ['awd'], 'automatic', 670, 100)], 2],
  ],
  Nissan: [
    ['Leaf', 'hatchback', 2017, 2023, 13500, [P('electric', null, ['fwd'], 'automatic', 150, 40), P('electric', null, ['fwd'], 'automatic', 217, 62)], 8],
    ['Altima', 'sedan', 2017, 2023, 17500, [P('petrol', 2.5, ['fwd', 'awd'], 'cvt', 188)], 4],
    ['Juke', 'suv', 2017, 2023, 15500, [P('petrol', 1.6, ['fwd'], 'cvt', 117)], 3],
    ['Qashqai', 'suv', 2017, 2024, 21000, [P('petrol', 1.3, ['fwd'], 'cvt', 158), P('diesel', 1.5, ['fwd'], 'manual', 115)], 6],
    ['X-Trail', 'suv', 2017, 2023, 23000, [P('petrol', 2.5, ['awd'], 'cvt', 181), P('diesel', 1.6, ['awd'], 'cvt', 130)], 4],
  ],
  Lexus: [
    ['ES', 'sedan', 2017, 2024, 38000, [P('petrol', 3.5, ['fwd'], 'automatic', 302), P('hybrid', 2.5, ['fwd'], 'cvt', 215)], 5],
    ['NX', 'suv', 2017, 2024, 39000, [P('petrol', 2.0, ['awd'], 'automatic', 238), P('hybrid', 2.5, ['awd'], 'cvt', 194)], 6],
    ['RX', 'suv', 2017, 2024, 48000, [P('petrol', 3.5, ['awd'], 'automatic', 295), P('hybrid', 3.5, ['awd'], 'cvt', 308)], 6],
    ['LC', 'coupe', 2018, 2023, 78000, [P('petrol', 5.0, ['rwd'], 'automatic', 471)], 1],
  ],
  Porsche: [
    ['Macan', 'suv', 2017, 2024, 52000, [P('petrol', 2.0, ['awd'], 'robot', 265), P('petrol', 2.9, ['awd'], 'robot', 380)], 4],
    ['Cayenne', 'suv', 2017, 2024, 74000, [P('petrol', 3.0, ['awd'], 'automatic', 340), P('plugin_hybrid', 3.0, ['awd'], 'automatic', 462)], 4],
    ['Panamera', 'liftback', 2017, 2023, 82000, [P('petrol', 2.9, ['rwd', 'awd'], 'robot', 330)], 2],
    ['Taycan', 'liftback', 2020, 2024, 79000, [P('electric', null, ['rwd', 'awd'], 'automatic', 408, 93.4)], 2],
    ['911', 'coupe', 2017, 2024, 112000, [P('petrol', 3.0, ['rwd', 'awd'], 'robot', 385)], 2],
  ],
  Volvo: [
    ['S60', 'sedan', 2019, 2024, 33000, [P('petrol', 2.0, ['fwd', 'awd'], 'automatic', 250)], 3],
    ['XC40', 'suv', 2018, 2024, 31500, [P('petrol', 2.0, ['fwd', 'awd'], 'automatic', 197), P('electric', null, ['awd'], 'automatic', 408, 78)], 5],
    ['XC60', 'suv', 2017, 2024, 41000, [P('petrol', 2.0, ['awd'], 'automatic', 250), P('diesel', 2.0, ['awd'], 'automatic', 235), P('plugin_hybrid', 2.0, ['awd'], 'automatic', 455)], 6],
    ['XC90', 'suv', 2017, 2024, 52000, [P('petrol', 2.0, ['awd'], 'automatic', 300), P('diesel', 2.0, ['awd'], 'automatic', 235)], 5],
  ],
  Mazda: [
    ['Mazda3', 'hatchback', 2017, 2024, 19000, [P('petrol', 2.0, ['fwd'], 'automatic', 155), P('petrol', 2.5, ['fwd', 'awd'], 'automatic', 186)], 5],
    ['Mazda6', 'sedan', 2017, 2022, 21500, [P('petrol', 2.5, ['fwd'], 'automatic', 187)], 4],
    ['CX-30', 'suv', 2020, 2024, 23500, [P('petrol', 2.5, ['fwd', 'awd'], 'automatic', 186)], 4],
    ['CX-5', 'suv', 2017, 2024, 25500, [P('petrol', 2.5, ['awd', 'fwd'], 'automatic', 187), P('diesel', 2.2, ['awd'], 'automatic', 184)], 8],
    ['CX-9', 'suv', 2017, 2023, 30000, [P('petrol', 2.5, ['awd'], 'automatic', 250)], 3],
  ],
  Ford: [
    ['Focus', 'hatchback', 2017, 2022, 13500, [P('petrol', 1.0, ['fwd'], 'automatic', 125), P('diesel', 1.5, ['fwd'], 'manual', 120)], 5],
    ['Fusion', 'sedan', 2016, 2020, 15500, [P('petrol', 2.5, ['fwd'], 'automatic', 175), P('hybrid', 2.0, ['fwd'], 'cvt', 188)], 6],
    ['Escape', 'suv', 2017, 2023, 20500, [P('petrol', 1.5, ['fwd', 'awd'], 'automatic', 181), P('hybrid', 2.5, ['awd'], 'cvt', 200)], 6],
    ['Mustang Mach-E', 'suv', 2021, 2024, 35000, [P('electric', null, ['rwd', 'awd'], 'automatic', 346, 88)], 4],
    ['Explorer', 'suv', 2017, 2023, 32000, [P('petrol', 2.3, ['awd'], 'automatic', 300), P('hybrid', 3.3, ['awd'], 'automatic', 318)], 5],
    ['Expedition', 'suv', 2018, 2023, 47000, [P('petrol', 3.5, ['awd'], 'automatic', 375)], 1],
    ['Mustang', 'coupe', 2017, 2024, 31000, [P('petrol', 2.3, ['rwd'], 'automatic', 310), P('petrol', 5.0, ['rwd'], 'automatic', 450)], 3],
    ['Ranger', 'pickup', 2019, 2024, 30500, [P('diesel', 2.0, ['awd'], 'automatic', 213), P('petrol', 2.3, ['awd'], 'automatic', 270)], 3],
  ],
  Renault: [
    ['Zoe', 'hatchback', 2017, 2022, 11500, [P('electric', null, ['fwd'], 'automatic', 136, 52)], 4],
    ['Megane', 'hatchback', 2017, 2023, 14000, [P('diesel', 1.5, ['fwd'], 'manual', 115), P('petrol', 1.3, ['fwd'], 'robot', 140)], 6],
    ['Arkana', 'suv', 2020, 2024, 19500, [P('petrol', 1.3, ['fwd'], 'cvt', 150)], 3],
    ['Duster', 'suv', 2018, 2024, 15000, [P('diesel', 1.5, ['fwd', 'awd'], 'manual', 115), P('lpg', 1.6, ['fwd'], 'manual', 114)], 5],
    ['Kadjar', 'suv', 2017, 2022, 16500, [P('diesel', 1.5, ['fwd'], 'robot', 115)], 3],
  ],
  Honda: [
    ['Civic', 'sedan', 2017, 2024, 19500, [P('petrol', 1.5, ['fwd'], 'cvt', 180), P('petrol', 2.0, ['fwd'], 'cvt', 158)], 5],
    ['Accord', 'sedan', 2018, 2023, 24000, [P('petrol', 1.5, ['fwd'], 'cvt', 192), P('hybrid', 2.0, ['fwd'], 'cvt', 212)], 4],
    ['CR-V', 'suv', 2017, 2024, 26000, [P('petrol', 1.5, ['awd'], 'cvt', 190), P('hybrid', 2.0, ['awd'], 'cvt', 212)], 6],
  ],
  Jeep: [
    ['Compass', 'suv', 2017, 2023, 20500, [P('petrol', 2.4, ['awd', 'fwd'], 'automatic', 180)], 4],
    ['Wrangler', 'suv', 2018, 2024, 36000, [P('petrol', 2.0, ['awd'], 'automatic', 270), P('plugin_hybrid', 2.0, ['awd'], 'automatic', 375)], 3],
    ['Grand Cherokee', 'suv', 2017, 2023, 33000, [P('petrol', 3.6, ['awd'], 'automatic', 293), P('diesel', 3.0, ['awd'], 'automatic', 250)], 5],
  ],
  'Land Rover': [
    ['Range Rover Evoque', 'suv', 2017, 2024, 36000, [P('petrol', 2.0, ['awd'], 'automatic', 249), P('diesel', 2.0, ['awd'], 'automatic', 180)], 3],
    ['Discovery Sport', 'suv', 2017, 2023, 30000, [P('diesel', 2.0, ['awd'], 'automatic', 180), P('petrol', 2.0, ['awd'], 'automatic', 249)], 3],
    ['Range Rover Sport', 'suv', 2017, 2024, 68000, [P('diesel', 3.0, ['awd'], 'automatic', 300), P('petrol', 3.0, ['awd'], 'automatic', 400)], 3],
  ],
  Opel: [
    ['Astra', 'hatchback', 2017, 2022, 12500, [P('diesel', 1.6, ['fwd'], 'manual', 136), P('petrol', 1.4, ['fwd'], 'automatic', 150)], 3],
    ['Insignia', 'liftback', 2017, 2022, 15500, [P('diesel', 2.0, ['fwd'], 'automatic', 170)], 3],
  ],
};
const MAKE_WEIGHT = {
  Toyota: 10, BMW: 12, Audi: 10, 'Mercedes-Benz': 10, Volkswagen: 10, Skoda: 6, Hyundai: 6, Kia: 6, Tesla: 8, Nissan: 5,
  Lexus: 4, Porsche: 3, Volvo: 4, Mazda: 4, Ford: 6, Renault: 4, Honda: 3, Jeep: 2, 'Land Rover': 2, Opel: 2,
};

const WMI = {
  Toyota: 'JTD', BMW: 'WBA', Audi: 'WAU', 'Mercedes-Benz': 'WDD', Volkswagen: 'WVW', Skoda: 'TMB', Hyundai: 'KMH', Kia: 'KNA',
  Tesla: '5YJ', Nissan: 'JN1', Lexus: 'JTH', Porsche: 'WP0', Volvo: 'YV1', Mazda: 'JM1', Ford: '1FA', Renault: 'VF1',
  Honda: 'JHM', Jeep: '1C4', 'Land Rover': 'SAL', Opel: 'W0L',
};
const VIN_CH = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
const vin = (make, year) => {
  let s = WMI[make];
  for (let i = 0; i < 6; i++) s += pick(VIN_CH);
  s += pick('0123456789X');
  s += 'ABCDEFGHJKLMNPRSTVWXY123456789'[(year - 2010) % 30];
  s += pick(VIN_CH);
  for (let i = 0; i < 6; i++) s += pick('0123456789');
  return s;
};

const TRIMS = {
  premium: ['M Sport', 'S line', 'AMG Line', 'Luxury Line', 'Business', 'Premium Plus', 'Sport', 'Executive', 'Inscription', 'R-Design', 'F Sport'],
  mass: ['Comfort', 'Style', 'Elegance', 'Highline', 'Limited', 'SE', 'SEL', 'Prestige', 'GT-Line', 'Titanium', 'Touring', 'Active'],
  ev: ['Long Range', 'Performance', 'Standard Range', 'Pro', 'Max', 'GT', 'Plus'],
};
/** brand-correct trim names (a Mercedes is never «R-Design»); EVs share TRIMS.ev unless the brand has its own */
const BRAND_TRIMS = {
  BMW: ['M Sport', 'Luxury Line', 'Sport Line', 'xLine', 'Business'],
  Audi: ['S line', 'Sport', 'Design', 'Advanced', 'Business'],
  'Mercedes-Benz': ['AMG Line', 'Avantgarde', 'Exclusive', 'Business', 'Night Edition'],
  Lexus: ['F Sport', 'Luxury', 'Executive', 'Premium'],
  Porsche: ['Base', 'S', 'GTS', 'Platinum Edition'],
  Volvo: ['Momentum', 'Inscription', 'R-Design', 'Plus', 'Ultimate'],
  'Land Rover': ['S', 'SE', 'HSE', 'Dynamic SE', 'Autobiography'],
  Tesla: ['Long Range', 'Performance', 'Standard Range', 'Plaid'],
  Toyota: ['Comfort', 'Style', 'Prestige', 'Limited', 'XLE', 'LE'],
  Volkswagen: ['Trendline', 'Comfortline', 'Highline', 'R-Line', 'Life'],
  Skoda: ['Active', 'Ambition', 'Style', 'L&K', 'Sportline'],
  Hyundai: ['Comfort', 'Elegance', 'Premium', 'Limited', 'N Line'],
  Kia: ['Comfort', 'Prestige', 'GT-Line', 'EX', 'SX'],
  Nissan: ['Acenta', 'N-Connecta', 'Tekna', 'SV', 'SL'],
  Mazda: ['Touring', 'Style', 'Premium', 'Signature', 'Grand Touring'],
  Ford: ['Titanium', 'ST-Line', 'SE', 'SEL', 'Limited'],
  Renault: ['Life', 'Zen', 'Intens', 'Techno'],
  Honda: ['Elegance', 'Executive', 'EX', 'Touring', 'Sport'],
  Jeep: ['Sport', 'Latitude', 'Limited', 'Trailhawk', 'Overland'],
  Opel: ['Edition', 'Elegance', 'GS Line', 'Ultimate'],
};
const PREMIUM = new Set(['BMW', 'Audi', 'Mercedes-Benz', 'Lexus', 'Porsche', 'Volvo', 'Land Rover', 'Tesla']);
const COLORS = [['Чорний', 18], ['Білий', 16], ['Сірий', 16], ['Сріблястий', 12], ['Синій', 10], ['Графітовий', 10], ['Червоний', 5], ['Зелений', 3], ['Бежевий', 2], ['Коричневий', 2]];
const ORIGIN = [['США', 55], ['Німеччина', 14], ['Польща', 7], ['Литва', 6], ['Південна Корея', 6], ['Канада', 5], ['Нідерланди', 4], ['Бельгія', 3]];
const EQUIP = {
  base: ['Клімат-контроль', 'Камера заднього виду', 'Парктроніки', 'Круїз-контроль', 'Apple CarPlay / Android Auto', 'Підігрів передніх сидінь', 'LED-фари', 'Безключовий доступ', 'Датчики дощу та світла', 'Електросклопідйомники', 'Мультифункціональне кермо', 'Легкосплавні диски'],
  plus: ['Шкіряний салон', 'Панорамний дах', 'Адаптивний круїз-контроль', 'Камери 360°', 'Підігрів керма', 'Вентиляція сидінь', 'Електропривід багажника', 'Head-up дисплей', 'Аудіосистема преміум-класу', 'Система утримання смуги', 'Моніторинг сліпих зон', 'Матричні фари', 'Пневмопідвіска', 'Пам’ять сидінь', 'Безпроводова зарядка', 'Цифрова панель приладів'],
  ev: ['Теплова помпа', 'Швидка зарядка DC', 'Рекуперація з регулюванням', 'Зарядний кабель Type 2', 'Попереднє прогрівання салону'],
};
const FUEL_UA = { petrol: 'бензиновий', diesel: 'дизельний', hybrid: 'гібридний', plugin_hybrid: 'плагін-гібридний', electric: 'електричний', lpg: 'з ГБО' };

/* ---------- time helpers: Rezar sync slots 08:00 / 20:00 Europe/Kyiv ---------- */
// November 2026 is UTC+2 (DST ended 25.10.2026); slots before 25.10 are UTC+3. Good enough for a mock.
const kyivOffsetH = (ms) => (ms < Date.parse('2026-10-25T01:00:00Z') ? 3 : 2);
function slotsBack(n) {
  // n = 0 → newest slot at/before ANCHOR (01.11 08:00), then every 12 h back
  const newest = Date.parse('2026-11-01T06:00:00Z'); // 08:00 Kyiv
  const t = newest - n * 12 * HOUR;
  // keep wall-clock 08:00/20:00 across the DST change
  return t + (kyivOffsetH(newest) - kyivOffsetH(t)) * HOUR;
}
const MAX_SLOT = 180; // 90 days

/* ---------- build ---------- */
const makeList = Object.keys(MODELS).map((m) => [m, MAKE_WEIGHT[m] ?? 2]);
const cars = [];
const details = [];

function photoPool(make, body, ev) {
  let own = EXTERIOR.filter((p) => p.make === make && p.body === body && (!!p.ev === !!ev || !ev));
  if (!own.length) own = EXTERIOR.filter((p) => p.make === make && (p.body === body || (body === 'liftback' && p.body === 'sedan') || (body === 'sedan' && p.body === 'liftback')));
  if (!own.length && ev) own = EXTERIOR.filter((p) => p.ev && p.body === body);
  if (!own.length) own = EXTERIOR.filter((p) => p.make === make);
  const sameBody = EXTERIOR.filter((p) => p.body === body && p.make !== make);
  return { own, sameBody };
}

function priceFor(base, year, yearTo, mileage, premium) {
  const age = yearTo - year;
  let v = base * Math.pow(premium ? 0.88 : 0.9, age);
  v *= 1 - Math.min(0.22, Math.max(-0.05, (mileage - age * 15000) / 600000));
  v *= 0.9 + rnd() * 0.2;
  return Math.max(4500, Math.round(v / 100) * 100);
}

for (let i = 0; i < TOTAL; i++) {
  const id = FIRST_ID + i;
  const make = weighted(makeList);
  const [model, body, yFrom, yTo, base, pts] = weighted(MODELS[make].map((m) => [m, m[6]]));
  const pt = pick(pts);
  const year = ri(Math.max(yFrom, 2015), yTo);
  const age = 2026 - year;
  const ev = pt.fuel === 'electric';
  const premium = PREMIUM.has(make);
  const mileage = Math.max(800, Math.round((age * ri(9000, 21000) + ri(-4000, 6000)) / 100) * 100);
  const apiPrice = priceFor(base, year, yTo, mileage, premium);
  const status = weighted([['in_stock', 52], ['in_transit', 28], ['sold', 20]]);

  // publication slot: denser in the recent weeks; the newest two slots always get a few cars (hours-ago labels)
  let slot = i < 8 ? 0 : i < 14 ? 1 : Math.min(MAX_SLOT, Math.floor(Math.pow(rnd(), 1.25) * MAX_SLOT));
  if (status === 'sold' && slot < 6) slot += ri(6, 40);
  let publishedAt = slotsBack(slot) + ri(0, 25) * 60e3; // the sync run takes a few minutes
  let firstPublishedAt = publishedAt;
  let history;
  let soldAt;
  const tags = [];
  // a few relisted cars (§4): sold once, came back — same id, history kept, new publication date
  if (status !== 'sold' && i % 61 === 7) {
    const relistSlot = ri(0, 26);
    firstPublishedAt = slotsBack(ri(120, MAX_SLOT + 60));
    const firstSold = firstPublishedAt + ri(8, 30) * DAY;
    publishedAt = slotsBack(relistSlot) + ri(0, 25) * 60e3;
    history = [
      { event: 'published', at: new Date(firstPublishedAt).toISOString() },
      { event: 'sold', at: new Date(firstSold).toISOString() },
      { event: 'relisted', at: new Date(publishedAt).toISOString() },
    ];
    tags.push('previously_sold');
  }
  if (status === 'sold') {
    soldAt = Math.min(ANCHOR - 2 * HOUR, publishedAt + ri(2, 40) * DAY);
    history = [
      { event: 'published', at: new Date(publishedAt).toISOString() },
      { event: 'sold', at: new Date(soldAt).toISOString() },
    ];
  }

  // photos
  const { own, sameBody } = photoPool(make, body, ev);
  const ext = shuffle([...own]);
  const extra = shuffle([...sameBody]).slice(0, own.length < 3 ? 2 : 0);
  const exterior = [...ext.slice(0, 4), ...extra].map((p) => p.id);
  const interior = shuffle([...INTERIOR]).slice(0, ri(2, 5));
  const det = shuffle([...DETAIL]).slice(0, ri(1, 2));
  const evDet = ev ? shuffle([...DETAIL_EV]).slice(0, 1) : [];
  let gallery = [...exterior, ...interior, ...det, ...evDet];
  if (status === 'sold' && chance(0.3)) gallery = gallery.slice(0, Math.max(3, gallery.length - 3));
  gallery = [...new Set(gallery)];

  const trimPool = make === 'Tesla' || !BRAND_TRIMS[make] ? (ev ? TRIMS.ev : premium ? TRIMS.premium : TRIMS.mass) : ev ? TRIMS.ev : BRAND_TRIMS[make];
  const drive = pick(pt.drive);
  const engine = pt.engine;

  /** card + filter fields (catalog.json). Missing values are omitted entirely (never null / "немає даних"). */
  const car = { id, make, model, year, body, cls: classOf(make, model), status, publishedAt: new Date(publishedAt).toISOString() };
  const hidePrice = chance(0.015);
  if (!hidePrice) {
    car.apiPrice = apiPrice;
    car.markup = 500;
    car.price = apiPrice + 500;
  }
  if (!chance(0.04)) car.mileage = mileage;
  if (!chance(0.02)) car.fuel = pt.fuel;
  if (engine && !chance(0.05)) car.engine = engine;
  if (ev && pt.battery) car.battery = pt.battery;
  if (!chance(0.08)) car.drive = drive;
  if (!chance(0.05)) car.gearbox = pt.gearbox;
  if (!chance(0.1)) car.trim = pick(trimPool);
  if (!chance(0.06)) car.power = pt.hp;
  const rolledColor = weighted(COLORS); // keep the RNG sequence identical; the photo decides when it can
  car.color = EXT_COLOR[gallery[0]] ?? rolledColor;
  car.photo = gallery[0];
  car.photos = gallery.length;
  cars.push(car);

  /** details (cars/<n>.json) */
  const korean = make === 'Hyundai' || make === 'Kia';
  const d = { id, gallery, origin: weighted(ORIGIN.filter(([o]) => korean || o !== 'Південна Корея')) };
  if (!chance(0.15)) d.vin = vin(make, year);
  if (!chance(0.15)) {
    const eq = shuffle([...EQUIP.base]).slice(0, ri(5, 9));
    if (premium || chance(0.35)) eq.push(...shuffle([...EQUIP.plus]).slice(0, ri(3, premium ? 9 : 4)));
    if (ev) eq.push(...shuffle([...EQUIP.ev]).slice(0, ri(2, 4)));
    d.equipment = eq;
  }
  if (!chance(0.2)) {
    const km = car.mileage ? `${car.mileage.toLocaleString('uk-UA').replace(/\s/g, ' ')} км пробігу` : 'перевірений пробіг';
    const pw = ev ? `${FUEL_UA.electric} привід${pt.battery ? `, батарея ${pt.battery} кВт·год` : ''}` : `${FUEL_UA[pt.fuel]} двигун${engine ? ` ${engine.toFixed(1)} л` : ''}`;
    d.description = [
      `${make} ${model} ${year} року${car.trim ? ` у комплектації ${car.trim}` : ''}: ${pw}, ${km}.`,
      status === 'in_transit'
        ? 'Авто вже викуплене й прямує в Україну; орієнтовну дату прибуття менеджер уточнить під час дзвінка.'
        : status === 'sold'
          ? 'Авто продане. Підберемо схожий варіант у наявності або в дорозі.'
          : 'Авто в Україні, розмитнене, готове до огляду та тест-драйву.',
      'Перед угодою — повна перевірка історії за VIN і технічна діагностика. Ціна фіксується в договорі.',
    ].join(' ');
  }
  if (history) d.history = history;
  if (soldAt) d.soldAt = new Date(soldAt).toISOString();
  if (tags.length) d.tags = tags;
  details.push(d);
}

/* ---------- meta ---------- */
const makes = {};
for (const c of cars) {
  const m = (makes[c.make] ??= { make: c.make, count: 0, models: {} });
  m.count++;
  m.models[c.model] = (m.models[c.model] ?? 0) + 1;
}
const range = (key) => {
  const v = cars.map((c) => c[key]).filter((x) => x != null);
  return [Math.min(...v), Math.max(...v)];
};
const meta = {
  version: 1,
  anchor: new Date(ANCHOR).toISOString(),
  lastSyncAt: new Date(slotsBack(0) + 26 * 60e3).toISOString(),
  syncSlots: ['08:00', '20:00'],
  timezone: 'Europe/Kyiv',
  markupUsd: 500,
  total: cars.length,
  chunkSize: CHUNK,
  firstId: FIRST_ID,
  counts: {
    in_stock: cars.filter((c) => c.status === 'in_stock').length,
    in_transit: cars.filter((c) => c.status === 'in_transit').length,
    sold: cars.filter((c) => c.status === 'sold').length,
  },
  makes: Object.values(makes)
    .sort((a, b) => a.make.localeCompare(b.make))
    .map((m) => ({ make: m.make, count: m.count, models: Object.entries(m.models).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([model, count]) => ({ model, count })) })),
  ranges: { year: range('year'), price: range('price'), mileage: range('mileage') },
  scenes: SCENES,
};

/* ---------- optional photo verification ---------- */
if (process.argv.includes('--verify')) {
  const bad = [];
  const ids = [...ALL_IDS];
  let n = 0;
  await Promise.all(
    Array.from({ length: 12 }, async () => {
      while (ids.length) {
        const pid = ids.pop();
        const url = `https://images.unsplash.com/photo-${pid}?w=800&h=600&fit=crop&auto=format&q=70`;
        try {
          const r = await fetch(url, { method: 'GET', headers: { Accept: 'image/avif,image/webp,*/*' } });
          if (r.status !== 200) bad.push(`${pid} → ${r.status}`);
          await r.arrayBuffer();
        } catch (e) {
          bad.push(`${pid} → ${e.message}`);
        }
        n++;
      }
    }),
  );
  if (bad.length) {
    console.error(`photo check failed (${bad.length}/${n}):\n  ${bad.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`photos verified: ${n}/${n} HTTP 200`);
}

/* ---------- write ---------- */
/*
 * Public files (served to the browser) carry only what the site may show: the final price, never the supplier price
 * or the markup (§6), and never the internal «ранее продавалась» tag / sale history (§4). Those live in the mock
 * «database» file mock-db/internal.json — outside public/, so it is never deployed (the real backend keeps them in
 * PostgreSQL and does not send them to the browser).
 *   catalog.json  every car's card + filter fields (catalog filters / facets / similar cars)
 *   first.json    the first page (24) of the default catalog view — what the real API answers to GET /cars
 *   cars/<n>.json detail chunks of 100: card fields + gallery, VIN, description, equipment (car page renders from
 *                 meta + its chunk alone, without the whole catalogue — LCP)
 */
const INTERNAL = ['apiPrice', 'markup'];
const INTERNAL_D = ['tags', 'history'];
const strip = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const publicCars = cars.map((c) => strip(c, INTERNAL));
const byId = new Map(publicCars.map((c) => [c.id, c]));
const publicDetails = details.map((d) => ({ ...byId.get(d.id), ...strip(d, INTERNAL_D) }));
const internal = cars.map((c, i) => {
  const d = details[i];
  const o = { id: c.id };
  if (c.apiPrice != null) Object.assign(o, { apiPrice: c.apiPrice, markup: c.markup, price: c.price });
  if (d.tags) o.tags = d.tags;
  if (d.history) o.history = d.history;
  return o;
});
const firstPage = publicCars
  .filter((c) => c.status === 'in_stock' || c.status === 'in_transit')
  .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id - b.id)
  .slice(0, 24);
delete meta.markupUsd;

rmSync(resolve(OUT, 'cars'), { recursive: true, force: true });
mkdirSync(resolve(OUT, 'cars'), { recursive: true });
writeFileSync(resolve(OUT, 'catalog.json'), JSON.stringify(publicCars));
writeFileSync(resolve(OUT, 'first.json'), JSON.stringify({ items: firstPage, total: meta.counts.in_stock + meta.counts.in_transit }));
for (let c = 0; c * CHUNK < publicDetails.length; c++) {
  writeFileSync(resolve(OUT, `cars/${c}.json`), JSON.stringify(publicDetails.slice(c * CHUNK, (c + 1) * CHUNK)));
}
writeFileSync(resolve(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
const DB = resolve(ROOT, 'mock-db');
mkdirSync(DB, { recursive: true });
writeFileSync(resolve(DB, 'internal.json'), JSON.stringify(internal, null, 0).replace(/\},\{/g, '},\n{'));
const missing = (k) => cars.filter((c) => c[k] == null).length;
console.log(
  `cars: ${cars.length} (in_stock ${meta.counts.in_stock}, in_transit ${meta.counts.in_transit}, sold ${meta.counts.sold}), ` +
    `relisted ${details.filter((d) => d.tags?.includes('previously_sold')).length}, ` +
    `missing price ${missing('price')} · mileage ${missing('mileage')} · fuel ${missing('fuel')} · drive ${missing('drive')} · trim ${missing('trim')}, ` +
    `distinct photos in use ${new Set(details.flatMap((d) => d.gallery)).size}`,
);
