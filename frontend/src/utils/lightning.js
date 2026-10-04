import QRCode from 'qrcode';

/**
 * Lightning helpers. Invoices come from the author's Lightning address (LNURL-pay)
 * and payment is confirmed through the LNURL-verify link. Real payments.
 */

export const INVOICE_TTL_SECONDS = 10 * 60;

// Demo: every author's payments go to this Lightning address (Blink).
const LNURL_CALLBACK = 'https://lnurl.blink.sv/lnurlp/blink.sv/behllytamar/invoice';

const numberFormat = new Intl.NumberFormat('en-US');

export function formatSats(value) {
  return numberFormat.format(Math.round(value || 0));
}

/** Ask the author's wallet for a real invoice. Returns { invoice, verifyUrl }. */
export async function fetchInvoice(sats) {
  const res = await fetch(`${LNURL_CALLBACK}?amount=${Math.round(sats) * 1000}`);
  const data = await res.json();
  if (!data.pr) throw new Error(data.reason || 'The wallet did not return an invoice.');
  return { invoice: data.pr, verifyUrl: data.verify || null };
}

/** True once the invoice has been paid. */
export async function checkInvoicePaid(verifyUrl) {
  if (!verifyUrl) return false;
  const res = await fetch(verifyUrl);
  const data = await res.json();
  return data.settled === true;
}

/** Kept for compatibility with older imports. */
export function createMockInvoice(sats) {
  return `lnbc${sats * 10}n1pmock`;
}

/** A real, scannable QR code for the invoice, as a matrix of true/false modules. */
export function buildQrMatrix(seed, size = 29) {
  if (!seed) return Array.from({ length: size }, () => Array(size).fill(false));
  const qr = QRCode.create(seed.toUpperCase(), { errorCorrectionLevel: 'L' });
  const n = qr.modules.size;
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => Boolean(qr.modules.get(r, c))),
  );
}
export function formatKes(value) { return 'KSh ' + new Intl.NumberFormat('en-US').format(Math.round(value || 0)); }
