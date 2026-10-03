import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFlash } from '../hooks/useFlash';
import { api } from '../utils/api';
import { formatKes, formatSats, satsToKes } from '../utils/lightning';

/**
 * Payments + entitlements, backed by the API.
 *
 * Readers can buy a single chapter or a monthly subscription to an author,
 * paying over Lightning or M-Pesa. The server issues every invoice and records
 * entitlements against this browser's anonymous reader id; paid text is only
 * returned once the reader owns it. `payment` drives the PaymentModal.
 */
export const LightningContext = createContext(null);

const POLL_MS = 3000;
const METHOD_KEY = 'sp:pay-method';
const PHONE_KEY = 'sp:mpesa-phone';
const keyFor = (bookId, chapterId) => `${bookId}:${chapterId}`;

const DEFAULT_OPTIONS = { kesPerSat: 0.13, subscriptionDays: 30, mpesaProvider: 'mock', demoMode: true };

/** What a payment is for. */
export const chapterItem = (book, chapter) => ({
  type: 'chapter',
  book,
  chapter,
  amountSats: chapter.priceSats,
  title: `Chapter ${chapter.number}: ${chapter.title}`,
  subtitle: book.title,
});

export const subscriptionItem = (author, context = null) => ({
  type: 'subscription',
  author,
  context, // { book, chapter } the reader was trying to open, if any
  amountSats: author.subscriptionPriceSats,
  title: `Monthly subscription to ${author.name}`,
  subtitle: 'Every paid chapter by this author',
});

const invoiceBody = (item, method, phone) => ({
  ...(item.type === 'subscription'
    ? { type: 'subscription', authorNpub: item.author.npub }
    : { bookId: item.book.id, chapterId: item.chapter.id }),
  method,
  ...(method === 'mpesa' ? { phone } : {}),
});

