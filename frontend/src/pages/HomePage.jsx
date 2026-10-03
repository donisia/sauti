import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Feather,
  KeyRound,
  PenLine,
  Quote,
  Radio,
  Smartphone,
  Unlock,
  VenetianMask,
  Wallet,
  Zap,
} from 'lucide-react';
import BookCard, { BookCardSkeleton } from '../components/common/BookCard';
import BookCover from '../components/common/BookCover';
import { useApi } from '../hooks/useApi';
import { api } from '../utils/api';

const HERO_IDS = ['things-fall-apart', 'the-open-sore-of-a-continent', 'burgers-daughter'];

const CITIES = ['Lagos', 'Nairobi', 'Harare', 'Dakar', 'Accra', 'Cairo', 'Johannesburg', 'Kampala', 'Kigali', 'Addis Ababa', 'Dar es Salaam', 'Lusaka'];

const FREEDOMS = [
  {
    icon: VenetianMask,
    title: 'Your voice',
    body: 'Write under your own name or a pen name. Your identity is a Nostr key that you hold: no email, no ID, no account that anyone can suspend.',
  },
  {
    icon: Feather,
    title: 'Your story',
    body: 'Publish chapter by chapter, signed and broadcast to open relays. No editor, algorithm or company decides whether your work is allowed to exist.',
  },
  {
    icon: Wallet,
    title: 'Your freedom',
    body: 'Readers pay you directly, per chapter or with a monthly subscription, over M-Pesa or Lightning. No payout thresholds and no 30-day holds.',
  },
];

const PAYMENTS = [
  {
    icon: Smartphone,
    title: 'M-Pesa',
    body: 'Enter a Safaricom number, confirm with your PIN, read. Prices are shown in shillings.',
    tone: 'border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-300',
  },
  {
    icon: Zap,
    title: 'Lightning',
    body: 'Scan an invoice with any Bitcoin wallet. Settles to the author in about a second.',
    tone: 'border-btc/25 bg-btc/[0.05] text-btc',
  },
  {
    icon: CalendarCheck,
    title: 'Monthly subscription',
    body: 'One payment opens every paid chapter by an author, including new ones, for 30 days.',
    tone: 'border-violet-400/25 bg-violet-400/[0.05] text-violet-200',
  },
];

const STEPS = [
  { icon: KeyRound, title: 'Choose your name', body: 'Connect a Nostr key with a NIP-07 extension and pick any pen name. We only ever see your public key.' },
  { icon: PenLine, title: 'Write & sign', body: 'Draft your book and chapters, then sign them with your key so readers know they are yours.' },
  { icon: Radio, title: 'Broadcast', body: 'Your work is published to multiple relays, so it stays discoverable across the network.' },
  { icon: Unlock, title: 'Readers unlock', body: 'Free chapters draw readers in. Paid ones unlock with M-Pesa, Lightning or a monthly subscription.' },
];

