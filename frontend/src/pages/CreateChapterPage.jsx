import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Info, KeyRound, Library, Loader2, Lock, Radio, ShieldCheck, Zap } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import { PageError, PageLoading } from '../components/common/PageStatus';
import { useApi } from '../hooks/useApi';
import { useNostr } from '../hooks/useNostr';
import { useFlash } from '../hooks/useFlash';
import { formatSats } from '../utils/lightning';
import { KIND_LONG_FORM } from '../utils/nostr';

const SUGGESTED_PRICES = [100, 210, 500, 1000];

function validate(form) {
  const errors = {};
  if (!form.bookId) errors.bookId = 'Choose which book this chapter belongs to.';
  if (!Number.isInteger(Number(form.number)) || Number(form.number) < 1) errors.number = 'Chapter number must be 1 or more.';
  if (form.title.trim().length < 2) errors.title = 'Give the chapter a title.';
  if (form.content.trim().split(/\s+/).filter(Boolean).length < 20) errors.content = 'Write at least 20 words.';
  if (form.access === 'paid') {
    const price = Number(form.priceSats);
    if (!Number.isInteger(price) || price < 1) errors.priceSats = 'Enter a whole number of sats (minimum 1).';
    else if (price > 1_000_000) errors.priceSats = 'That’s over 1M sats — readers may hesitate.';
  }
  return errors;
}

