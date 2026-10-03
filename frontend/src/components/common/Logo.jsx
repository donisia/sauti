import { Link } from 'react-router-dom';

/** Wordmark: a serif "S" seal followed by the platform name. */
export default function Logo({ compact = false }) {
  return (
    <Link to="/" className="group flex items-center gap-3" aria-label="Sauti home">
      <span className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-btc/40 bg-gradient-to-br from-btc/20 to-transparent font-display text-2xl font-bold text-btc transition group-hover:shadow-glow">
        S
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[28px] font-bold tracking-tight text-cream">Sauti</span>
          <span className="mt-1 block whitespace-nowrap text-[11px] italic text-cream-faint">Your voice. Your story. Your freedom.</span>
        </span>
      )}
    </Link>
  );
}
