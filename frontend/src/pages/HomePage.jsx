import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Feather, KeyRound, PenLine, Radio, Smartphone, Unlock, Zap } from 'lucide-react';
import BookCard, { BookCardSkeleton } from '../components/common/BookCard';
import BookCover from '../components/common/BookCover';
import { useApi } from '../hooks/useApi';
import { api } from '../utils/api';

const HERO_IDS = ['ledger-of-kings', 'the-salt-roads', 'small-hours'];

const FEATURES = [
  {
    icon: Feather,
    title: 'Publish Freely',
    body: 'Your book is a set of signed Nostr events broadcast to many independent relays. No single company can delist it, shadow-ban it, or quietly change its terms.',
  },
  {
    icon: Zap,
    title: 'Earn Directly',
    body: 'Price each chapter in sats, or offer a monthly subscription to everything you write. Readers pay over Lightning or with M-Pesa — no payout thresholds, no 30-day holds, no middleman.',
  },
  {
    icon: KeyRound,
    title: 'Own Your Identity',
    body: 'Your pen name is anchored to a key pair you control. Take your readers, reputation and catalogue to any Nostr client, any time. Nobody can revoke it.',
  },
];

const STEPS = [
  { icon: KeyRound, title: 'Connect your key', body: 'Sign in with a NIP-07 extension like Alby or nos2x. We only ever see your public key.' },
  { icon: PenLine, title: 'Write & sign', body: 'Draft your book and chapters, then sign the public metadata with your Nostr key.' },
  { icon: Radio, title: 'Broadcast to relays', body: 'Metadata is published to multiple relays, so your work stays discoverable across the network.' },
  { icon: Unlock, title: 'Readers unlock', body: 'Free chapters hook readers in. Paid chapters unlock with Lightning or M-Pesa, or with a monthly subscription to the author.' },
];

