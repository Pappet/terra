/**
 * Zahlenformate der Oberfläche (M10.0). Reine Funktionen, keine Locale-
 * Abhängigkeit: die Ausgabe muss in Test und Browser identisch sein.
 * Gruppentrenner ist das schmale geschützte Leerzeichen (U+202F).
 */

const GROUP = ' ';

/** Ganzzahl mit Tausendertrennung, kaufmännisch gerundet. */
export function formatInt(value: number): string {
  if (!Number.isFinite(value)) return '–';
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += GROUP;
    out += digits[i];
  }
  return sign + out;
}

/** Feste Nachkommastellen ohne Gruppentrennung (kleine Raten). */
export function formatFixed(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '–';
  return value.toFixed(digits);
}

/** Mit erzwungenem Vorzeichen – für Bilanzgrößen (Netto, Delta). */
export function formatSigned(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '–';
  const body = Math.abs(value).toFixed(digits);
  return (value < 0 ? '-' : '+') + body;
}

/** Anteil 0..1 als Prozent ohne Nachkomma. */
export function formatPercent(value01: number): string {
  if (!Number.isFinite(value01)) return '–';
  return `${Math.round(value01 * 100)}%`;
}

/** CSS-Klasse für eine Bilanzgröße: positiv grün, negativ rot, 0 neutral. */
export function signClass(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return value > 0 ? 'pos' : 'neg';
}
