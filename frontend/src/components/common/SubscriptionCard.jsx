import { CalendarCheck, Smartphone, Sparkles, Zap } from 'lucide-react';
import { useLightning } from '../../hooks/useLightning';
import { formatKes, formatSats } from '../../utils/lightning';
import { formatDate } from '../../utils/format';

/** Monthly pass to everything an author publishes, or its active state. */
export default function SubscriptionCard({ author, context = null, className = '' }) {
  const { subscriptionExpiry, openSubscription, toKes, paymentOptions } = useLightning();
  const price = author?.subscriptionPriceSats;
  if (!price) return null;
  const until = subscriptionExpiry(author.npub);

  if (until) {
    return (
      <div className={`rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5 ${className}`}>
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
          <CalendarCheck className="h-4 w-4" /> Subscribed until {formatDate(until)}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-cream-muted">Every paid chapter by {author.name} is open to you.</p>
        <button type="button" onClick={() => openSubscription(author, context)} className="btn-ghost btn-sm mt-3 -ml-3.5">
          Renew early · adds {paymentOptions.subscriptionDays} days
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/[0.10] to-transparent p-5 ${className}`}>
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
        <Sparkles className="h-3.5 w-3.5" /> Monthly subscription
      </p>
      <p className="mt-3 font-display text-3xl text-cream">
        {formatSats(price)} <span className="font-sans text-sm text-cream-faint">sats / month</span>
      </p>
      <p className="text-xs text-cream-faint">≈ {formatKes(toKes(price))} per month</p>
      <p className="mt-3 text-sm leading-relaxed text-cream-muted">
        Read every paid chapter by {author.name}, including new ones, for {paymentOptions.subscriptionDays} days.
      </p>
      <button type="button" onClick={() => openSubscription(author, context)} className="btn-primary mt-4 w-full">
        Subscribe to {author.name.split(' ')[0]}
      </button>
      <p className="mt-2.5 flex items-center justify-center gap-3 text-[11px] text-cream-faint">
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3 text-btc" /> Lightning
        </span>
        <span className="inline-flex items-center gap-1">
          <Smartphone className="h-3 w-3 text-emerald-300" /> M-Pesa
        </span>
      </p>
    </div>
  );
}