export default function CreateChapterPage() {
  const navigate = useNavigate();
  const flash = useFlash();
  const [params] = useSearchParams();
  const { pubkey, isConnected, isSimulated, connect, isConnecting, signAndPublish, authRequest } = useNostr();

  const dashboard = useApi(() => authRequest('/me/dashboard'), [pubkey], { enabled: isConnected });
  const myBooks = dashboard.data?.books ?? [];
  const findBook = (id) => myBooks.find((b) => b.id === id);
  const nextNumber = (book) => Math.max(0, ...(book?.chapters ?? []).map((c) => c.number)) + 1;

  const [form, setForm] = useState({
    bookId: '',
    number: 1,
    title: '',
    content: '',
    access: 'free',
    priceSats: 210,
    publishToNostr: true,
  });
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Once the author's books load, preselect ?book= (or the first book).
  useEffect(() => {
    const books = dashboard.data?.books;
    if (!books?.length) return;
    const initial = books.find((b) => b.id === params.get('book')) || books[0];
    setForm((f) => (f.bookId ? f : { ...f, bookId: initial.id, number: nextNumber(initial) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard.data]);

  const errors = { ...validate(form), ...serverErrors };
  const showError = (field) => touched[field] && errors[field];
  const wordCount = form.content.trim().split(/\s+/).filter(Boolean).length;

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => {
      const next = { ...current, [field]: value };
      // Suggest the next chapter number when switching books.
      if (field === 'bookId') next.number = nextNumber(findBook(value));
      return next;
    });
    setServerErrors(({ [field]: _cleared, ...rest }) => rest);
  };
  const blur = (field) => () => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ bookId: true, number: true, title: true, content: true, priceSats: true });
    if (Object.keys(errors).length) {
      flash.error('Please fix the highlighted fields.', { title: 'Chapter not saved' });
      return;
    }

    if (!isConnected) {
      flash.warning('Chapters are signed by their author’s key. Connect a signer first.', { title: 'Connect to publish' });
      return;
    }

    setSubmitting(true);
    const isPaid = form.access === 'paid';
    try {
      let nostrEventId;
      if (form.publishToNostr) {
        // Public metadata only. For paid chapters the body is NOT included in the event.
        const { event, accepted } = await signAndPublish({
          kind: KIND_LONG_FORM,
          content: isPaid ? '' : form.content.trim(),
          tags: [
            ['d', `${form.bookId}:ch-${form.number}`],
            ['title', form.title.trim()],
            ['a', `${KIND_LONG_FORM}:${pubkey}:${form.bookId}`],
            ['chapter', String(form.number)],
            ['access', isPaid ? 'paid' : 'free'],
            ...(isPaid ? [['price', String(form.priceSats), 'sats']] : []),
            ['L', 'sauti'],
          ],
        });
        flash.info(`${isSimulated ? 'Simulated broadcast' : 'Broadcast'} to ${accepted} relays.`, { title: 'Chapter metadata signed' });
        nostrEventId = event.id;
      }

      // The full text (including paid text) goes only to our server, which
      // releases it to readers after their Lightning payment settles.
      const { chapter } = await authRequest(`/books/${encodeURIComponent(form.bookId)}/chapters`, {
        method: 'POST',
        body: {
          number: Number(form.number),
          title: form.title.trim(),
          content: form.content,
          access: form.access,
          priceSats: isPaid ? Number(form.priceSats) : 0,
          nostrEventId,
        },
      });

      flash.success(
        chapter.isFree ? 'It’s free for every reader.' : `Readers can unlock it for ${formatSats(chapter.priceSats)} sats.`,
        { title: `Chapter ${chapter.number} “${chapter.title}” published` },
      );
      navigate(`/book/${encodeURIComponent(form.bookId)}`);
    } catch (error) {
      if (error?.details) {
        setServerErrors(error.details);
        setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(error.details).map((k) => [k, true])) }));
      }
      flash.error(error?.message || 'Signing was cancelled.', { title: 'Could not publish' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container-page py-24">
        <EmptyState
          icon={KeyRound}
          title="Connect to write a chapter"
          description="Chapters belong to books signed by your Nostr key. Connect a NIP-07 signer (or the demo identity) to continue. We never ask for your private key."
          actionLabel={isConnecting ? 'Connecting…' : 'Connect Nostr'}
          onAction={connect}
        />
      </div>
    );
  }
  if (dashboard.loading && !dashboard.data) return <PageLoading label="Loading your books…" />;
  if (dashboard.error) return <PageError error={dashboard.error} onRetry={dashboard.reload} />;
  if (myBooks.length === 0) {
    return (
      <div className="container-page py-24">
        <EmptyState
          icon={Library}
          title="Create a book first"
          description="Every chapter belongs to a book. Start one, then come back to write its first chapter."
          actionLabel="Create a book"
          actionTo="/create-book"
        />
      </div>
    );
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-cream-muted transition hover:text-btc">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mt-6 max-w-2xl">
        <p className="eyebrow">New chapter</p>
        <h1 className="mt-3 font-display text-4xl text-cream sm:text-5xl">Write a chapter</h1>
        <p className="mt-3 text-cream-muted">Give some chapters away to build an audience. Price the rest in sats.</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-12">
        <div className="card space-y-6 p-5 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[1fr_140px]">
            <div>
              <label htmlFor="bookId" className="label">
                Book
              </label>
              <select id="bookId" value={form.bookId} onChange={update('bookId')} onBlur={blur('bookId')} className="input appearance-none">
                {myBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
              {showError('bookId') && <p className="mt-2 text-xs text-red-300">{errors.bookId}</p>}
            </div>
            <div>
              <label htmlFor="number" className="label">
                Chapter no.
              </label>
              <input
                id="number"
                type="number"
                min={1}
                inputMode="numeric"
                value={form.number}
                onChange={update('number')}
                onBlur={blur('number')}
                className={`input font-mono ${showError('number') ? 'input-error' : ''}`}
              />
              {showError('number') && <p className="mt-2 text-xs text-red-300">{errors.number}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="ch-title" className="label">
              Title *
            </label>
            <input
              id="ch-title"
              value={form.title}
              onChange={update('title')}
              onBlur={blur('title')}
              placeholder="Agadez, Before Dawn"
              className={`input font-display text-lg ${showError('title') ? 'input-error' : ''}`}
            />
            {showError('title') && <p className="mt-2 text-xs text-red-300">{errors.title}</p>}
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="content" className="label">
                Content *
              </label>
              <span className="text-[11px] text-cream-faint">
                {wordCount.toLocaleString()} words · ~{Math.max(1, Math.round(wordCount / 230))} min read
              </span>
            </div>
            <textarea
              id="content"
              rows={16}
              value={form.content}
              onChange={update('content')}
              onBlur={blur('content')}
              placeholder="The salt came out of the earth in slabs the colour of old teeth…"
              className={`input min-h-[320px] resize-y font-serif text-[17px] leading-[1.8] ${showError('content') ? 'input-error' : ''}`}
            />
            {showError('content') ? (
              <p className="mt-2 text-xs text-red-300">{errors.content}</p>
            ) : (
              <p className="help">Separate paragraphs with a blank line.</p>
            )}
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {/* Access option */}
          <div className="card p-5">
            <p className="label">Access</p>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-ink p-1.5" role="radiogroup" aria-label="Chapter access">
              {[
                { id: 'free', label: 'Free Chapter', icon: BookOpen },
                { id: 'paid', label: 'Paid Chapter', icon: Zap },
              ].map(({ id, label, icon: Icon }) => {
                const active = form.access === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setForm((f) => ({ ...f, access: id }))}
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-3.5 text-xs font-medium transition active:scale-[0.98] ${
                      active ? (id === 'paid' ? 'bg-btc text-ink shadow-glow' : 'bg-card text-cream shadow') : 'text-cream-faint hover:text-cream'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                );
              })}
            </div>

            {/* Price reveal */}
            <div
              className={`grid transition-all duration-300 ease-out ${
                form.access === 'paid' ? 'mt-5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
              aria-hidden={form.access !== 'paid'}
            >
              <div className="overflow-hidden">
                <label htmlFor="priceSats" className="label">
                  Price (price_sats)
                </label>
                <div className="relative">
                  <Zap className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-btc" />
                  <input
                    id="priceSats"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    tabIndex={form.access === 'paid' ? 0 : -1}
                    value={form.priceSats}
                    onChange={update('priceSats')}
                    onBlur={blur('priceSats')}
                    className={`input pl-11 pr-16 font-mono text-lg ${showError('priceSats') ? 'input-error' : ''}`}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.14em] text-cream-faint">
                    sats
                  </span>
                </div>
                {showError('priceSats') && <p className="mt-2 text-xs text-red-300">{errors.priceSats}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SUGGESTED_PRICES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      tabIndex={form.access === 'paid' ? 0 : -1}
                      onClick={() => setForm((f) => ({ ...f, priceSats: p }))}
                      className={`rounded-full border px-3 py-1 font-mono text-xs transition ${
                        Number(form.priceSats) === p ? 'border-btc bg-btc/15 text-btc' : 'border-line text-cream-muted hover:border-btc/50'
                      }`}
                    >
                      {formatSats(p)}
                    </button>
                  ))}
                </div>
                <p className="help">A few hundred sats is roughly the price of a newspaper.</p>
              </div>
            </div>
          </div>

          {/* Nostr publish option */}
          <div className="card p-5">
            <label className="flex cursor-pointer gap-3">
              <input
                type="checkbox"
                checked={form.publishToNostr}
                onChange={update('publishToNostr')}
                className="mt-1 h-4 w-4 shrink-0 accent-[#F7931A]"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium text-cream">
                  <Radio className="h-4 w-4 text-violet-300" /> Publish public metadata to Nostr
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-cream-muted">
                  Title, chapter number and price are signed and broadcast so readers can find this chapter.
                </span>
              </span>
            </label>

            {form.access === 'paid' && (
              <div className="mt-4 flex gap-2.5 rounded-xl border border-btc/20 bg-btc/[0.05] p-3.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-btc" />
                <p className="text-xs leading-relaxed text-cream-muted">
                  <span className="font-medium text-cream">Paid text remains protected.</span> The chapter body is never
                  included in the public Nostr event — it’s only delivered after a reader’s Lightning payment settles.
                </p>
              </div>
            )}

            {!isConnected && (
              <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5">
                <p className="flex gap-2 text-xs leading-relaxed text-cream-muted">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /> Connect a signer to prove you’re the author.
                </p>
                <button type="button" onClick={connect} disabled={isConnecting} className="btn-secondary btn-sm mt-3 w-full">
                  <KeyRound className="h-3.5 w-3.5 text-btc" /> Connect Nostr
                </button>
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary btn-lg w-full">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Signing…' : 'Publish chapter'}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-cream-faint">
            <ShieldCheck className="h-3.5 w-3.5" /> Your nsec is never requested
          </p>
        </aside>
      </form>
    </div>
  );
}
