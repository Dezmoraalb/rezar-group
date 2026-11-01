/**
 * Verified Unsplash photos (free licence, images.unsplash.com) used by the demo dataset and the pages.
 * Every id was checked visually (contact sheets) and with curl (HTTP 200); `node scripts/gen-data.mjs --verify`
 * re-checks all of them. Ids are Unsplash photo ids: https://images.unsplash.com/photo-<id>?w=…&auto=format
 *
 *   ext  — exterior shots, tagged with the make they show (or null = generic) and the body type
 *   int  — interiors (gallery filler, any car)
 *   det  — details: wheels, lights, charging (gallery filler)
 *   scene — home-page imagery (hero, showroom, handover)
 * Body types: sedan · liftback · hatchback · wagon · suv · coupe · pickup
 */

/** @type {{id: string, make: string|null, body: string, ev?: boolean}[]} */
export const EXTERIOR = [
  // BMW
  { id: '1607853554439-0069ec0f29b6', make: 'BMW', body: 'sedan' },
  { id: '1603189617530-6d32306f57c5', make: 'BMW', body: 'sedan' },
  { id: '1603189661342-e45f1374f890', make: 'BMW', body: 'sedan' },
  { id: '1603189549723-29a00cd56120', make: 'BMW', body: 'sedan' },
  { id: '1555215695-3004980ad54e', make: 'BMW', body: 'sedan' },
  { id: '1774576319995-66e60342a2d1', make: 'BMW', body: 'sedan' },
  { id: '1546614042-7df3c24c9e5d', make: 'BMW', body: 'sedan' },
  { id: '1580273916550-e323be2ae537', make: 'BMW', body: 'coupe' },
  { id: '1757922588932-cb0fa4dda952', make: 'BMW', body: 'suv' },
  // Mercedes-Benz
  { id: '1609703048009-d3576872b32c', make: 'Mercedes-Benz', body: 'sedan' },
  { id: '1590316536591-92ba019a7b50', make: 'Mercedes-Benz', body: 'sedan' },
  { id: '1599912027765-a69c78bfa3aa', make: 'Mercedes-Benz', body: 'sedan' },
  { id: '1610099610040-ab19f3a5ec35', make: 'Mercedes-Benz', body: 'sedan' },
  { id: '1618373444305-3a77b7719a59', make: 'Mercedes-Benz', body: 'coupe' },
  { id: '1760137157471-7a8a435d8846', make: 'Mercedes-Benz', body: 'suv' },
  // Audi
  { id: '1616422285623-13ff0162193c', make: 'Audi', body: 'liftback' },
  { id: '1540066019607-e5f69323a8dc', make: 'Audi', body: 'liftback' },
  { id: '1776932136984-66624bad40f0', make: 'Audi', body: 'sedan' },
  { id: '1536150794560-43f988aec18e', make: 'Audi', body: 'coupe' },
  { id: '1769641156833-d5789dd62875', make: 'Audi', body: 'suv' },
  { id: '1769641156823-3b182d0b0e53', make: 'Audi', body: 'suv' },
  // Lexus
  { id: '1568074532275-b57393b08c64', make: 'Lexus', body: 'sedan' },
  { id: '1577496549804-8b05f1f67338', make: 'Lexus', body: 'coupe' },
  { id: '1577496550006-f24a50e9d50c', make: 'Lexus', body: 'coupe' },
  { id: '1779983625011-e9c207710d11', make: 'Lexus', body: 'suv' },
  { id: '1693532331766-bfcec4163ce4', make: 'Lexus', body: 'suv' },
  // Porsche
  { id: '1601929862217-f1bf94503333', make: 'Porsche', body: 'liftback' },
  { id: '1503376780353-7e6692767b70', make: 'Porsche', body: 'liftback' },
  { id: '1654159866298-e3c8ee93e43b', make: 'Porsche', body: 'suv' },
  { id: '1614162692292-7ac56d7f7f1e', make: 'Porsche', body: 'coupe' },
  { id: '1580274455191-1c62238fa333', make: 'Porsche', body: 'coupe' },
  // Volkswagen
  { id: '1557215121-f6da31003be7', make: 'Volkswagen', body: 'sedan' },
  { id: '1541899481282-d53bffe3c35d', make: 'Volkswagen', body: 'hatchback' },
  { id: '1471444928139-48c5bf5173f8', make: 'Volkswagen', body: 'hatchback' },
  { id: '1572634302117-74d5936414ce', make: 'Volkswagen', body: 'hatchback' },
  // Skoda
  { id: '1550615162-ed342f474ebf', make: 'Skoda', body: 'liftback' },
  { id: '1541845597-4b8d7bf81ebf', make: 'Skoda', body: 'liftback' },
  { id: '1763268263696-9477b66efab3', make: 'Skoda', body: 'wagon' },
  { id: '1767949374177-0523cc71421b', make: 'Skoda', body: 'suv', ev: true },
  { id: '1767949374180-e5895daa1990', make: 'Skoda', body: 'suv', ev: true },
  // Toyota
  { id: '1623869675781-80aa31012a5a', make: 'Toyota', body: 'sedan' },
  { id: '1547245324-d777c6f05e80', make: 'Toyota', body: 'suv' },
  { id: '1621993202323-f438eec934ff', make: 'Toyota', body: 'suv' },
  { id: '1762236096071-bf1ccbff48ff', make: 'Toyota', body: 'pickup' },
  // Nissan
  { id: '1630861825105-cefce2a4720a', make: 'Nissan', body: 'suv' },
  { id: '1551817280-6d59c77ce1b8', make: 'Nissan', body: 'suv' },
  { id: '1618782530124-fa5ddd7358df', make: 'Nissan', body: 'pickup' },
  // Ford
  { id: '1533473359331-0135ef1b58bf', make: 'Ford', body: 'suv' },
  { id: '1606611013016-969c19ba27bb', make: 'Ford', body: 'suv' },
  { id: '1494976388531-d1058494cdd8', make: 'Ford', body: 'coupe' },
  { id: '1758944967067-bf0177898364', make: null, body: 'pickup' },
  // Honda · Jeep · Land Rover · Volvo · Kia · Hyundai · Mazda · Tesla
  { id: '1519641471654-76ce0107ad1b', make: 'Honda', body: 'suv' },
  { id: '1618353482480-61ca5a9a7879', make: 'Jeep', body: 'suv' },
  { id: '1506015391300-4802dc74de2e', make: 'Jeep', body: 'suv' },
  { id: '1612563893490-d86ed296e5e6', make: 'Land Rover', body: 'suv' },
  { id: '1638686302275-0e87df720aca', make: 'Land Rover', body: 'suv' },
  { id: '1563458563737-e60b1f1b345f', make: 'Land Rover', body: 'suv' },
  { id: '1602013871952-8379f19a15f1', make: 'Land Rover', body: 'suv' },
  { id: '1758393363057-2b4d67743ef0', make: 'Land Rover', body: 'suv' },
  { id: '1557323137-bd6bd20fe022', make: 'Volvo', body: 'suv' },
  { id: '1547559418-8d7437f53b5b', make: 'Volvo', body: 'suv' },
  { id: '1688893287874-ac7fbd686c24', make: 'Kia', body: 'suv' },
  { id: '1705624843697-4461f9dce482', make: 'Hyundai', body: 'suv' },
  { id: '1573899754191-bd20f600141c', make: 'Hyundai', body: 'hatchback' },
  { id: '1756664825749-d481c5a94a57', make: 'Mazda', body: 'hatchback' },
  { id: '1756664825476-0b78d1f1b5d0', make: 'Mazda', body: 'hatchback' },
  { id: '1560958089-b8a1929cea89', make: 'Tesla', body: 'suv', ev: true },
  { id: '1771284848859-12f150fa1637', make: 'Tesla', body: 'suv', ev: true },
  { id: '1620891549027-942fdc95d3f5', make: 'Tesla', body: 'liftback', ev: true },
  { id: '1771289083523-35928b27b03e', make: 'Tesla', body: 'sedan', ev: true },
  // generic (no visible badge in the shot, or a close-up): used when a make has no own photo for that body
  { id: '1575501707067-0e4c7db2a950', make: null, body: 'sedan' },
  { id: '1561299593-7633f311838a', make: 'Mercedes-Benz', body: 'sedan' },
  { id: '1592309905620-e5b59f6dcb98', make: 'Mercedes-Benz', body: 'sedan' },
  { id: '1617814076231-2c58846db944', make: 'Mercedes-Benz', body: 'coupe' },
  { id: '1541348263662-e068662d82af', make: 'Audi', body: 'coupe' },
];

