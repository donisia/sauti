/**
 * Lightning helpers for the demo payment flow. Invoices and QR codes are
 * visually realistic mocks — they are not payable on the real network.
 */

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

export const INVOICE_TTL_SECONDS = 10 * 60;

const numberFormat = new Intl.NumberFormat('en-US');

export function formatSats(value) {
  return numberFormat.format(Math.round(value || 0));
}

/** KES equivalent the server will charge over M-Pesa (rounded up, minimum KES 1). */
export const satsToKes = (sats, kesPerSat) => Math.max(1, Math.ceil(sats * kesPerSat));

export const formatKes = (value) => `KES ${numberFormat.format(Math.round(value || 0))}`;

/** Build a BOLT11-shaped string. 1 sat = 10 nano-BTC, hence the "n" multiplier. */
export function createMockInvoice(sats) {
  const bytes = crypto.getRandomValues(new Uint8Array(190));
  const body = Array.from(bytes, (b) => BECH32[b % 32]).join('');
  return `lnbc${sats * 10}n1p${body}`;
}

/**
 * Deterministic QR-like module matrix derived from the invoice string.
 * Includes the three finder patterns and timing lines so it reads as a QR code.
 */
export function buildQrMatrix(seed, size = 29) {
  let state = 2166136261;
  for (const ch of seed) state = Math.imul(state ^ ch.charCodeAt(0), 16777619);
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };

  const finders = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  const inFinderZone = (r, c) =>
    finders.some(([fr, fc]) => r >= fr - 1 && r <= fr + 7 && c >= fc - 1 && c <= fc + 7);

  const matrix = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (inFinderZone(r, c) ? false : next() > 0.5)),
  );

  for (const [fr, fc] of finders) {
    for (let i = 0; i < 7; i += 1) {
      for (let j = 0; j < 7; j += 1) {
        const ring = i === 0 || i === 6 || j === 0 || j === 6;
        const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        matrix[fr + i][fc + j] = ring || core;
      }
    }
  }

  for (let i = 8; i < size - 8; i += 1) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  return matrix;
}
