import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';
import { Rng } from './rng';

describe('base64', () => {
  it('Roundtrip über alle Längen 0..40 (Padding-Fälle)', () => {
    const rng = new Rng(7);
    for (let len = 0; len <= 40; len++) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = rng.int(0, 255);
      const encoded = bytesToBase64(bytes);
      const decoded = base64ToBytes(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(bytes));
    }
  });

  it('ist das Standard-Encoding (bekannte Vektoren)', () => {
    expect(bytesToBase64(new Uint8Array([0, 0, 0]))).toBe('AAAA');
    expect(bytesToBase64(new Uint8Array([255]))).toBe('/w==');
    expect(bytesToBase64(new Uint8Array([104, 101, 108, 108, 111]))).toBe('aGVsbG8=');
    expect(Array.from(base64ToBytes('aGVsbG8='))).toEqual([104, 101, 108, 108, 111]);
  });

  it('ignoriert Whitespace beim Dekodieren', () => {
    expect(Array.from(base64ToBytes('aGVs\nbG8= '))).toEqual([104, 101, 108, 108, 111]);
  });

  it('wirft bei ungültigen Zeichen und falscher Länge', () => {
    expect(() => base64ToBytes('aG*s')).toThrow(/ungültig/);
    expect(() => base64ToBytes('aGVsbG8')).toThrow(/Vielfaches/);
  });
});