export const INTERIOR = [
  '1625690180114-5530b1304127',
  '1583573278124-e8d4fd3edf3c',
  '1761040100341-6aeeda55d58c',
  '1768853143263-72d7e744bbc2',
  '1636763086471-9f29bc34ab9e',
  '1471174617910-3e9c04f58ff5',
  '1553260188-75a8d6205b6c',
  '1599912027667-755b68b4dd3b',
  '1773960407606-7f5331ad1316',
  '1614530499660-fe1fbd7921d6',
  '1652860316277-370ca5b1b1df',
  '1770290405640-5daf7593c92a',
  '1585014165903-6d6c6ebad3e9',
  '1612805144400-88c7821bf36f',
];

export const DETAIL = [
  '1606664914460-b667528c1acc',
  '1614689304159-273632ab5c5a',
  '1549207107-2704df6b92ab',
  '1515569067071-ec3b51335dd0',
  '1637665264674-cd4225af7613',
  '1561924563-d9ad0f32b23f',
];
/** charging close-ups: only in EV galleries */
export const DETAIL_EV = ['1593941707882-a5bba14938c7', '1615829386703-e2bb66a7cb7d', '1763543007050-4dac73ffc67f'];

/** home-page imagery: defined in src/lib/photo.js (pages import it from there) */
export { SCENES } from '../src/lib/photo.js';
import { SCENES } from '../src/lib/photo.js';

