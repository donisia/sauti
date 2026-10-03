import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  RefreshCw,
  Smartphone,
  Sparkles,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useLightning } from '../../hooks/useLightning';
import { useFlash } from '../../hooks/useFlash';
import { buildQrMatrix, formatKes, formatSats } from '../../utils/lightning';
import { copyToClipboard } from '../../utils/clipboard';
import { formatDate } from '../../utils/format';

/** Visual QR-style code generated from the invoice string (demo only). */
function MockQrCode({ value }) {
  const matrix = useMemo(() => buildQrMatrix(value), [value]);
  const size = matrix.length;
  const quiet = 3;
  const mid = size / 2 + quiet;

  return (
    <svg
      viewBox={`0 0 ${size + quiet * 2} ${size + quiet * 2}`}
      className="h-full w-full"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Lightning invoice QR code"
    >
      <rect width="100%" height="100%" fill="#F4F1EA" />
      {matrix.flatMap((row, r) =>
        row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width="1" height="1" fill="#0F1012" /> : null)),
      )}
      <rect x={mid - 3} y={mid - 3} width="6" height="6" rx="1.4" fill="#F7931A" />
      <path
        d={`M${mid + 0.4} ${mid - 2.2} L${mid - 1.4} ${mid + 0.3} H${mid} L${mid - 0.4} ${mid + 2.2} L${mid + 1.4} ${mid - 0.3} H${mid} Z`}
        fill="#0F1012"
      />
    </svg>
  );
}

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Lightning / M-Pesa switch. */
function MethodTabs({ method, onChange }) {
  const tabs = [
    { id: 'lightning', label: 'Lightning', hint: 'Bitcoin · sats', icon: Zap, active: 'bg-btc text-ink shadow-glow' },
    { id: 'mpesa', label: 'M-Pesa', hint: 'Safaricom · KES', icon: Smartphone, active: 'bg-emerald-500 text-ink' },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-2xl bg-ink p-1.5" role="radiogroup" aria-label="Payment method">
      {tabs.map(({ id, label, hint, icon: Icon, active }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={method === id}
          onClick={() => onChange(id)}
          className={`flex items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] ${
            method === id ? active : 'text-cream-muted hover:bg-white/[0.04] hover:text-cream'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" fill={id === 'lightning' && method === id ? 'currentColor' : 'none'} />
          <span className="leading-tight">
            <span className="block text-sm font-semibold">{label}</span>
            <span className={`block text-[10px] ${method === id ? 'opacity-70' : 'text-cream-faint'}`}>{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function LightningBody({ payment, remaining, isExpired, onRetry }) {
  const flash = useFlash();
  const [copied, setCopied] = useState(false);
  const invoice = payment.invoice?.bolt11 || '';
  const { status } = payment;

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    if (!invoice) return;
    const ok = await copyToClipboard(invoice);
    if (ok) {
      setCopied(true);
      flash.success('Paste it into any Lightning wallet to pay.', { title: 'Invoice copied', duration: 2500 });
    } else {
      flash.error('Copy failed. Long-press the invoice to copy it manually.');
    }
  };

  return (
    <>
      <div className="relative mx-auto mt-6 aspect-square w-full max-w-[240px] overflow-hidden rounded-2xl bg-cream p-2 shadow-glow-soft">
        {invoice ? (
          <MockQrCode value={invoice} />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-label="Creating invoice">
            <Loader2 className="h-8 w-8 animate-spin text-ink/60" />
          </div>
        )}
        {(status === 'failed' || isExpired) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/85 p-6 text-center backdrop-blur-sm">
            {isExpired ? <Clock className="h-9 w-9 text-amber-300" /> : <XCircle className="h-9 w-9 text-red-300" />}
            <p className="text-sm font-medium text-cream">{isExpired ? 'Invoice expired' : 'Payment failed'}</p>
            <button type="button" onClick={onRetry} className="btn-secondary btn-sm">
              <RefreshCw className="h-3.5 w-3.5" /> New invoice
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-cream-faint">
        {status === 'creating' && 'Requesting an invoice from the author’s node…'}
        {status === 'pending' && !isExpired && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-btc" />
            Waiting for payment · expires in <span className="font-mono text-cream-muted">{formatCountdown(remaining)}</span>
          </>
        )}
        {status === 'failed' && <span className="text-red-300">The route failed. No sats were sent.</span>}
      </div>

      <div className="mt-5">
        <label htmlFor="ln-invoice" className="label">
          Lightning invoice
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="ln-invoice"
            readOnly
            value={invoice}
            onFocus={(e) => e.target.select()}
            className="input min-w-0 flex-1 truncate py-2.5 font-mono text-xs"
          />
          <button type="button" onClick={handleCopy} className="btn-secondary btn-sm shrink-0 rounded-xl px-4">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy Invoice'}
          </button>
        </div>
        <a href={`lightning:${invoice}`} className="mt-3 inline-flex items-center gap-1.5 text-xs text-cream-muted transition hover:text-btc">
          <ExternalLink className="h-3.5 w-3.5" /> Open in wallet app
        </a>
      </div>
    </>
  );
}

function MpesaBody({ payment, amountKes, remaining, isExpired, onRetry }) {
  const { payWithMpesa, mpesaPhone } = useLightning();
  const [phone, setPhone] = useState(mpesaPhone);
  const { status, invoice } = payment;

  if (status === 'idle' || status === 'creating') {
    const sending = status === 'creating';
    return (
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!sending) payWithMpesa(phone);
        }}
        noValidate
      >
        <div>
          <label htmlFor="mpesa-phone" className="label">
            M-Pesa phone number
          </label>
          <div className="relative">
            <Smartphone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300" />
            <input
              id="mpesa-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
              className={`input pl-11 font-mono text-base ${payment.fieldError ? 'input-error' : ''}`}
              aria-invalid={Boolean(payment.fieldError)}
              aria-describedby="mpesa-phone-help"
            />
          </div>
          <p id="mpesa-phone-help" className={`mt-2 text-xs ${payment.fieldError ? 'text-red-300' : 'text-cream-faint'}`}>
            {payment.fieldError || 'Safaricom number. You’ll get a prompt on your phone to enter your M-Pesa PIN.'}
          </p>
        </div>
        <button type="submit" disabled={sending || !phone.trim()} className="btn btn-lg w-full bg-emerald-500 text-ink hover:bg-emerald-400 disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
          {sending ? 'Sending request to your phone…' : `Pay ${formatKes(amountKes)} with M-Pesa`}
        </button>
      </form>
    );
  }

  if (status === 'failed' || isExpired) {
    return (
      <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-6 text-center">
        {isExpired ? <Clock className="mx-auto h-10 w-10 text-amber-300" /> : <XCircle className="mx-auto h-10 w-10 text-red-300" />}
        <p className="mt-3 font-display text-xl text-cream">{isExpired ? 'The request timed out' : 'Payment not completed'}</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-cream-muted">
          {isExpired ? 'We didn’t hear back from M-Pesa in time. No money was taken.' : invoice?.failureReason || 'No money was taken.'}
        </p>
        <button type="button" onClick={onRetry} className="btn-secondary btn-sm mt-5">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-6 text-center">
      <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
        <Smartphone className="h-7 w-7" />
        <span className="absolute -right-1 -top-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-400" />
        </span>
      </span>
      <p className="mt-4 font-display text-2xl text-cream">Check your phone</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-cream-muted">
        Enter your M-Pesa PIN on <span className="font-mono text-cream">{invoice?.phone}</span> to pay{' '}
        <span className="text-cream">{formatKes(invoice?.amountKes)}</span> to Sovereign Publishing.
      </p>
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-cream-faint">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" />
        Waiting for confirmation · <span className="font-mono text-cream-muted">{formatCountdown(remaining)}</span>
      </p>
      <button type="button" onClick={onRetry} className="mt-4 text-xs text-cream-muted underline-offset-4 hover:text-cream hover:underline">
        Didn’t get the prompt? Send it again
      </button>
    </div>
  );
}

/** Offer a monthly pass to the author while buying a single chapter. */
function SubscriptionUpsell({ item, toKes, onSubscribe, days }) {
  const author = item.book.author;
  if (!author?.subscriptionPriceSats) return null;
  return (
    <button
      type="button"
      onClick={onSubscribe}
      className="group mt-6 flex w-full items-center gap-4 rounded-2xl border border-violet-400/25 bg-violet-400/[0.05] p-4 text-left transition hover:border-violet-400/50 hover:bg-violet-400/[0.08]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200">
        <Sparkles className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-cream">Read everything by {author.name}</span>
        <span className="mt-0.5 block text-xs text-cream-muted">
          Monthly subscription · {formatSats(author.subscriptionPriceSats)} sats (≈ {formatKes(toKes(author.subscriptionPriceSats))}) for{' '}
          {days} days
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-violet-200 transition group-hover:translate-x-0.5">Subscribe →</span>
    </button>
  );
}

/**
 * Checkout modal for single chapters and monthly subscriptions, paid over
 * Lightning or M-Pesa. Opened via `openPayment` / `openSubscription`.
 */
export default function PaymentModal() {
  const {
    payment,
    paymentOptions,
    canSimulate,
    toKes,
    isSimulating,
    subscriptionExpiry,
    closePayment,
    setMethod,
    openSubscription,
    simulateSuccess,
    simulateFailure,
    regenerateInvoice,
  } = useLightning();
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const [now, setNow] = useState(() => Date.now());
  const isOpen = Boolean(payment);

  useEffect(() => {
    if (!isOpen) return undefined;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Escape to close, lock background scroll, move focus into the dialog
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    const onKey = (event) => event.key === 'Escape' && closePayment();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previousFocus?.focus?.();
    };
  }, [isOpen, closePayment]);

  if (!payment) return null;

  const { item, method, status, invoice } = payment;
  const isSubscription = item.type === 'subscription';
  const expiresAt = invoice ? Date.parse(invoice.expiresAt) : now;
  const remaining = Math.max(0, Math.round((expiresAt - now) / 1000));
  const isExpired = status === 'expired' || (status === 'pending' && remaining === 0);
  const amountKes = invoice?.amountKes ?? toKes(item.amountSats);
  const showSimulator = status === 'pending' && !isExpired && canSimulate(method);
  const readTarget = isSubscription ? item.context : item;
  const subscribedUntil = isSubscription ? subscriptionExpiry(item.author.npub) : null;

  const startReading = () => {
    closePayment();
    if (readTarget?.book) navigate(`/book/${readTarget.book.id}/chapter/${readTarget.chapter.id}`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="Close payment dialog"
        className="absolute inset-0 animate-fade-in cursor-default bg-black/75 backdrop-blur-sm"
        onClick={closePayment}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-modal-title"
        tabIndex={-1}
        className="relative max-h-[94dvh] w-full max-w-lg animate-scale-in overflow-y-auto rounded-t-3xl border border-line bg-surface shadow-card focus:outline-none sm:rounded-3xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                isSubscription ? 'bg-violet-400/15 text-violet-200' : 'bg-btc/15 text-btc'
              }`}
            >
              {isSubscription ? <CalendarCheck className="h-4 w-4" /> : <Zap className="h-4 w-4" fill="currentColor" />}
            </span>
            <h2 id="pay-modal-title" className="text-sm font-semibold text-cream">
              {isSubscription ? 'Monthly subscription' : 'Unlock this chapter'}
            </h2>
          </div>
          <button type="button" onClick={closePayment} className="icon-btn h-9 w-9" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-6 pt-5 sm:px-6">
          {/* Purchase summary */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-[0.16em] text-cream-faint">{item.subtitle}</p>
              <p className="mt-1 font-display text-xl leading-snug text-cream">{item.title}</p>
              {isSubscription && (
                <p className="mt-1.5 text-xs text-cream-muted">
                  Unlocks all their paid chapters for {paymentOptions.subscriptionDays} days.
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              {method === 'mpesa' ? (
                <>
                  <p className="font-display text-3xl text-emerald-300">{formatKes(amountKes)}</p>
                  <p className="text-[11px] text-cream-faint">
                    {formatSats(item.amountSats)} sats{isSubscription && ' / month'}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-3xl text-btc">{formatSats(item.amountSats)}</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cream-faint">
                    sats{isSubscription && ' / month'}
                  </p>
                  <p className="text-[11px] text-cream-faint">≈ {formatKes(amountKes)}</p>
                </>
              )}
            </div>
          </div>

          {status !== 'paid' && <MethodTabs method={method} onChange={setMethod} />}

          {status === 'paid' ? (
            <div className="mt-6 animate-fade-up rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
              <p className="mt-4 font-display text-2xl text-cream">{isSubscription ? 'You’re subscribed' : 'Payment received'}</p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-cream-muted">
                {isSubscription
                  ? `Every paid chapter by ${item.author.name} is open to you${
                      subscribedUntil ? ` until ${formatDate(subscribedUntil)}` : ''
                    }.`
                  : 'The money went straight to the author. This chapter is now unlocked in this browser.'}
                {invoice?.receipt && (
                  <span className="mt-2 block font-mono text-xs text-cream-faint">M-Pesa receipt {invoice.receipt}</span>
                )}
              </p>
              {readTarget?.book ? (
                <button type="button" onClick={startReading} className="btn-primary mt-6 w-full sm:w-auto">
                  <BookOpen className="h-4 w-4" /> {isSubscription ? 'Continue reading' : 'Start reading'}
                </button>
              ) : (
                <button type="button" onClick={closePayment} className="btn-primary mt-6 w-full sm:w-auto">
                  Done
                </button>
              )}
            </div>
          ) : status === 'error' ? (
            <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-6 text-center">
              <XCircle className="mx-auto h-10 w-10 text-red-300" />
              <p className="mt-3 font-display text-xl text-cream">Couldn’t start the payment</p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-cream-muted">{payment.error}</p>
              <button type="button" onClick={regenerateInvoice} className="btn-secondary btn-sm mt-5">
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          ) : method === 'mpesa' ? (
            <MpesaBody
              key={invoice?.paymentHash || 'form'}
              payment={payment}
              amountKes={amountKes}
              remaining={remaining}
              isExpired={isExpired}
              onRetry={regenerateInvoice}
            />
          ) : (
            <LightningBody payment={payment} remaining={remaining} isExpired={isExpired} onRetry={regenerateInvoice} />
          )}

          {showSimulator && (
            <div className="mt-6 rounded-2xl border border-dashed border-btc/30 bg-btc/[0.04] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-btc">
                <FlaskConical className="h-3.5 w-3.5" /> Payment simulator
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-cream-muted">
                {method === 'mpesa'
                  ? 'Demo mode: no prompt is really sent. Use these buttons to act as the phone.'
                  : 'This invoice is a demo and can’t be paid on mainnet. Use these buttons to test the unlock flow.'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={simulateSuccess} disabled={isSimulating} className="btn-primary btn-sm disabled:opacity-50">
                  {isSimulating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Simulate Success
                </button>
                <button type="button" onClick={simulateFailure} disabled={isSimulating} className="btn-danger btn-sm disabled:opacity-50">
                  <AlertTriangle className="h-3.5 w-3.5" /> Simulate Failure
                </button>
              </div>
            </div>
          )}

          {!isSubscription && status !== 'paid' && (
            <SubscriptionUpsell
              item={item}
              toKes={toKes}
              days={paymentOptions.subscriptionDays}
              onSubscribe={() => openSubscription(item.book.author, { book: item.book, chapter: item.chapter })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