export function LightningProvider({ children }) {
  const flash = useFlash();
  const [unlocked, setUnlocked] = useState(() => new Set());
  /** npub -> ISO expiry of the reader's active subscription */
  const [subscriptions, setSubscriptions] = useState(() => new Map());
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  /**
   * payment: {
   *   item,                                  // chapterItem | subscriptionItem
   *   method: 'lightning' | 'mpesa',
   *   status: 'idle' | 'creating' | 'pending' | 'paid' | 'failed' | 'expired' | 'error',
   *   invoice, error, fieldError,
   * } | null
   */
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState(() => localStorage.getItem(PHONE_KEY) || '');
  const paymentRef = useRef(payment);
  paymentRef.current = payment;

  useEffect(() => {
    api
      .health()
      .then(({ payments, demoMode }) => setOptions({ ...DEFAULT_OPTIONS, ...payments, demoMode }))
      .catch(() => {});
  }, []);

  const refreshUnlocks = useCallback(async () => {
    try {
      const data = await api.listUnlocks();
      setUnlocked(new Set(data.unlocks));
      setSubscriptions(new Map((data.subscriptions || []).map((s) => [s.authorNpub, s.expiresAt])));
    } catch {
      /* Offline: keep whatever we already know. */
    }
  }, []);

  useEffect(() => {
    refreshUnlocks();
  }, [refreshUnlocks]);

  const markUnlocked = useCallback((bookId, chapterId, value) => {
    setUnlocked((prev) => {
      const next = new Set(prev);
      if (value) next.add(keyFor(bookId, chapterId));
      else next.delete(keyFor(bookId, chapterId));
      return next;
    });
  }, []);

  const subscriptionExpiry = useCallback(
    (npub) => {
      const expires = subscriptions.get(npub);
      return expires && Date.parse(expires) > Date.now() ? expires : null;
    },
    [subscriptions],
  );

  const isUnlocked = useCallback(
    (book, chapter) =>
      Boolean(chapter?.isFree) ||
      unlocked.has(keyFor(book?.id, chapter?.id)) ||
      Boolean(book?.author?.npub && subscriptionExpiry(book.author.npub)),
    [unlocked, subscriptionExpiry],
  );

  const toKes = useCallback((sats) => satsToKes(sats, options.kesPerSat), [options.kesPerSat]);

  const announcePaid = useCallback(
    (item, invoice) => {
      const amount = invoice.method === 'mpesa' ? formatKes(invoice.amountKes) : `${formatSats(invoice.amountSats)} sats`;
      if (item.type === 'subscription') {
        flash.success(`Every paid chapter by ${item.author.name} is open to you for ${options.subscriptionDays} days.`, {
          title: `Subscribed · ${amount} sent to the author`,
        });
      } else {
        flash.success(`"${item.chapter.title}" is unlocked. Enjoy the read.`, { title: `${amount} sent to the author` });
      }
    },
    [flash, options.subscriptionDays],
  );

  /** Apply a fresh invoice from the server to the open payment, if it still matches. */
  const applyInvoice = useCallback(
    (invoice) => {
      const current = paymentRef.current;
      if (!current || current.invoice?.paymentHash !== invoice.paymentHash) return;
      if (invoice.status === 'paid' && current.status !== 'paid') {
        if (invoice.purpose === 'chapter') markUnlocked(invoice.bookId, invoice.chapterId, true);
        refreshUnlocks();
        announcePaid(current.item, invoice);
      }
      setPayment((p) => (p?.invoice?.paymentHash === invoice.paymentHash ? { ...p, invoice, status: invoice.status } : p));
    },
    [markUnlocked, refreshUnlocks, announcePaid],
  );

  const requestInvoice = useCallback(
    async (item, method, phone) => {
      setPayment({ item, method, invoice: null, status: 'creating' });
      try {
        const { invoice } = await api.createInvoice(invoiceBody(item, method, phone));
        setPayment((p) => (p?.item === item && p.method === method ? { ...p, invoice, status: invoice.status } : p));
      } catch (error) {
        if (error.code === 'already_unlocked') {
          if (item.type === 'chapter') markUnlocked(item.book.id, item.chapter.id, true);
          setPayment((p) => p && { ...p, status: 'paid' });
          flash.info('This chapter is already unlocked for this browser.', { title: 'Already yours' });
          return;
        }
        setPayment(
          (p) =>
            p && {
              ...p,
              // A bad phone number keeps the M-Pesa form open with an inline error.
              status: error.details?.phone ? 'idle' : 'error',
              error: error.message,
              fieldError: error.details?.phone || null,
            },
        );
      }
    },
    [markUnlocked, flash],
  );

  /** Lightning invoices are issued immediately; M-Pesa first asks for a phone number. */
  const start = useCallback(
    (item, method) => {
      localStorage.setItem(METHOD_KEY, method);
      if (method === 'mpesa') setPayment({ item, method, invoice: null, status: 'idle' });
      else requestInvoice(item, method);
    },
    [requestInvoice],
  );

  const preferredMethod = () => (localStorage.getItem(METHOD_KEY) === 'mpesa' ? 'mpesa' : 'lightning');

  const openPayment = useCallback((book, chapter) => start(chapterItem(book, chapter), preferredMethod()), [start]);

  const openSubscription = useCallback(
    (author, context = null) => start(subscriptionItem(author, context), paymentRef.current?.method || preferredMethod()),
    [start],
  );

  const setMethod = useCallback(
    (method) => {
      const current = paymentRef.current;
      if (current && current.method !== method && current.status !== 'paid') start(current.item, method);
    },
    [start],
  );

  const payWithMpesa = useCallback(
    (phone) => {
      const current = paymentRef.current;
      if (!current) return;
      setMpesaPhone(phone);
      localStorage.setItem(PHONE_KEY, phone);
      requestInvoice(current.item, 'mpesa', phone);
    },
    [requestInvoice],
  );

  const regenerateInvoice = useCallback(() => {
    const current = paymentRef.current;
    if (current) start(current.item, current.method);
  }, [start]);

  const closePayment = useCallback(() => setPayment(null), []);

  // Poll while an invoice is pending, so a real wallet payment, an M-Pesa PIN
  // confirmation, or an expiry is picked up without user action.
  const pendingHash = payment?.status === 'pending' ? payment.invoice?.paymentHash : null;
  useEffect(() => {
    if (!pendingHash) return undefined;
    const interval = setInterval(async () => {
      try {
        const { invoice } = await api.getInvoice(pendingHash);
        if (invoice.status !== 'pending') applyInvoice(invoice);
      } catch {
        /* transient; try again next tick */
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [pendingHash, applyInvoice]);

  const simulate = useCallback(
    async (outcome) => {
      const current = paymentRef.current;
      if (!current?.invoice || current.status !== 'pending' || busy) return;
      setBusy(true);
      try {
        const { invoice } = await api.simulateInvoice(current.invoice.paymentHash, outcome);
        applyInvoice(invoice);
        if (invoice.status === 'failed') {
          flash.error(invoice.failureReason || 'The payment did not go through. No money left your account.', {
            title: 'Payment failed',
          });
        }
      } catch (error) {
        flash.error(error.message, { title: 'Simulation failed' });
      } finally {
        setBusy(false);
      }
    },
    [busy, applyInvoice, flash],
  );

  const simulateSuccess = useCallback(() => simulate('paid'), [simulate]);
  const simulateFailure = useCallback(() => simulate('failed'), [simulate]);

  /** Demo toggle: grant or revoke a chapter server-side without paying. */
  const setChapterAccess = useCallback(
    async (bookId, chapterId, value) => {
      try {
        if (value) await api.demoUnlock(bookId, chapterId);
        else await api.demoLock(bookId, chapterId);
        markUnlocked(bookId, chapterId, value);
      } catch (error) {
        flash.error(error.message, { title: 'Couldn’t change access' });
      }
    },
    [markUnlocked, flash],
  );

  const unlockChapter = useCallback((bookId, chapterId) => setChapterAccess(bookId, chapterId, true), [setChapterAccess]);
  const lockChapter = useCallback((bookId, chapterId) => setChapterAccess(bookId, chapterId, false), [setChapterAccess]);

  // Changes whenever the reader gains or loses access to anything, so readers
  // of paid text can re-fetch it.
  const entitlementKey = useMemo(
    () => `${[...unlocked].sort().join(',')}|${[...subscriptions.entries()].sort().join(',')}`,
    [unlocked, subscriptions],
  );

  const canSimulate = (method) =>
    options.demoMode && (method === 'lightning' || (method === 'mpesa' && options.mpesaProvider === 'mock'));

  const value = useMemo(
    () => ({
      payment,
      paymentOptions: options,
      canSimulate,
      toKes,
      mpesaPhone,
      isSimulating: busy,
      unlockedCount: unlocked.size,
      entitlementKey,
      isUnlocked,
      subscriptionExpiry,
      unlockChapter,
      lockChapter,
      refreshUnlocks,
      openPayment,
      openSubscription,
      setMethod,
      payWithMpesa,
      regenerateInvoice,
      closePayment,
      simulateSuccess,
      simulateFailure,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      payment,
      options,
      toKes,
      mpesaPhone,
      busy,
      unlocked,
      entitlementKey,
      isUnlocked,
      subscriptionExpiry,
      unlockChapter,
      lockChapter,
      refreshUnlocks,
      openPayment,
      openSubscription,
      setMethod,
      payWithMpesa,
      regenerateInvoice,
      closePayment,
      simulateSuccess,
      simulateFailure,
    ],
  );

  return <LightningContext.Provider value={value}>{children}</LightningContext.Provider>;
}
