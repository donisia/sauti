/**
 * Thin client for the Flask API.
 *
 * - Reader entitlements are tied to an anonymous, per-browser reader id sent
 *   as `X-Reader-Id` (no account needed to buy a chapter).
 * - Author endpoints additionally need a NIP-98 `Authorization` header, which
 *   NostrContext builds and passes in via `headers`.
 */

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';

const READER_KEY = 'sp:reader-id';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'network_error', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Stable anonymous reader id, created on first use. */
export function getReaderId() {
  let id = localStorage.getItem(READER_KEY);
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    id = `rdr_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    localStorage.setItem(READER_KEY, id);
  }
  return id;
}

/** Absolute URL for a path like `/books`, as signed into NIP-98 `u` tags. */
export const apiUrl = (path) => new URL(`${API_BASE}${path}`, window.location.origin).toString();

export async function apiRequest(path, { method = 'GET', body, headers = {}, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        'X-Reader-Id': getReaderId(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Can’t reach the Sovereign Publishing server. Is the backend running?');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = data?.error || {};
    throw new ApiError(err.message || `Request failed (${response.status}).`, {
      status: response.status,
      code: err.code || 'http_error',
      details: err.fields || null,
    });
  }
  return data;
}

const qs = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const text = search.toString();
  return text ? `?${text}` : '';
};

const enc = encodeURIComponent;

/** Public (unauthenticated) endpoints. */
export const api = {
  health: (opts) => apiRequest('/health', opts),
  listBooks: (params = {}, opts) => apiRequest(`/books${qs(params)}`, opts),
  getBook: (id, opts) => apiRequest(`/books/${enc(id)}`, opts),
  getChapter: (bookId, chapterId, opts) => apiRequest(`/books/${enc(bookId)}/chapters/${enc(chapterId)}`, opts),
  getAuthor: (npub, opts) => apiRequest(`/authors/${enc(npub)}`, opts),

  /**
   * body: { bookId, chapterId } or { type: 'subscription', authorNpub },
   * plus { method: 'lightning' | 'mpesa', phone } for M-Pesa.
   */
  createInvoice: (body) => apiRequest('/invoices', { method: 'POST', body }),
  getInvoice: (hash) => apiRequest(`/invoices/${enc(hash)}`),
  simulateInvoice: (hash, outcome) => apiRequest(`/invoices/${enc(hash)}/simulate`, { method: 'POST', body: { outcome } }),

  listUnlocks: () => apiRequest('/readers/me/unlocks'),
  demoUnlock: (bookId, chapterId) => apiRequest(`/readers/me/unlocks/${enc(bookId)}/${enc(chapterId)}`, { method: 'PUT' }),
  demoLock: (bookId, chapterId) => apiRequest(`/readers/me/unlocks/${enc(bookId)}/${enc(chapterId)}`, { method: 'DELETE' }),
};
