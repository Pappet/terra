import { describe, expect, it } from 'vitest';
import { formatFixed, formatInt, formatPercent, formatSigned, signClass } from './format';

const GROUP = ' ';

describe('formatInt', () => {
  it('gruppiert ab vier Stellen', () => {
    expect(formatInt(0)).toBe('0');
    expect(formatInt(999)).toBe('999');
    expect(formatInt(1000)).toBe(`1${GROUP}000`);
    expect(formatInt(1234567)).toBe(`1${GROUP}234${GROUP}567`);
  });

  it('rundet und behält das Vorzeichen', () => {
    expect(formatInt(-1234.6)).toBe(`-1${GROUP}235`);
    expect(formatInt(12.4)).toBe('12');
  });

  it('fängt nicht-endliche Werte ab', () => {
    expect(formatInt(Number.NaN)).toBe('–');
    expect(formatInt(Number.POSITIVE_INFINITY)).toBe('–');
  });
});

describe('formatSigned', () => {
  it('erzwingt ein Vorzeichen', () => {
    expect(formatSigned(0)).toBe('+0.00');
    expect(formatSigned(1.5)).toBe('+1.50');
    expect(formatSigned(-1.5)).toBe('-1.50');
  });
});

describe('formatPercent / formatFixed', () => {
  it('rundet Prozent ohne Nachkomma', () => {
    expect(formatPercent(0.725)).toBe('73%');
    expect(formatPercent(0)).toBe('0%');
  });

  it('hält die Nachkommastellen fest', () => {
    expect(formatFixed(1.005, 2)).toBe('1.00');
    expect(formatFixed(2, 0)).toBe('2');
  });
});

describe('signClass', () => {
  it('bleibt bei 0 und ungültigen Werten neutral', () => {
    expect(signClass(0)).toBe('');
    expect(signClass(Number.NaN)).toBe('');
  });

  it('unterscheidet positiv und negativ', () => {
    expect(signClass(3)).toBe('pos');
    expect(signClass(-3)).toBe('neg');
  });
});
