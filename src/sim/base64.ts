/**
 * Base64 für Uint8Array – eigenständig und DOM-frei (kein btoa), damit die
 * Sim Savegames mit binären Layern serialisieren kann, wo auch immer sie läuft.
 */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP = new Int16Array(256).fill(-1);
for (let i = 0; i < CHARS.length; i++) {
  LOOKUP[CHARS.charCodeAt(i)] = i;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const out: string[] = [];
  const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = i + 1 < n ? (bytes[i + 1] as number) : undefined;
    const b2 = i + 2 < n ? (bytes[i + 2] as number) : undefined;
    out.push(
      CHARS[b0 >> 2] as string,
      CHARS[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)] as string,
      b1 === undefined ? '=' : (CHARS[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)] as string),
      b2 === undefined ? '=' : (CHARS[b2 & 63] as string),
    );
  }
  return out.join('');
}

export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/[\s]/g, '');
  const n = clean.length;
  if (n % 4 !== 0) {
    throw new Error(`base64: Länge ${n} ist kein Vielfaches von 4`);
  }
  const padding = n > 0 && clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((n / 4) * 3 - padding);
  let out = 0;
  for (let i = 0; i < n; i += 4) {
    const c0 = LOOKUP[clean.charCodeAt(i)] as number;
    const c1 = LOOKUP[clean.charCodeAt(i + 1)] as number;
    const c2 = clean.charCodeAt(i + 2) === 61 ? 0 : LOOKUP[clean.charCodeAt(i + 2)] as number;
    const c3 = clean.charCodeAt(i + 3) === 61 ? 0 : LOOKUP[clean.charCodeAt(i + 3)] as number;
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) {
      throw new Error(`base64: ungültiges Zeichen an Position ${i}`);
    }
    if (out < bytes.length) bytes[out++] = (c0 << 2) | (c1 >> 4);
    if (out < bytes.length) bytes[out++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (out < bytes.length) bytes[out++] = ((c2 & 3) << 6) | c3;
  }
  return bytes;
}

/** Int16Array als Little-Endian-Bytes (für base64-Savegames). */
export function int16ToBytes(arr: Int16Array): Uint8Array {
  const out = new Uint8Array(arr.length * 2);
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i] ?? 0;
    out[i * 2] = v & 0xff;
    out[i * 2 + 1] = (v >> 8) & 0xff;
  }
  return out;
}

export function bytesToInt16(bytes: Uint8Array): Int16Array {
  if (bytes.length % 2 !== 0) {
    throw new Error('int16: Byte-Anzahl ist ungerade');
  }
  const out = new Int16Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = (bytes[i * 2] as number) | ((bytes[i * 2 + 1] as number) << 8);
  }
  return out;
}
