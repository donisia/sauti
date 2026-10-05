import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useFlash } from '../hooks/useFlash';
import { INVOICE_TTL_SECONDS, checkInvoicePaid, fetchInvoice, formatSats } from '../utils/lightning';

export const LightningContext = createContext(null);

const STORAGE_KEY = 'sp:unlocked-chapters';
const keyFor = (bookId, chapterId) => `${bookId}:${chapterId}`;

function readUnlocked() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
  } catch {
    return new Set();
  }
}

export function LightningProvider({ children }) {
  const flash = useFlash();
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
  }, [unlocked]);

  const isUnlocked = useCallback(
    (book, chapter) => Boolean(chapter?.isFree) || unlocked.has(keyFor(book?.id, chapter?.id)),
    [unlocked],
  );

  const unlockChapter = useCallback((bookId, chapterId) => {
    setUnlocked((prev) => new Set(prev).add(keyFor(bookId, chapterId)));
  }, []);

  const lockChapter = useCallback((bookId, chapterId) => {
    setUnlocked((prev) => {
      const next = new Set(prev);
      next.delete(keyFor(bookId, chapterId));
      return next;
    });
  }, []);

  // Get a real invoice for the chapter's price and attach it to the open payment.
  const loadInvoice = useCallback(
    async (book, chapter) => {
      try {
        const { invoice, verifyUrl } = await fetchInvoice(chapter.priceSats);
        setPayment((current) =>
          current && current.chapter.id === chapter.id
            ? { ...current, invoice, verifyUrl, status: 'pending', expiresAt: Date.now() + INVOICE_TTL_SECONDS * 1000 }
            : current,
        );
      } catch (error) {
        setPayment((current) => current && { ...current, status: 'failed' });
        flash.error(error?.message || 'Could not reach the author’s wallet.', { title: 'Invoice failed' });
      }
    },
    [flash],
  );

  const openPayment = useCallback(
    (book, chapter) => {
      setPayment({ book, chapter, invoice: '', verifyUrl: null, status: 'pending', expiresAt: Date.now() + INVOICE_TTL_SECONDS * 1000 });
      loadInvoice(book, chapter);
    },
    [loadInvoice],
  );

  const regenerateInvoice = useCallback(() => {
    if (!payment) return;
    setPayment({ ...payment, invoice: '', verifyUrl: null, status: 'pending' });
    loadInvoice(payment.book, payment.chapter);
  }, [payment, loadInvoice]);

  const closePayment = useCallback(() => setPayment(null), []);

  const markPaid = useCallback(() => {
    if (!payment || payment.status === 'paid') return;
    unlockChapter(payment.book.id, payment.chapter.id);
    setPayment((current) => current && { ...current, status: 'paid' });
    flash.success(`"${payment.chapter.title}" is unlocked. Enjoy the read.`, {
      title: `${formatSats(payment.chapter.priceSats)} sats sent to the author`,
    });
  }, [payment, unlockChapter, flash]);

  // Real payment check: ask the verify link every 2.5 seconds.
  useEffect(() => {
    if (!payment || payment.status !== 'pending' || !payment.verifyUrl) return undefined;
    const timer = setInterval(async () => {
      try {
        if (await checkInvoicePaid(payment.verifyUrl)) markPaid();
      } catch {
        /* try again on the next tick */
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [payment, markPaid]);

  // Demo buttons from the original modal (kept as a backup for the pitch).
  const simulateSuccess = markPaid;
  const simulateFailure = useCallback(() => {
    if (!payment || payment.status === 'paid') return;
    setPayment((current) => current && { ...current, status: 'failed' });
  }, [payment]);

  const value = useMemo(
    () => ({
      payment,
      unlockedCount: unlocked.size,
      isUnlocked,
      unlockChapter,
      lockChapter,
      openPayment,
      regenerateInvoice,
      closePayment,
      simulateSuccess,
      simulateFailure,
    }),
    [payment, unlocked, isUnlocked, unlockChapter, lockChapter, openPayment, regenerateInvoice, closePayment, simulateSuccess, simulateFailure],
  );

  return <LightningContext.Provider value={value}>{children}</LightningContext.Provider>;
}