/** Overlapping cover composition for the hero; falls back to the first featured titles. */
function HeroCovers({ books }) {
  const preferred = HERO_IDS.map((id) => books.find((b) => b.id === id)).filter(Boolean);
  const [left, center, right] = preferred.length === 3 ? preferred : books.slice(0, 3);
  return (
    <div className="relative mx-auto aspect-[10/9] w-full max-w-[680px]">
      {left && (
        <div className="absolute left-[2%] top-[11%] w-[34%] -rotate-[8deg] opacity-80 transition duration-700 hover:rotate-[-4deg]">
          <BookCover book={left} size="md" />
        </div>
      )}
      {right && (
        <div className="absolute right-[2%] top-[11%] w-[34%] rotate-[8deg] opacity-80 transition duration-700 hover:rotate-[4deg]">
          <BookCover book={right} size="md" />
        </div>
      )}
      <div className="absolute left-1/2 top-0 w-[48%] -translate-x-1/2">
        <div className="animate-float">
          {center ? (
            <BookCover book={center} size="lg" className="shadow-glow-soft" />
          ) : (
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-card" />
          )}
        </div>
      </div>

      {/* Floating payment receipts */}
      <div className="absolute bottom-[14%] left-0 w-[250px] sm:w-[270px]">
        <div className="flex animate-fade-up items-center gap-3 rounded-2xl border border-line bg-surface/90 p-3.5 shadow-card backdrop-blur-xl [animation-delay:400ms]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btc/15 text-btc">
            <Zap className="h-4 w-4" fill="currentColor" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-cream">Chapter 3 unlocked</p>
            <p className="truncate text-[11px] text-cream-faint">The Salt Roads · settled in 1.2s</p>
          </div>
          <span className="font-mono text-sm text-btc">+210</span>
        </div>
      </div>
      <div className="absolute bottom-0 right-0 hidden w-[270px] sm:block">
        <div className="flex animate-fade-up items-center gap-3 rounded-2xl border border-emerald-400/20 bg-surface/90 p-3.5 shadow-card backdrop-blur-xl [animation-delay:700ms]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
            <Smartphone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-cream">Monthly subscription</p>
            <p className="truncate text-[11px] text-cream-faint">Paid with M-Pesa · 30 days</p>
          </div>
          <span className="font-mono text-sm text-emerald-300">KES 520</span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data, error, loading } = useApi((signal) => api.listBooks({ featured: 1 }, { signal }), []);
  const featuredBooks = data?.books ?? [];
  const featured = featuredBooks.slice(0, 5);

  return (
    <>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-btc/10 blur-[120px]" />
        <div className="pointer-events-none absolute -left-40 top-40 h-[360px] w-[360px] rounded-full bg-violet-500/5 blur-[120px]" />

        <div className="container-wide relative grid items-center gap-14 pb-20 pt-12 sm:pt-16 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-2 lg:gap-16 lg:py-16 xl:gap-24">
          <div className="animate-fade-up">
            <p className="eyebrow">Nostr identity · Lightning &amp; M-Pesa payments</p>
            <h1 className="mt-6 font-display text-[48px] font-semibold leading-[1.02] tracking-tight text-cream sm:text-7xl xl:text-8xl 2xl:text-[112px]">
              Publish freely.
              <br />
              <span className="italic text-btc">Earn directly.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-cream-muted sm:text-xl">
              Sovereign Publishing gives independent authors a home that no platform can take away. Sign your work with a
              Nostr key, publish to open relays, and get paid per chapter or through monthly subscriptions in sats over
              Lightning or with M-Pesa.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link to="/explore" className="btn-primary btn-lg">
                <BookOpen className="h-4 w-4" /> Explore Books
              </Link>
              <Link to="/create-book" className="btn-secondary btn-lg">
                Start Publishing <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-6 border-t border-line pt-8 sm:grid-cols-4">
              {[
                ['Per chapter', 'Pricing'],
                ['Monthly', 'Subscriptions'],
                ['Sats or KES', 'Pay with'],
                ['Your keys', 'Your identity'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">{label}</dt>
                  <dd className="mt-1.5 font-display text-lg text-cream sm:text-xl">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <HeroCovers books={featuredBooks} />
          </div>
        </div>
      </section>

      {/* ---------------------------- Features ---------------------------- */}
      <section className="border-y border-line/70 bg-surface/40">
        <div className="container-wide py-20 sm:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">Why Sovereign Publishing</p>
            <h2 className="mt-4 font-display text-3xl leading-tight text-cream sm:text-5xl">
              The printing press, <span className="italic">without the gatekeeper.</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card group p-7 transition duration-300 hover:-translate-y-1 hover:border-btc/30">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-btc/25 bg-btc/10 text-btc transition group-hover:shadow-glow">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 font-display text-2xl text-cream">{title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-cream-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------- Featured books ------------------------- */}
      <section className="container-wide py-20 sm:py-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">From the library</p>
            <h2 className="mt-4 font-display text-3xl text-cream sm:text-5xl">Featured books</h2>
          </div>
          <Link to="/explore" className="group inline-flex items-center gap-2 text-sm text-cream-muted transition hover:text-btc">
            Browse all titles <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>

        {error ? (
          <p className="mt-12 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-5 text-sm text-cream-muted">{error.message}</p>
        ) : (
          <div className="mt-12 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5 lg:gap-x-6">
            {loading && !data
              ? Array.from({ length: 5 }, (_, i) => <BookCardSkeleton key={i} />)
              : featured.map((book) => <BookCard key={book.id} book={book} />)}
          </div>
        )}
      </section>

      {/* -------------------------- How it works -------------------------- */}
      <section className="container-wide pb-20 sm:pb-24">
        <div className="panel overflow-hidden p-7 sm:p-12">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-4 font-display text-3xl text-cream sm:text-4xl">From manuscript to micropayment in four steps.</h2>
          </div>

          <div className="relative mt-12">
            <div
              className="absolute left-6 right-6 top-6 hidden h-px bg-gradient-to-r from-btc/50 via-line to-transparent lg:block"
              aria-hidden="true"
            />
            <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="relative">
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-line bg-ink text-btc">
                    <Icon className="h-5 w-5" />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-btc text-[10px] font-bold text-ink">
                      {index + 1}
                    </span>
                  </span>
                  <h3 className="mt-5 font-display text-xl text-cream">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* --------------------------- Author CTA --------------------------- */}
      <section className="container-wide">
        <div className="relative overflow-hidden rounded-3xl border border-btc/25 bg-gradient-to-br from-[#2A1B0C] via-surface to-ink px-7 py-14 sm:px-14 sm:py-20">
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-btc/20 blur-[100px]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <p className="eyebrow">For authors</p>
              <h2 className="mt-4 font-display text-3xl leading-tight text-cream sm:text-5xl">
                Your words. Your readers. <span className="italic text-btc">Your sats.</span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-cream-muted">
                Publish your first chapter today. Keep it free to build an audience, or price it at a few hundred sats and
                get paid the moment someone reads.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link to="/create-book" className="btn-primary btn-lg">
                <PenLine className="h-4 w-4" /> Start Publishing
              </Link>
              <Link to="/about" className="btn-secondary btn-lg">
                Read the manifesto
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
