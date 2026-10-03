import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Radio,
  Zap,
} from 'lucide-react';
import BookCover from '../components/common/BookCover';
import AuthorAvatar from '../components/common/AuthorAvatar';
import CopyButton from '../components/common/CopyButton';
import EmptyState from '../components/common/EmptyState';
import SubscriptionCard from '../components/common/SubscriptionCard';
import { PageError, PageLoading } from '../components/common/PageStatus';
import { useApi } from '../hooks/useApi';
import { useLightning } from '../hooks/useLightning';
import { api } from '../utils/api';
import { formatSats } from '../utils/lightning';
import { formatDate } from '../utils/format';
import { DEFAULT_RELAYS, KIND_LONG_FORM, shortenKey } from '../utils/nostr';

/** One row in the table of contents. */
function ChapterRow({ book, chapter }) {
  const { isUnlocked, openPayment } = useLightning();
  const unlocked = isUnlocked(book, chapter);
  const readPath = `/book/${book.id}/chapter/${chapter.id}`;

  return (
    <li className="group flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className="mt-0.5 w-8 shrink-0 font-display text-2xl leading-none text-cream-faint transition group-hover:text-btc">
          {String(chapter.number).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <Link to={readPath} className="font-display text-lg leading-snug text-cream transition hover:text-btc sm:text-xl">
            {chapter.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-cream-faint">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {chapter.readingMinutes} min read
            </span>
            {chapter.isFree ? (
              <span className="badge-free">Free</span>
            ) : unlocked ? (
              <span className="badge-free">
                <CheckCircle2 className="h-3 w-3" /> Unlocked
              </span>
            ) : (
              <span className="badge-btc">
                <Lock className="h-3 w-3" /> {formatSats(chapter.priceSats)} sats
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pl-12 sm:pl-0">
        {unlocked ? (
          <Link to={readPath} className="btn-secondary btn-sm w-full sm:w-auto">
            <BookOpen className="h-3.5 w-3.5" /> Read Chapter
          </Link>
        ) : (
          <button type="button" onClick={() => openPayment(book, chapter)} className="btn-primary btn-sm w-full sm:w-auto">
            <Zap className="h-3.5 w-3.5" fill="currentColor" /> Unlock chapter
          </button>
        )}
      </div>
    </li>
  );
}

export default function BookDetailPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi((signal) => api.getBook(id, { signal }), [id]);
  const book = data?.book;

  if (loading && book?.id !== id) return <PageLoading label="Loading book…" />;
  if (error && error.status !== 404) return <PageError error={error} onRetry={reload} />;

  if (!book) {
    return (
      <div className="container-page py-24">
        <EmptyState
          title="Book not found"
          description="We couldn’t find this title on any of our relays. It may have been removed by its author."
          actionLabel="Explore the library"
          actionTo="/explore"
        />
      </div>
    );
  }

  const { author, freeCount, fullPrice, startingPrice } = book;
  const totalMinutes = book.chapters.reduce((sum, c) => sum + c.readingMinutes, 0);
  const firstChapter = book.chapters[0];
  const palette = book.cover || { from: '#2A2D37' };

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-40"
        style={{ background: `radial-gradient(60% 60% at 25% 20%, ${palette.from} 0%, transparent 70%)` }}
      />

      <div className="container-page relative py-10 sm:py-14">
        <Link to="/explore" className="inline-flex items-center gap-2 text-sm text-cream-muted transition hover:text-btc">
          <ArrowLeft className="h-4 w-4" /> Back to library
        </Link>

        {/* --------------------------- Hero --------------------------- */}
        <section className="mt-8 grid gap-10 md:grid-cols-[260px_1fr] lg:grid-cols-[320px_1fr] lg:gap-16">
          <div className="mx-auto w-56 sm:w-64 md:w-full">
            <BookCover book={book} size="lg" />
          </div>

          <div className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/explore?category=${book.category}`} className="badge-btc hover:bg-btc/20">
                {book.category}
              </Link>
              <span className="badge-nostr">
                <BadgeCheck className="h-3 w-3" /> Signed on Nostr
              </span>
            </div>

            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] text-cream sm:text-5xl lg:text-6xl">
              {book.title}
            </h1>
            {book.subtitle && <p className="mt-3 font-display text-xl italic text-cream-muted sm:text-2xl">{book.subtitle}</p>}

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
              <Link to={`/author/${author.npub}`} className="flex items-center gap-2.5 text-cream transition hover:text-btc">
                <AuthorAvatar author={author} size="sm" />
                <span className="font-medium">{author.name}</span>
              </Link>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-3 pr-1 font-mono text-xs text-cream-muted">
                {shortenKey(author.npub)}
                <CopyButton value={author.npub} label="Copy author npub" successMessage="Author npub copied" className="h-7 w-7" />
              </span>
              <span className="inline-flex items-center gap-1.5 text-cream-faint">
                <Calendar className="h-4 w-4" /> {formatDate(book.publishedAt)}
              </span>
            </div>

            <p className="mt-8 max-w-2xl font-serif text-lg leading-relaxed text-cream/90">{book.description}</p>

            <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { icon: Layers, label: 'Chapters', value: book.chapters.length },
                { icon: BookOpen, label: 'Free', value: freeCount },
                { icon: Clock, label: 'Reading', value: `${Math.round(totalMinutes / 6) / 10} h` },
                { icon: Globe, label: 'Language', value: book.language },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="panel px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-cream-faint">
                    <Icon className="h-3 w-3" /> {label}
                  </dt>
                  <dd className="mt-1 font-display text-xl text-cream">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {firstChapter ? (
                <Link to={`/book/${book.id}/chapter/${firstChapter.id}`} className="btn-primary btn-lg">
                  <BookOpen className="h-4 w-4" /> {firstChapter.isFree ? 'Start reading free' : 'Start reading'}
                </Link>
              ) : (
                <span className="btn-secondary btn-lg pointer-events-none opacity-60">First chapter coming soon</span>
              )}
              <a href="#contents" className="btn-secondary btn-lg">
                Table of contents
              </a>
            </div>

            {book.tags?.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {book.tags.map((tag) => (
                  <Link key={tag} to={`/explore?q=${encodeURIComponent(tag)}`} className="badge-neutral hover:border-btc/40 hover:text-cream">
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ---------------------- Contents + Sidebar ---------------------- */}
        <section className="mt-16 grid gap-8 lg:mt-24 lg:grid-cols-[1fr_360px] lg:gap-12">
          <div id="contents" className="scroll-mt-24">
            <div className="flex items-end justify-between gap-4 border-b border-line pb-5">
              <div>
                <p className="eyebrow">Table of contents</p>
                <h2 className="mt-3 font-display text-3xl text-cream">Chapters</h2>
              </div>
              <p className="text-right text-xs text-cream-faint">
                {startingPrice ? (
                  <>
                    From <span className="text-btc">{formatSats(startingPrice)} sats</span>
                    <br />
                    Full book {formatSats(fullPrice)} sats
                  </>
                ) : (
                  <span className="text-emerald-300">Every chapter is free</span>
                )}
              </p>
            </div>
            {book.chapters.length > 0 ? (
              <ol className="divide-y divide-line">
                {book.chapters.map((chapter) => (
                  <ChapterRow key={chapter.id} book={book} chapter={chapter} />
                ))}
              </ol>
            ) : (
              <p className="py-10 text-sm text-cream-faint">The author hasn’t published any chapters yet.</p>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* Author card */}
            <div className="card p-6">
              <p className="eyebrow">About the author</p>
              <div className="mt-5 flex items-center gap-4">
                <AuthorAvatar author={author} size="md" />
                <div className="min-w-0">
                  <Link to={`/author/${author.npub}`} className="font-display text-xl text-cream transition hover:text-btc">
                    {author.name}
                  </Link>
                  <p className="text-xs text-cream-faint">{author.location}</p>
                </div>
              </div>
              {author.bio && <p className="mt-5 text-sm leading-relaxed text-cream-muted">{author.bio}</p>}

              <div className="mt-5 space-y-2.5 rounded-xl border border-line bg-ink/50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-xs">
                    <KeyRound className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                    <span className="truncate font-mono text-cream-muted">{shortenKey(author.npub, 12, 6)}</span>
                  </span>
                  <CopyButton value={author.npub} label="Copy npub" successMessage="Public key copied" />
                </div>
                {author.lightningAddress && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-xs">
                      <Zap className="h-3.5 w-3.5 shrink-0 text-btc" />
                      <span className="truncate font-mono text-cream-muted">{author.lightningAddress}</span>
                    </span>
                    <CopyButton value={author.lightningAddress} label="Copy lightning address" successMessage="Lightning address copied" />
                  </div>
                )}
              </div>

              <Link to={`/author/${author.npub}`} className="btn-secondary btn-sm mt-5 w-full">
                View all books by {author.name.split(' ')[0]}
              </Link>
            </div>

            {startingPrice > 0 && <SubscriptionCard author={author} />}

            {/* Provenance card */}
            <div className="panel p-6">
              <p className="flex items-center gap-2 text-sm font-medium text-cream">
                <Radio className="h-4 w-4 text-btc" /> Provenance
              </p>
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-cream-faint">Event kind</dt>
                  <dd className="font-mono text-cream-muted">{KIND_LONG_FORM} · NIP-23</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-cream-faint">Event id</dt>
                  <dd className="truncate font-mono text-cream-muted">{book.nostrEventId ? shortenKey(book.nostrEventId, 10, 6) : 'Not broadcast'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-cream-faint">Mirrored on</dt>
                  <dd className="text-cream-muted">{DEFAULT_RELAYS.length} relays</dd>
                </div>
              </dl>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
