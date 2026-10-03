import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Fingerprint,
  KeyRound,
  Layers,
  LayoutDashboard,
  Library,
  Loader2,
  LogOut,
  Pencil,
  PlusCircle,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import BookCover from '../components/common/BookCover';
import CopyButton from '../components/common/CopyButton';
import EmptyState from '../components/common/EmptyState';
import { PageError, PageLoading } from '../components/common/PageStatus';
import { useApi } from '../hooks/useApi';
import { useNostr } from '../hooks/useNostr';
import { formatKes, formatSats } from '../utils/lightning';
import { formatDate, formatNumber, timeAgo } from '../utils/format';
import { shortenKey } from '../utils/nostr';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'books', label: 'My Books', icon: Library },
  { id: 'new', label: 'New Book', icon: PlusCircle, to: '/create-book' },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'identity', label: 'Nostr Identity', icon: Fingerprint },
];

/* --------------------------------- Pieces --------------------------------- */

function KpiCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream-faint">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-btc/10 text-btc">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 font-display text-3xl text-cream sm:text-4xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-emerald-300">{hint}</p>}
    </div>
  );
}

function PublicationsTable({ books }) {
  if (books.length === 0) {
    return (
      <EmptyState
        icon={Library}
        title="No books yet"
        description="Create your first book, then add free or paid chapters to it."
        actionLabel="Create a book"
        actionTo="/create-book"
      />
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-[0.14em] text-cream-faint">
              <th className="px-5 py-3.5 font-medium">Title</th>
              <th className="px-5 py-3.5 font-medium">Category</th>
              <th className="px-5 py-3.5 font-medium">Chapters</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">Published</th>
              <th className="px-5 py-3.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {books.map((book) => {
              const paid = book.paidCount;
              return (
                <tr key={book.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-4">
                    <Link to={`/book/${book.id}`} className="flex items-center gap-3">
                      <BookCover book={book} size="xs" className="w-9 shrink-0 rounded" />
                      <span className="font-display text-base text-cream hover:text-btc">{book.title}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-cream-muted">{book.category}</td>
                  <td className="px-5 py-4 text-cream-muted">
                    {book.chapters.length} <span className="text-cream-faint">({paid} paid)</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="badge-free">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Signed
                    </span>
                  </td>
                  <td className="px-5 py-4 text-cream-muted">{formatDate(book.publishedAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1.5">
                      <Link to={`/create-chapter?book=${book.id}`} className="btn-ghost btn-sm" title="Add chapter">
                        <PlusCircle className="h-3.5 w-3.5" /> Chapter
                      </Link>
                      <Link to={`/create-book?edit=${book.id}`} className="btn-secondary btn-sm" title="Edit book">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncomeFeed({ entries, limit }) {
  const list = limit ? entries.slice(0, limit) : entries;
  if (list.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-cream-faint">No payments yet. Chapter unlocks and subscriptions will appear here.</p>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {list.map((entry) => {
        const mpesa = entry.method === 'mpesa';
        const subscription = entry.purpose === 'subscription';
        return (
          <li key={entry.id} className="flex items-center gap-3 py-3.5">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                mpesa ? 'bg-emerald-400/10 text-emerald-300' : 'bg-btc/10 text-btc'
              }`}
              title={mpesa ? 'M-Pesa' : 'Lightning'}
            >
              {mpesa ? <Smartphone className="h-4 w-4" /> : <Zap className="h-4 w-4" fill="currentColor" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-cream">
                {subscription ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-300" /> Monthly subscription
                  </span>
                ) : (
                  `Ch. ${entry.chapterNumber} · ${entry.chapterTitle}`
                )}
              </p>
              <p className="truncate text-xs text-cream-faint">
                {subscription ? 'All paid chapters' : entry.bookTitle} · {mpesa ? 'M-Pesa' : 'Lightning'} ·{' '}
                <span className="font-mono">{entry.reader}…</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              {mpesa && entry.kes ? (
                <>
                  <p className="font-mono text-sm text-emerald-300">+{formatKes(entry.kes)}</p>
                  <p className="text-[11px] text-cream-faint">
                    {formatSats(entry.sats)} sats · {timeAgo(entry.at)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-mono text-sm text-btc">+{formatSats(entry.sats)}</p>
                  <p className="text-[11px] text-cream-faint">{timeAgo(entry.at)}</p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Sats per day for the last 7 days: [{ date, label, sats }]. */
function WeeklyChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.sats));
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-3">
      {days.map((day, i) => (
        <div key={day.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="text-[10px] font-mono text-cream-faint opacity-0 transition group-hover:opacity-100">{formatSats(day.sats)}</span>
          <div
            className={`w-full rounded-t-lg transition-all duration-500 ${i === days.length - 1 ? 'bg-btc shadow-glow' : 'bg-btc/30 group-hover:bg-btc/60'}`}
            style={{ height: `${Math.max(2, (day.sats / max) * 100)}%` }}
          />
          <span className="text-[11px] text-cream-faint">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function AuthorDashboardPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab') && !t.to) ? params.get('tab') : 'overview';
  const { isConnected, isConnecting, isSimulated, npub, pubkey, mode, hasExtension, relays, connect, disconnect, authRequest } =
    useNostr();

  const { data, error, loading, reload } = useApi(() => authRequest('/me/dashboard'), [pubkey], { enabled: isConnected });

  if (isConnected && loading && !data) return <PageLoading label="Signing in to your dashboard…" />;
  if (isConnected && error) return <PageError error={error} onRetry={reload} />;

  const author = data?.author;
  const myBooks = data?.books ?? [];
  const income = data?.income ?? [];
  const stats = data?.stats ?? { books: 0, chapters: 0, paidReaders: 0, subscribers: 0, satsEarned: 0, satsToday: 0, satsWeek: 0 };
  const weekly = data?.weekly ?? [];
  const displayName = author?.name && author.name !== 'Anonymous Author' ? author.name.split(' ')[0] : 'author';

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Author dashboard</p>
          <h1 className="mt-3 font-display text-4xl text-cream sm:text-5xl">{isConnected ? `Welcome back, ${displayName}` : 'Your author workspace'}</h1>
          <p className="mt-2 text-sm text-cream-muted">Manage your catalogue, watch the sats arrive, and keep your identity healthy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/create-chapter" className="btn-secondary">
            <Layers className="h-4 w-4" /> New chapter
          </Link>
          <Link to="/create-book" className="btn-primary">
            <PlusCircle className="h-4 w-4" /> New book
          </Link>
        </div>
      </header>

      {(!isConnected || isSimulated) && (
        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-medium text-cream">
                {isConnected ? 'You’re using a simulated identity' : 'Connect a Nostr signer to publish'}
              </p>
              <p className="mt-1 text-sm text-cream-muted">
                {isConnected
                  ? 'Books you create are saved under the shared demo key.'
                  : 'Your dashboard is tied to your Nostr public key.'}{' '}
                Install a NIP-07 extension (Alby, nos2x) to sign real events — we will never ask for your private key.
              </p>
            </div>
          </div>
          {!isConnected && (
            <button type="button" onClick={connect} disabled={isConnecting} className="btn-primary btn-sm shrink-0">
              {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} Connect
            </button>
          )}
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <nav aria-label="Dashboard" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {TABS.map(({ id, label, icon: Icon, to }) => {
              const active = tab === id;
              const className = `flex w-full shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition ${
                active ? 'bg-btc/10 text-btc' : 'text-cream-muted hover:bg-white/[0.04] hover:text-cream'
              }`;
              return (
                <li key={id} className="shrink-0">
                  {to ? (
                    <Link to={to} className={className}>
                      <Icon className="h-4 w-4" /> {label}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setParams(id === 'overview' ? {} : { tab: id })} className={className} aria-current={active ? 'page' : undefined}>
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Panels */}
        <div key={tab} className="min-w-0 animate-fade-in space-y-8">
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <KpiCard icon={BookOpen} label="Published Books" value={stats.books} />
                <KpiCard icon={Layers} label="Total Chapters" value={stats.chapters} />
                <KpiCard
                  icon={Users}
                  label="Paid Readers"
                  value={formatNumber(stats.paidReaders)}
                  hint={stats.subscribers ? `${formatNumber(stats.subscribers)} monthly subscribers` : undefined}
                />
                <KpiCard
                  icon={Zap}
                  label="Sats Earned"
                  value={formatSats(stats.satsEarned)}
                  hint={stats.satsToday ? `+${formatSats(stats.satsToday)} today` : undefined}
                />
              </div>

              <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
                <section className="min-w-0">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-2xl text-cream">Recent Publications</h2>
                    <button type="button" onClick={() => setParams({ tab: 'books' })} className="text-xs text-btc hover:text-btc-hover">
                      View all
                    </button>
                  </div>
                  <PublicationsTable books={myBooks} />
                </section>

                <section className="card p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl text-cream">Recent Income</h2>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                  </div>
                  <IncomeFeed entries={income} limit={6} />
                  <button type="button" onClick={() => setParams({ tab: 'earnings' })} className="btn-ghost btn-sm mt-2 w-full">
                    Full earnings log
                  </button>
                </section>
              </div>
            </>
          )}

          {tab === 'books' && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl text-cream">My Books</h2>
                <Link to="/create-book" className="btn-primary btn-sm">
                  <PlusCircle className="h-3.5 w-3.5" /> New book
                </Link>
              </div>
              <PublicationsTable books={myBooks} />
            </section>
          )}

          {tab === 'earnings' && (
            <>
              <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                <KpiCard icon={Wallet} label="Lifetime" value={formatSats(stats.satsEarned)} />
                <KpiCard icon={TrendingUp} label="Last 7 days" value={formatSats(stats.satsWeek)} />
                <KpiCard icon={Zap} label="Last 24 hours" value={formatSats(stats.satsToday)} />
              </div>
              {weekly.length > 0 && (
                <section className="card p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="font-display text-xl text-cream">Sats per day</h2>
                    <span className="text-xs text-cream-faint">Last 7 days</span>
                  </div>
                  <WeeklyChart days={weekly} />
                </section>
              )}
              <section className="card p-6">
                <h2 className="font-display text-xl text-cream">Income log</h2>
                <p className="mt-1 text-xs text-cream-faint">
                  {author?.lightningAddress
                    ? `Lightning payments settle directly to ${author.lightningAddress}; M-Pesa payments are shown in KES at the rate paid.`
                    : 'Lightning payments settle directly to the author’s wallet; M-Pesa payments are shown in KES at the rate paid.'}
                </p>
                <IncomeFeed entries={income} />
              </section>
            </>
          )}

          {tab === 'identity' && (
            <section className="card space-y-6 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-cream">Nostr Identity</h2>
                  <p className="mt-1 text-sm text-cream-muted">Your public identity. The private key stays in your signer — always.</p>
                </div>
                <span className={isConnected ? (isSimulated ? 'badge border-amber-400/30 bg-amber-400/10 text-amber-300' : 'badge-free') : 'badge-neutral'}>
                  {isConnected ? (isSimulated ? 'Simulated' : 'NIP-07') : 'Not connected'}
                </span>
              </div>

              {isConnected ? (
                <dl className="space-y-3">
                  {[
                    { label: 'npub', value: npub },
                    { label: 'Hex public key', value: pubkey },
                  ].map((row) => (
                    <div key={row.label} className="rounded-xl border border-line bg-ink/60 p-4">
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-cream-faint">{row.label}</dt>
                      <dd className="mt-1.5 flex items-center justify-between gap-3">
                        <code className="min-w-0 break-all font-mono text-xs text-cream-muted">{row.value}</code>
                        <CopyButton value={row.value} label={`Copy ${row.label}`} successMessage={`${row.label} copied`} />
                      </dd>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Link to={`/author/${npub}`} className="btn-secondary btn-sm">
                      View public profile
                    </Link>
                    <button type="button" onClick={disconnect} className="btn-danger btn-sm">
                      <LogOut className="h-3.5 w-3.5" /> Disconnect
                    </button>
                  </div>
                </dl>
              ) : (
                <div className="rounded-xl border border-line bg-ink/60 p-5">
                  <p className="text-sm text-cream-muted">
                    {hasExtension ? 'A NIP-07 signer was detected in your browser.' : 'No NIP-07 signer detected — a demo identity will be used.'}
                  </p>
                  <button type="button" onClick={connect} disabled={isConnecting} className="btn-primary btn-sm mt-4">
                    <KeyRound className="h-3.5 w-3.5" /> Connect Nostr
                  </button>
                </div>
              )}

              <div className="flex gap-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.05] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
                <p className="text-sm leading-relaxed text-cream-muted">
                  <span className="font-medium text-cream">Never share your nsec.</span> Sauti will never ask for
                  your private key. Anyone requesting it — in a form, a DM, or a "support" chat — is trying to steal your identity.
                </p>
              </div>

              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-cream">
                  <Radio className="h-4 w-4 text-btc" /> Publishing relays
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {relays.map((relay) => (
                    <li key={relay.url} className="flex items-center gap-2 rounded-lg border border-line bg-ink/50 px-3 py-2 font-mono text-xs text-cream-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {relay.url}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-cream-faint">
                  Signer: {mode === 'nip07' ? 'Browser extension (NIP-07)' : mode === 'simulated' ? 'Simulated (demo)' : '—'} ·{' '}
                  {shortenKey(npub || '')}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
