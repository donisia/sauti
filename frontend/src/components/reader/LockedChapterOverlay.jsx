import { useMemo } from 'react';
import { Lock, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import ChapterContent from './ChapterContent';
import { formatKes, formatSats } from '../../utils/lightning';
import { useLightning } from '../../hooks/useLightning';

const PREVIEW_PARAGRAPHS = 2;

/**
 * Builds placeholder text for the blurred region. The real paid body is
 * deliberately NOT rendered to the DOM, so "inspect element" reveals nothing.
 */
function scramble(paragraphs) {
  const words = paragraphs.join(' ').split(/\s+/);
  return Array.from({ length: 3 }, (_, i) => {
    const start = (i * 17) % words.length;
    return [...words.slice(start), ...words.slice(0, start)].slice(0, 70).reverse().join(' ');
  });
}

/** Preview + blurred continuation + unlock panel for paid, locked chapters. */
export default function LockedChapterOverlay({ chapter, author, paragraphs, format, onUnlock, onSubscribe }) {
  const { toKes, paymentOptions } = useLightning();
  const preview = paragraphs.slice(0, PREVIEW_PARAGRAPHS);
  const filler = useMemo(() => scramble(paragraphs.slice(0, PREVIEW_PARAGRAPHS)), [paragraphs]);
  const subscriptionSats = author?.subscriptionPriceSats;

  return (
    <div>
      <ChapterContent paragraphs={preview} format={format} showEnding={false} />

      <div className="relative mt-[1.35em] min-h-[720px] overflow-hidden">
        {/* Blurred, non-selectable placeholder continuation */}
        <div aria-hidden="true" className="pointer-events-none select-none blur-[6px]">
          <ChapterContent paragraphs={filler} format={format} showEnding={false} dropCap={false} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/85 to-ink" />

        {/* Unlock panel */}
        <div className="absolute inset-x-0 top-6 flex justify-center px-1 sm:top-12">
          <div className="w-full max-w-md animate-fade-up rounded-3xl border border-btc/25 bg-surface/95 p-6 text-center shadow-glow-soft backdrop-blur-xl sm:p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-btc/30 bg-btc/10 text-btc shadow-glow">
              <Lock className="h-6 w-6" />
            </span>
            <h2 className="mt-5 font-display text-2xl text-cream sm:text-3xl">Unlock this chapter</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-cream-muted">
              Continue reading <span className="text-cream">“{chapter.title}”</span> with a one-time payment that goes
              directly to the author.
            </p>

            <p className="mt-6 font-display text-5xl text-btc">
              {formatSats(chapter.priceSats)}
              <span className="ml-2 align-middle font-sans text-sm uppercase tracking-[0.18em] text-cream-faint">sats</span>
            </p>
            <p className="mt-1 text-xs text-cream-faint">≈ {formatKes(toKes(chapter.priceSats))}</p>

            <button type="button" onClick={onUnlock} className="btn-primary btn-lg mt-6 w-full">
              <Zap className="h-4 w-4" fill="currentColor" /> Unlock chapter
            </button>
            <p className="mt-2.5 text-[11px] text-cream-faint">Pay with Lightning or M-Pesa</p>

            {subscriptionSats > 0 && (
              <div className="mt-6 border-t border-line pt-6">
                <button type="button" onClick={onSubscribe} className="btn-secondary w-full">
                  <Sparkles className="h-4 w-4 text-violet-200" /> Subscribe to {author.name}
                </button>
                <p className="mt-2.5 text-[11px] leading-relaxed text-cream-faint">
                  {formatSats(subscriptionSats)} sats (≈ {formatKes(toKes(subscriptionSats))}) a month · every paid chapter for{' '}
                  {paymentOptions.subscriptionDays} days
                </p>
              </div>
            )}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-cream-faint">
              <ShieldCheck className="h-3.5 w-3.5" /> No account · No card · Instant access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
