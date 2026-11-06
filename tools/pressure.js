// Pressure units and the barometric formula used by the BaroLog tools.
// Ported from BaroLog's lib/logic/units.dart so the site and the app agree.
// Runs in the browser (window.Pressure) and under node (require).
// Tests: node tools/pressure.test.js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pressure = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UNITS = ['hpa', 'inhg', 'mmhg', 'kpa'];
  var SYMBOL = { hpa: 'hPa', inhg: 'inHg', mmhg: 'mmHg', kpa: 'kPa' };

  // How many decimals the app shows for each unit.
  var DECIMALS = { hpa: 1, inhg: 2, mmhg: 1, kpa: 2 };

  // More digits for a converter, where people want to check a figure.
  var PRECISE = { hpa: 2, inhg: 3, mmhg: 2, kpa: 3 };

  var INHG_PER_HPA = 0.0295299830714;
  var MMHG_PER_HPA = 0.750061683;
  var METRES_PER_FOOT = 0.3048;

  function fromHpa(hpa, unit) {
    switch (unit) {
      case 'hpa': return hpa;
      case 'inhg': return hpa * INHG_PER_HPA;
      case 'mmhg': return hpa * MMHG_PER_HPA;
      case 'kpa': return hpa / 10;
    }
    throw new Error('Unknown unit: ' + unit);
  }

  function toHpa(value, unit) {
    switch (unit) {
      case 'hpa': return value;
      case 'inhg': return value / INHG_PER_HPA;
      case 'mmhg': return value / MMHG_PER_HPA;
      case 'kpa': return value * 10;
    }
    throw new Error('Unknown unit: ' + unit);
  }

  function format(hpa, unit, decimals) {
    return fromHpa(hpa, unit).toFixed(decimals === undefined ? DECIMALS[unit] : decimals);
  }

  // A change, always with a sign. Uses the same minus sign as the app.
  function formatDelta(dHpa, unit, decimals) {
    var v = fromHpa(dHpa, unit);
    var s = Math.abs(v).toFixed(decimals === undefined ? DECIMALS[unit] : decimals);
    return v > 0 ? '+' + s : (v < 0 ? '−' + s : s);
  }

  // Altitude in metres from station pressure and sea-level pressure
  // (international barometric formula), as in the app's altitudeFromPressure.
  function altitudeFromPressure(stationHpa, seaLevelHpa) {
    if (stationHpa <= 0 || seaLevelHpa <= 0) return 0;
    return 44330.0 * (1 - Math.pow(stationHpa / seaLevelHpa, 1 / 5.255));
  }

  // The same formula solved for sea-level pressure. Returns null when the
  // input has no meaning for this formula.
  function seaLevelFromStation(stationHpa, altitudeM) {
    if (!(stationHpa > 0) || !isFinite(altitudeM) || altitudeM >= 44330) return null;
    return stationHpa / Math.pow(1 - altitudeM / 44330.0, 5.255);
  }

  // A plain-words reason when a reading or elevation looks wrong, or null.
  // The extremes are round numbers around the Dead Sea shore and Mount Everest.
  function checkStation(stationHpa) {
    if (!(stationHpa > 0)) return 'Pressure has to be above zero.';
    if (stationHpa < 300 || stationHpa > 1100) return 'That is outside the range of air pressure on the ground. Check the unit.';
    return null;
  }
  function checkElevation(altitudeM) {
    if (altitudeM < -500 || altitudeM > 9000) return 'Use an elevation between \u2212500 m and 9,000 m. Check the unit.';
    return null;
  }

  // Reads what a person typed. Accepts a decimal comma. null when not a number.
  function parseNumber(text) {
    var s = String(text === undefined || text === null ? '' : text).trim().replace(',', '.').replace('−', '-');
    if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    return Number(s);
  }

  function feetToMetres(ft) { return ft * METRES_PER_FOOT; }
  function metresToFeet(m) { return m / METRES_PER_FOOT; }

  return {
    UNITS: UNITS, SYMBOL: SYMBOL, DECIMALS: DECIMALS, PRECISE: PRECISE,
    fromHpa: fromHpa, toHpa: toHpa, format: format, formatDelta: formatDelta,
    altitudeFromPressure: altitudeFromPressure, seaLevelFromStation: seaLevelFromStation,
    checkStation: checkStation, checkElevation: checkElevation,
    parseNumber: parseNumber, feetToMetres: feetToMetres, metresToFeet: metresToFeet
  };
});