/** Overlapping cover composition for the hero. */
function HeroCovers({ books }) {
  const preferred = HERO_IDS.map((id) => books.find((b) => b.id === id)).filter(Boolean);
  const [left, center, right] = preferred.length === 3 ? preferred : books.slice(0, 3);
  return (
    <div className="relative mx-auto aspect-[10/9] w-full max-w-[680px]">
      {left && (
        <div className="absolute left-[2%] top-[11%] w-[34%] -rotate-[8deg] opacity-85 transition duration-700 hover:rotate-[-4deg]">
          <BookCover book={left} size="md" />
        </div>
      )}
      {right && (
        <div className="absolute right-[2%] top-[11%] w-[34%] rotate-[8deg] opacity-85 transition duration-700 hover:rotate-[4deg]">
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

      <div className="absolute bottom-[14%] left-0 w-[250px] sm:w-[270px]">
        <div className="flex animate-fade-up items-center gap-3 rounded-2xl border border-line bg-surface/90 p-3.5 shadow-card backdrop-blur-xl [animation-delay:400ms]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-violet-200">
            <VenetianMask className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-cream">Published as “Binti Jua”</p>
            <p className="truncate text-[11px] text-cream-faint">Pen name · signed with a Nostr key</p>
          </div>
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

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-4 font-display text-3xl leading-tight text-cream sm:text-5xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function BrowseLink({ to, children }) {
  return (
    <Link to={to} className="group inline-flex shrink-0 items-center gap-2 text-sm text-cream-muted transition hover:text-btc">
      {children} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function Shelf({ books, loading, error }) {
  if (error) {
    return <p className="mt-12 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-5 text-sm text-cream-muted">{error.message}</p>;
  }
  return (
    <div className="mt-12 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5 lg:gap-x-6">
      {loading ? Array.from({ length: 5 }, (_, i) => <BookCardSkeleton key={i} />) : books.map((book) => <BookCard key={book.id} book={book} />)}
    </div>
  );
}

export default function HomePage() {
  const { data, error, loading } = useApi((signal) => api.listBooks({}, { signal }), []);
  const books = data?.books ?? [];
  const isLoading = loading && !data;
  const feminist = books.filter((b) => b.category === 'Feminism').slice(0, 5);
  const achebe = books.filter((b) =>
    ['things-fall-apart', 'no-longer-at-ease', 'arrow-of-god', 'a-man-of-the-people', 'anthills-of-the-savannah'].includes(b.id),
  );
  const featured = books.filter((b) => b.featured && b.category !== 'Feminism' && !achebe.some((a) => a.id === b.id)).slice(0, 5);

  return (
    <>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-btc/10 blur-[120px]" />
        <div className="pointer-events-none absolute -left-40 top-40 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[120px]" />

        <div className="container-wide relative grid items-center gap-14 pb-16 pt-12 sm:pt-16 lg:min-h-[calc(100dvh-4rem-56px)] lg:grid-cols-2 lg:gap-16 lg:py-12 xl:gap-24">
          <div className="animate-fade-up">
            <p className="eyebrow">Sauti · a home for independent voices</p>
            <h1 className="mt-6 font-display text-[52px] font-semibold leading-[1.02] tracking-tight text-cream sm:text-7xl xl:text-8xl 2xl:text-[112px]">
              Your voice.
              <br />
              Your story.
              <br />
              <span className="italic text-btc">Your freedom.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-cream-muted sm:text-xl">
              Sauti, Swahili for “voice”, is where independent writers publish under any name they choose, keep the
              rights to every word, and get paid directly by readers with M-Pesa or Lightning.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link to="/explore" className="btn-primary btn-lg">
                <BookOpen className="h-4 w-4" /> Explore Books
              </Link>
              <Link to="/create-book" className="btn-secondary btn-lg">
                Start Writing <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <ul className="mt-12 flex flex-wrap gap-2.5">
              {[
                [VenetianMask, 'Pen names welcome', 'text-violet-200'],
                [Smartphone, 'M-Pesa & Lightning', 'text-emerald-300'],
                [CalendarCheck, 'Monthly subscriptions', 'text-btc'],
                [KeyRound, 'Keys, not accounts', 'text-cream-muted'],
              ].map(([Icon, label, tone]) => (
                <li key={label} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-xs text-cream">
                  <Icon className={`h-3.5 w-3.5 ${tone}`} /> {label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <HeroCovers books={books} />
          </div>
        </div>

        {/* Cities marquee */}
        <div className="relative overflow-hidden border-y border-line/70 bg-surface/40 py-4" aria-hidden="true">
          <div className="flex w-max motion-safe:animate-marquee">
            {[...CITIES, ...CITIES].map((city, i) => (
              <span key={i} className="flex items-center gap-6 pr-6 font-display text-lg italic text-cream-faint">
                {city} <span className="h-1 w-1 rounded-full bg-btc/60" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------- Three freedoms ------------------------- */}
      <section className="container-wide py-20 sm:py-28">
        <SectionHeader
          eyebrow="Why Sauti"
          title={
            <>
              Three promises, <span className="italic">no gatekeeper.</span>
            </>
          }
        />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {FREEDOMS.map(({ icon: Icon, title, body }, index) => (
            <article
              key={title}
              className="card group relative overflow-hidden p-8 transition duration-300 hover:-translate-y-1 hover:border-btc/30"
            >
              <span className="pointer-events-none absolute -right-2 -top-6 font-display text-[120px] leading-none text-white/[0.03]">
                0{index + 1}
              </span>
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-btc/25 bg-btc/10 text-btc transition group-hover:shadow-glow">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="relative mt-6 font-display text-3xl text-cream">{title}.</h3>
              <p className="relative mt-3 text-[15px] leading-relaxed text-cream-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------- Feminist voices ------------------------ */}
      <section className="border-y border-line/70 bg-gradient-to-b from-violet-500/[0.06] to-transparent">
        <div className="container-wide py-20 sm:py-24">
          <SectionHeader
            eyebrow="Feminist voices"
            title={
              <>
                The women who <span className="italic text-btc">rewrote the rules.</span>
              </>
            }
            action={<BrowseLink to="/explore?category=Feminism">All feminist titles</BrowseLink>}
          />
          <p className="mt-5 max-w-2xl text-cream-muted">
            Reading companions to Mariama Bâ, Buchi Emecheta, Tsitsi Dangarembga, Nawal El Saadawi and more, written by
            readers under their own pen names.
          </p>
          <Shelf books={feminist} loading={isLoading} error={error} />
        </div>
      </section>

      {/* --------------------------- Achebe --------------------------- */}
      <section className="container-wide py-20 sm:py-24">
        <SectionHeader
          eyebrow="Chinua Achebe"
          title={
            <>
              The African trilogy <span className="italic text-btc">and after.</span>
            </>
          }
          action={<BrowseLink to="/explore?q=achebe">All Achebe companions</BrowseLink>}
        />
        <p className="mt-5 max-w-2xl text-cream-muted">
          Reading companions to Things Fall Apart, No Longer at Ease, Arrow of God, A Man of the People and Anthills of
          the Savannah, written under the pen name Okike Ulo.
        </p>
        <Shelf books={achebe} loading={isLoading} error={error} />
      </section>

      {/* ------------------------- Featured books ------------------------- */}
      <section className="container-wide py-20 sm:py-24">
        <SectionHeader
          eyebrow="From the library"
          title="Featured books"
          action={<BrowseLink to="/explore">Browse all titles</BrowseLink>}
        />
        <Shelf books={featured} loading={isLoading} error={error} />
      </section>

      {/* ---------------------------- Payments ---------------------------- */}
      <section className="container-wide pb-20 sm:pb-24">
        <div className="panel grid gap-10 overflow-hidden p-7 sm:p-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <p className="eyebrow">Paying authors</p>
            <h2 className="mt-4 font-display text-3xl leading-tight text-cream sm:text-4xl">
              Pay the way you <span className="italic">already pay.</span>
            </h2>
            <p className="mt-5 leading-relaxed text-cream-muted">
              Every shilling and every sat goes to the person who wrote the words. Buy a single chapter, or subscribe to a
              writer you love and read everything they publish.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {PAYMENTS.map(({ icon: Icon, title, body, tone }) => (
              <div key={title} className={`rounded-2xl border p-5 ${tone}`}>
                <Icon className="h-5 w-5" />
                <p className="mt-4 font-display text-xl text-cream">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-cream-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------- How it works -------------------------- */}
      <section className="container-wide pb-20 sm:pb-24">
        <SectionHeader eyebrow="How it works" title="From first draft to first reader in four steps." />
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
      </section>

      {/* ------------------------------ Quote ----------------------------- */}
      <section className="border-y border-line/70 bg-surface/40">
        <div className="container-page max-w-4xl py-20 text-center sm:py-28">
          <Quote className="mx-auto h-10 w-10 text-btc/70" />
          <p className="mt-8 font-display text-3xl italic leading-snug text-cream sm:text-5xl">
            A story is only free when the person telling it is free to sign it with any name, and to be paid for it.
          </p>
          <p className="mt-8 text-sm uppercase tracking-[0.24em] text-cream-faint">The Sauti manifesto</p>
        </div>
      </section>

      {/* --------------------------- Author CTA --------------------------- */}
      <section className="container-wide py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-btc/25 bg-gradient-to-br from-[#2A1B0C] via-surface to-ink px-7 py-14 sm:px-14 sm:py-20">
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-btc/20 blur-[100px]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <p className="eyebrow">For writers</p>
              <h2 className="mt-4 font-display text-3xl leading-tight text-cream sm:text-5xl">
                Your voice. Your story. <span className="italic text-btc">Your freedom.</span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-cream-muted">
                Publish your first chapter today, under your name or a pen name. Keep it free to build an audience, or set
                a price and get paid the moment someone reads.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link to="/create-book" className="btn-primary btn-lg">
                <PenLine className="h-4 w-4" /> Start Writing
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
