// Run with: node tools/pressure.test.js
// Three sources of expected values:
//  1. the test vectors in BaroLog's test/logic_test.dart and test/forecast_alert_test.dart
//  2. pressure.vectors.json, produced by running the app's units.dart under Dart
//  3. the figures printed on the tool pages, so the pages cannot drift from the code
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('./pressure.js');

let count = 0;
function test(name, fn) { fn(); count++; console.log('ok  ' + name); }
function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label || ''} ${actual} is not within ${tolerance} of ${expected}`);
}

// 1. The app's own test vectors (test/logic_test.dart, group 'units').
test('app vectors: conversions', () => {
  close(P.fromHpa(1013.25, 'inhg'), 29.92, 0.01);
  close(P.fromHpa(1013.25, 'mmhg'), 760.0, 0.1);
  close(P.fromHpa(1013.25, 'kpa'), 101.325, 0.001);
  assert.strictEqual(P.format(1013.25, 'hpa'), '1013.3');
  assert.strictEqual(P.formatDelta(-2.04, 'hpa'), '−2.0');
  assert.strictEqual(P.formatDelta(1.0, 'hpa'), '+1.0');
});
test('app vectors: altitude from pressure', () => {
  close(P.altitudeFromPressure(1013.25, 1013.25), 0, 0.01);
  close(P.altitudeFromPressure(898.75, 1013.25), 1000, 15);
});
// test/forecast_alert_test.dart: a phone at about 170 m reads 1010 while sea level is 1030.
test('app vectors: calibration example, 1010 at the phone, 1030 at sea level', () => {
  const altitude = P.altitudeFromPressure(1010, 1030);
  close(altitude, 166, 5);
  close(P.seaLevelFromStation(1010, altitude), 1030, 1e-9);
});

// 2. Values computed by the app's Dart code.
const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'pressure.vectors.json'), 'utf8'));
test('Dart vectors: every unit, value and formatted text', () => {
  let n = 0;
  for (const u of vectors.units) {
    assert.strictEqual(P.SYMBOL[u.unit], u.symbol);
    assert.strictEqual(P.DECIMALS[u.unit], u.decimals);
    for (const v of u.values) {
      close(P.fromHpa(v.hpa, u.unit), v.value, 1e-12, u.unit);
      assert.strictEqual(P.format(v.hpa, u.unit), v.text);
      close(P.toHpa(v.value, u.unit), v.hpa, 1e-9, 'round trip ' + u.unit);
      n++;
    }
    for (const d of u.deltas) { assert.strictEqual(P.formatDelta(d.hpa, u.unit), d.text); n++; }
  }
  console.log('    ' + n + ' values compared');
});
test('Dart vectors: altitude, and sea level as its exact inverse', () => {
  for (const a of vectors.altitude) {
    close(P.altitudeFromPressure(a.station, a.sea), a.altitude, 1e-7, 'altitude');
    close(P.seaLevelFromStation(a.station, a.altitude), a.sea, 1e-9, 'sea level');
  }
  for (const g of vectors.guards) assert.strictEqual(P.altitudeFromPressure(g.station, g.sea), g.altitude);
  console.log('    ' + vectors.altitude.length + ' pressure pairs compared');
});

// Independent reference: the standard atmosphere at sea level.
test('standard atmosphere: 1013.25 hPa = 101.325 kPa = 760 mmHg = 29.921 inHg', () => {
  assert.strictEqual(P.format(1013.25, 'kpa', 3), '101.325');
  assert.strictEqual(P.format(1013.25, 'mmhg', 2), '760.00');
  assert.strictEqual(P.format(1013.25, 'inhg', 3), '29.921');
  close(P.toHpa(29.92, 'inhg'), 1013.21, 0.01);
  close(P.toHpa(760, 'mmhg'), 1013.25, 0.001);
});

test('sea level: inputs the formula cannot use', () => {
  assert.strictEqual(P.seaLevelFromStation(0, 100), null);
  assert.strictEqual(P.seaLevelFromStation(-1, 100), null);
  assert.strictEqual(P.seaLevelFromStation(1000, 44330), null);
  assert.strictEqual(P.seaLevelFromStation(1000, NaN), null);
  assert.strictEqual(P.seaLevelFromStation(NaN, 100), null);
  assert.strictEqual(P.seaLevelFromStation(1000, 0), 1000);
  assert.ok(P.seaLevelFromStation(1000, -100) < 1000, 'below sea level, sea-level pressure is lower');
});

test('parseNumber: what people type', () => {
  assert.strictEqual(P.parseNumber('1013.25'), 1013.25);
  assert.strictEqual(P.parseNumber(' 29,92 '), 29.92);
  assert.strictEqual(P.parseNumber('-12'), -12);
  assert.strictEqual(P.parseNumber('−12'), -12);
  assert.strictEqual(P.parseNumber('.5'), 0.5);
  for (const bad of ['', '  ', 'abc', '1.2.3', '12hPa', '1e3', null, undefined]) assert.strictEqual(P.parseNumber(bad), null);
});

test('range checks', () => {
  assert.strictEqual(P.checkStation(985), null);
  assert.strictEqual(P.checkStation(300), null);
  assert.ok(P.checkStation(0));
  assert.ok(P.checkStation(29.92), 'inHg typed with hPa selected');
  assert.ok(P.checkStation(1200));
  assert.strictEqual(P.checkElevation(8849), null);
  assert.strictEqual(P.checkElevation(-430), null);
  assert.ok(P.checkElevation(9001));
  assert.ok(P.checkElevation(-501));
});

test('feet and metres', () => {
  close(P.feetToMetres(1000), 304.8, 1e-9);
  close(P.metresToFeet(304.8), 1000, 1e-9);
});

// 3. Figures printed on the pages.
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
test('converter page: worked example and table match the code', () => {
  const html = read('pressure-converter.html');
  const hpa = P.toHpa(30.13, 'inhg');
  assert.ok(html.includes(`${P.format(hpa, 'hpa', 2)} hPa`), 'example hPa');
  assert.ok(html.includes(`${P.format(hpa, 'mmhg', 2)} mmHg`), 'example mmHg');
  assert.ok(html.includes(`${P.format(hpa, 'kpa', 3)} kPa`), 'example kPa');
  const rows = [...html.matchAll(/<tr data-hpa="([\d.]+)"><td>[\d.]+<\/td><td>([\d.]+)<\/td><td>([\d.]+)<\/td><td>([\d.]+)<\/td><\/tr>/g)];
  assert.ok(rows.length >= 6, 'table rows found: ' + rows.length);
  for (const r of rows) {
    const h = Number(r[1]);
    assert.strictEqual(r[2], P.format(h, 'inhg', 2));
    assert.strictEqual(r[3], P.format(h, 'mmhg', 1));
    assert.strictEqual(r[4], P.format(h, 'kpa', 2));
  }
});
test('sea-level page: worked example matches the code', () => {
  const html = read('sea-level-pressure.html');
  const sea = P.seaLevelFromStation(985, 250);
  assert.ok(html.includes(`${P.format(sea, 'hpa', 1)} hPa`), 'example sea level ' + P.format(sea, 'hpa', 1));
  assert.ok(html.includes(`${P.format(sea, 'inhg', 2)} inHg`), 'example inHg');
  assert.ok(html.includes(P.format(sea, 'hpa', 1)), 'result');
});

console.log(`\n${count} tests passed`);