export const ALL_IDS = [...new Set([...EXTERIOR.map((p) => p.id), ...INTERIOR, ...DETAIL, ...DETAIL_EV, ...Object.values(SCENES)])];

/** body colour each exterior shot shows (checked on a contact sheet) — the generator uses it as the car's «Колір»,
 *  so the spec table never says «Червоний» under a black car. Values match gen-data COLORS. */
export const EXT_COLOR = {
  '1607853554439-0069ec0f29b6': 'Сірий',
  '1603189617530-6d32306f57c5': 'Графітовий',
  '1603189661342-e45f1374f890': 'Графітовий',
  '1603189549723-29a00cd56120': 'Сірий',
  '1555215695-3004980ad54e': 'Білий',
  '1774576319995-66e60342a2d1': 'Чорний',
  '1546614042-7df3c24c9e5d': 'Синій',
  '1580273916550-e323be2ae537': 'Сірий',
  '1757922588932-cb0fa4dda952': 'Синій',
  '1609703048009-d3576872b32c': 'Графітовий',
  '1590316536591-92ba019a7b50': 'Сріблястий',
  '1599912027765-a69c78bfa3aa': 'Сірий',
  '1610099610040-ab19f3a5ec35': 'Чорний',
  '1618373444305-3a77b7719a59': 'Чорний',
  '1760137157471-7a8a435d8846': 'Білий',
  '1616422285623-13ff0162193c': 'Білий',
  '1540066019607-e5f69323a8dc': 'Білий',
  '1776932136984-66624bad40f0': 'Сріблястий',
  '1536150794560-43f988aec18e': 'Чорний',
  '1769641156833-d5789dd62875': 'Сірий',
  '1769641156823-3b182d0b0e53': 'Чорний',
  '1568074532275-b57393b08c64': 'Графітовий',
  '1577496549804-8b05f1f67338': 'Сірий',
  '1577496550006-f24a50e9d50c': 'Графітовий',
  '1779983625011-e9c207710d11': 'Білий',
  '1693532331766-bfcec4163ce4': 'Сірий',
  '1601929862217-f1bf94503333': 'Синій',
  '1503376780353-7e6692767b70': 'Чорний',
  '1654159866298-e3c8ee93e43b': 'Чорний',
  '1614162692292-7ac56d7f7f1e': 'Білий',
  '1580274455191-1c62238fa333': 'Чорний',
  '1557215121-f6da31003be7': 'Чорний',
  '1541899481282-d53bffe3c35d': 'Синій',
  '1471444928139-48c5bf5173f8': 'Чорний',
  '1572634302117-74d5936414ce': 'Білий',
  '1550615162-ed342f474ebf': 'Сірий',
  '1541845597-4b8d7bf81ebf': 'Сріблястий',
  '1763268263696-9477b66efab3': 'Сріблястий',
  '1767949374177-0523cc71421b': 'Сріблястий',
  '1767949374180-e5895daa1990': 'Білий',
  '1623869675781-80aa31012a5a': 'Білий',
  '1547245324-d777c6f05e80': 'Сірий',
  '1621993202323-f438eec934ff': 'Сірий',
  '1762236096071-bf1ccbff48ff': 'Білий',
  '1630861825105-cefce2a4720a': 'Чорний',
  '1551817280-6d59c77ce1b8': 'Синій',
  '1618782530124-fa5ddd7358df': 'Сірий',
  '1533473359331-0135ef1b58bf': 'Білий',
  '1606611013016-969c19ba27bb': 'Білий',
  '1494976388531-d1058494cdd8': 'Чорний',
  '1758944967067-bf0177898364': 'Сірий',
  '1519641471654-76ce0107ad1b': 'Білий',
  '1618353482480-61ca5a9a7879': 'Синій',
  '1506015391300-4802dc74de2e': 'Чорний',
  '1612563893490-d86ed296e5e6': 'Сірий',
  '1638686302275-0e87df720aca': 'Білий',
  '1563458563737-e60b1f1b345f': 'Графітовий',
  '1602013871952-8379f19a15f1': 'Зелений',
  '1758393363057-2b4d67743ef0': 'Чорний',
  '1557323137-bd6bd20fe022': 'Червоний',
  '1547559418-8d7437f53b5b': 'Білий',
  '1688893287874-ac7fbd686c24': 'Графітовий',
  '1705624843697-4461f9dce482': 'Графітовий',
  '1573899754191-bd20f600141c': 'Синій',
  '1756664825749-d481c5a94a57': 'Сріблястий',
  '1756664825476-0b78d1f1b5d0': 'Бежевий',
  '1560958089-b8a1929cea89': 'Білий',
  '1771284848859-12f150fa1637': 'Білий',
  '1620891549027-942fdc95d3f5': 'Чорний',
  '1771289083523-35928b27b03e': 'Білий',
  '1575501707067-0e4c7db2a950': 'Чорний',
  '1561299593-7633f311838a': 'Сірий',
  '1592309905620-e5b59f6dcb98': 'Чорний',
  '1617814076231-2c58846db944': 'Сірий',
  '1541348263662-e068662d82af': 'Чорний',
};
