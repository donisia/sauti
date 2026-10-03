import { Link, useParams } from 'react-router-dom';
import { BookOpen, Calendar, Fingerprint, KeyRound, MapPin, PenLine, Server, ShieldCheck, Zap } from 'lucide-react';
import AuthorAvatar from '../components/common/AuthorAvatar';
import BookCard from '../components/common/BookCard';
import CopyButton from '../components/common/CopyButton';
import EmptyState from '../components/common/EmptyState';
import SubscriptionCard from '../components/common/SubscriptionCard';
import { PageError, PageLoading } from '../components/common/PageStatus';
import { useApi } from '../hooks/useApi';
import { useNostr } from '../hooks/useNostr';
import { api } from '../utils/api';
import { formatDate, formatNumber } from '../utils/format';
import { shortenKey } from '../utils/nostr';

/** Explains key-pair identity vs. a hosted account. */
function PublishingIdentity({ npub }) {
  return (
    <section className="card relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative">
        <p className="flex items-center gap-2 text-sm font-semibold text-cream">
          <Fingerprint className="h-4 w-4 text-violet-300" /> Publishing Identity
        </p>
        <p className="mt-3 text-sm leading-relaxed text-cream-muted">
          This identity is anchored to a <span className="text-cream">Nostr key pair</span>, not a row in a
          company’s database. Every book and chapter listed here is an event signed by the key below, so anyone can
          verify authorship — and no platform can impersonate, suspend, or quietly reassign it.
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: KeyRound, title: 'Self-custodied', body: 'Only the author holds the private key.' },
            { icon: ShieldCheck, title: 'Verifiable', body: 'Signatures prove every event’s origin.' },
            { icon: Server, title: 'Portable', body: 'Works with any relay or Nostr client.' },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border border-line bg-ink/50 p-4">
              <Icon className="h-4 w-4 text-btc" />
              <p className="mt-2.5 text-sm font-medium text-cream">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-cream-faint">{body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/60 px-4 py-3">
          <code className="min-w-0 truncate font-mono text-xs text-cream-muted">{npub}</code>
          <CopyButton value={npub} label="Copy" showLabel successMessage="Public key copied" />
        </div>
      </div>
    </section>
  );
}

export default function AuthorProfilePage() {
  const { npub: rawNpub } = useParams();
  const npub = decodeURIComponent(rawNpub);
  const { npub: myNpub } = useNostr();
  const isMe = myNpub === npub;
  const { data, error, loading, reload } = useApi((signal) => api.getAuthor(npub, { signal }), [npub]);
  const author = data?.author?.npub === npub ? data.author : null;

  if (loading && !author) return <PageLoading label="Loading author…" />;
  if (error && error.status !== 404) return <PageError error={error} onRetry={reload} />;

  // A connected user without catalogue entries still gets a real profile page.
  if (!author && !isMe) {
    return (
      <div className="container-page py-24">
        <EmptyState
          title="Author not found"
          description={`No books signed by ${shortenKey(npub)} were found on our relays.`}
          actionLabel="Explore authors’ books"
          actionTo="/explore"
        />
      </div>
    );
  }

  const fallback = {
    npub,
    name: 'Anonymous Author',
    initials: '✦',
    bio: 'This key hasn’t published any books yet. Publish your first title to fill this page.',
    lightningAddress: null,
    location: 'Somewhere on the network',
    joined: new Date().toISOString(),
    avatarHue: 30,
  };
  const profile = author
    ? { ...author, bio: author.bio || fallback.bio, location: author.location || fallback.location }
    : fallback;
  const authorBooks = author ? data.books : [];
  const totalChapters = author?.stats.chapters ?? 0;

  return (
    <div>
      {/* Banner */}
      <div className="relative h-48 overflow-hidden border-b border-line sm:h-64">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(80% 120% at 20% 0%, hsl(${profile.avatarHue} 50% 22%) 0%, transparent 60%), radial-gradient(60% 100% at 90% 100%, rgba(247,147,26,0.18) 0%, transparent 60%), #0F1012`,
          }}
        />
        <div className="grain absolute inset-0 opacity-60" />
        <p className="absolute bottom-6 right-6 hidden font-display text-[120px] italic leading-none text-white/[0.04] lg:block">
          {profile.name.split(' ')[0]}
        </p>
      </div>

      <div className="container-page">
        <header className="relative -mt-14 flex flex-col gap-6 sm:-mt-16 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <AuthorAvatar author={profile} size="lg" />
            <div>
              <p className="eyebrow">Author</p>
              <h1 className="mt-2 font-display text-4xl font-semibold text-cream sm:text-5xl">{profile.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-3 pr-1 font-mono text-cream-muted">
                  <KeyRound className="mr-1 h-3 w-3 text-violet-300" />
                  {shortenKey(profile.npub)}
                  <CopyButton value={profile.npub} label="Copy npub" successMessage="Public key copied" className="h-7 w-7" />
                </span>
                {profile.lightningAddress && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-btc/30 bg-btc/10 py-0.5 pl-3 pr-1 font-mono text-btc">
                    <Zap className="mr-1 h-3 w-3" />
                    {profile.lightningAddress}
                    <CopyButton value={profile.lightningAddress} label="Copy lightning address" successMessage="Lightning address copied" className="h-7 w-7" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {isMe && (
            <Link to="/create-book" className="btn-primary self-start md:self-end">
              <PenLine className="h-4 w-4" /> Publish a new book
            </Link>
          )}
        </header>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-12">
          <div className="space-y-8">
            <section>
              <p className="max-w-2xl font-serif text-lg leading-relaxed text-cream/90">{profile.bio}</p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-cream-faint">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {profile.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> On Nostr since {formatDate(profile.joined)}
                </span>
              </div>
            </section>

            <PublishingIdentity npub={profile.npub} />
          </div>

          <aside className="grid grid-cols-3 gap-3 self-start lg:grid-cols-1">
            {author && !isMe && <SubscriptionCard author={author} className="col-span-3 lg:col-span-1" />}
            {[
              { label: 'Books', value: authorBooks.length },
              { label: 'Chapters', value: totalChapters },
              { label: 'Paying readers', value: formatNumber(profile.stats?.paidReaders ?? 0) },
            ].map((stat) => (
              <div key={stat.label} className="panel px-4 py-4 sm:px-5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-cream-faint">{stat.label}</p>
                <p className="mt-1 font-display text-2xl text-cream sm:text-3xl">{stat.value}</p>
              </div>
            ))}
          </aside>
        </div>

        <section className="mt-16">
          <div className="flex items-end justify-between border-b border-line pb-5">
            <h2 className="font-display text-3xl text-cream">Published books</h2>
            <span className="text-sm text-cream-faint">{authorBooks.length} titles</span>
          </div>
          {authorBooks.length > 0 ? (
            <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
              {authorBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState
                icon={BookOpen}
                title="No books yet"
                description="Signed books will appear here as soon as they’re published to relays."
                actionLabel="Create your first book"
                actionTo="/create-book"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
