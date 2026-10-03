import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Info, KeyRound, Loader2, Radio, ShieldCheck, X } from 'lucide-react';
import BookCover from '../components/common/BookCover';
import { PageError, PageLoading } from '../components/common/PageStatus';
import { useApi } from '../hooks/useApi';
import { useNostr } from '../hooks/useNostr';
import { useFlash } from '../hooks/useFlash';
import { CATEGORIES, LANGUAGES } from '../data/catalogue';
import { api } from '../utils/api';
import { KIND_LONG_FORM } from '../utils/nostr';

const EMPTY_FORM = {
  title: '',
  subtitle: '',
  category: 'Fiction',
  language: 'English',
  description: '',
  coverUrl: '',
  tags: '',
  publishToNostr: true,
};

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const parseTags = (raw) =>
  [...new Set(raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8);

function validate(form) {
  const errors = {};
  if (form.title.trim().length < 2) errors.title = 'Give your book a title (at least 2 characters).';
  if (form.description.trim().length < 40) errors.description = 'Write at least 40 characters so readers know what to expect.';
  if (form.coverUrl && !/^https?:\/\/\S+$/i.test(form.coverUrl.trim())) errors.coverUrl = 'Use a full http(s):// image URL.';
  return errors;
}

export default function CreateBookPage() {
  const navigate = useNavigate();
  const flash = useFlash();
  const { isConnected, isSimulated, pubkey, connect, isConnecting, signAndPublish, authRequest } = useNostr();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const editQuery = useApi((signal) => api.getBook(editId, { signal }), [editId], { enabled: Boolean(editId) });
  const editing = editQuery.data?.book ?? null;
  const ownsEditing = !editing || editing.author.pubkey === pubkey;

  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Populate the form once the book being edited arrives.
  useEffect(() => {
    if (!editing) return;
    setForm({
      ...EMPTY_FORM,
      title: editing.title,
      subtitle: editing.subtitle || '',
      category: editing.category,
      language: editing.language,
      description: editing.description,
      coverUrl: editing.coverUrl || '',
      tags: editing.tags.join(', '),
    });
  }, [editing]);

  const errors = { ...validate(form), ...serverErrors };
  const tags = parseTags(form.tags);

  const previewBook = useMemo(
    () => ({
      id: 'preview',
      title: form.title || 'Your title here',
      category: form.category,
      author: { name: editing?.author.name || 'You' },
      coverUrl: form.coverUrl.trim() || null,
      cover: editing?.cover || { from: '#3A2414', to: '#0F1012', accent: '#F7931A', motif: 'sun' },
    }),
    [form.title, form.category, form.coverUrl, editing],
  );

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setServerErrors(({ [field]: _cleared, ...rest }) => rest);
  };
  const blur = (field) => () => setTouched((t) => ({ ...t, [field]: true }));
  const showError = (field) => touched[field] && errors[field];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ title: true, description: true, coverUrl: true });
    if (Object.keys(errors).length) {
      flash.error('Please fix the highlighted fields before publishing.', { title: 'Almost there' });
      return;
    }

    if (!isConnected) {
      flash.warning('Books are owned by a Nostr key. Connect a signer first — we never ask for your private key.', {
        title: 'Connect to publish',
      });
      return;
    }

    setSubmitting(true);
    try {
      let nostrEventId;
      if (form.publishToNostr) {
        // NIP-23 parameterized replaceable event: metadata only, no paid content.
        const { event, accepted, results } = await signAndPublish({
          kind: KIND_LONG_FORM,
          content: form.description.trim(),
          tags: [
            ['d', editing?.id || slugify(form.title)],
            ['title', form.title.trim()],
            ['summary', form.subtitle.trim()],
            ...(form.coverUrl ? [['image', form.coverUrl.trim()]] : []),
            ['L', 'sauti'],
            ['l', form.category.toLowerCase(), 'sauti'],
            ['language', form.language],
            ...tags.map((t) => ['t', t]),
          ],
        });
        flash.info(
          isSimulated ? `Simulated broadcast to ${accepted} relays.` : `Accepted by ${accepted} of ${results.length} relays.`,
          { title: 'Metadata signed on Nostr' },
        );
        nostrEventId = event.id;
      }

      const body = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        category: form.category,
        language: form.language,
        description: form.description.trim(),
        coverUrl: form.coverUrl.trim(),
        tags,
        nostrEventId,
      };
      const { book } = editing
        ? await authRequest(`/books/${encodeURIComponent(editing.id)}`, { method: 'PUT', body })
        : await authRequest('/books', { method: 'POST', body });

      flash.success(`“${book.title}” ${editing ? 'was updated' : 'is ready for its first chapter'}.`, {
        title: editing ? 'Book updated' : 'Book created',
      });
      navigate(editing ? '/dashboard?tab=books' : `/create-chapter?book=${encodeURIComponent(book.id)}`);
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

  if (editId && editQuery.loading) return <PageLoading label="Loading book…" />;
  if (editId && editQuery.error) return <PageError error={editQuery.error} onRetry={editQuery.reload} />;

  return (
    <div className="container-page py-10 sm:py-14">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-cream-muted transition hover:text-btc">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mt-6 max-w-2xl">
        <p className="eyebrow">{editing ? 'Edit book' : 'New book'}</p>
        <h1 className="mt-3 font-display text-4xl text-cream sm:text-5xl">{editing ? `Editing “${editing.title}”` : 'Start a new book'}</h1>
        <p className="mt-3 text-cream-muted">Describe your book. You’ll add chapters — free or paid — once it exists.</p>
      </header>

      {!ownsEditing && (
        <div className="mt-6 flex max-w-2xl gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-sm text-cream-muted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          This book is signed by {editing.author.name}. Only their key can save changes to it.
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-14">
        <form onSubmit={handleSubmit} noValidate className="card space-y-6 p-5 sm:p-8">
          <div>
            <label htmlFor="title" className="label">
              Title *
            </label>
            <input
              id="title"
              value={form.title}
              onChange={update('title')}
              onBlur={blur('title')}
              placeholder="The Salt Roads"
              className={`input font-display text-lg ${showError('title') ? 'input-error' : ''}`}
              aria-invalid={Boolean(showError('title'))}
              aria-describedby="title-error"
            />
            {showError('title') && (
              <p id="title-error" className="mt-2 text-xs text-red-300">
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="subtitle" className="label">
              Subtitle
            </label>
            <input id="subtitle" value={form.subtitle} onChange={update('subtitle')} placeholder="A novel of caravans and inheritance" className="input" />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="label">
                Category
              </label>
              <select id="category" value={form.category} onChange={update('category')} className="input appearance-none">
                {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="language" className="label">
                Language
              </label>
              <select id="language" value={form.language} onChange={update('language')} className="input appearance-none">
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="description" className="label">
                Description *
              </label>
              <span className="text-[11px] text-cream-faint">{form.description.length}/1200</span>
            </div>
            <textarea
              id="description"
              rows={6}
              maxLength={1200}
              value={form.description}
              onChange={update('description')}
              onBlur={blur('description')}
              placeholder="What is this book about? Who is it for?"
              className={`input resize-y font-serif text-base leading-relaxed ${showError('description') ? 'input-error' : ''}`}
              aria-invalid={Boolean(showError('description'))}
            />
            {showError('description') && <p className="mt-2 text-xs text-red-300">{errors.description}</p>}
          </div>

          <div>
            <label htmlFor="coverUrl" className="label">
              Cover image URL
            </label>
            <input
              id="coverUrl"
              type="url"
              inputMode="url"
              value={form.coverUrl}
              onChange={update('coverUrl')}
              onBlur={blur('coverUrl')}
              placeholder="https://…/cover.jpg"
              className={`input font-mono text-sm ${showError('coverUrl') ? 'input-error' : ''}`}
            />
            {showError('coverUrl') ? (
              <p className="mt-2 text-xs text-red-300">{errors.coverUrl}</p>
            ) : (
              <p className="help">Leave blank to use a generated typographic cover. 2:3 ratio works best.</p>
            )}
          </div>

          <div>
            <label htmlFor="tags" className="label">
              Tags
            </label>
            <input id="tags" value={form.tags} onChange={update('tags')} placeholder="literary fiction, sahel, family saga" className="input" />
            <p className="help">Comma-separated, up to 8. Published as Nostr “t” tags for discovery.</p>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="badge-neutral">
                    #{tag}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, tags: parseTags(f.tags).filter((t) => t !== tag).join(', ') }))}
                      className="-mr-1 ml-0.5 rounded-full p-0.5 hover:text-cream"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Nostr publish option */}
          <label className="flex cursor-pointer gap-4 rounded-2xl border border-line bg-ink/50 p-4 transition hover:border-violet-400/40 has-[:checked]:border-violet-400/40 has-[:checked]:bg-violet-400/[0.05]">
            <input
              type="checkbox"
              checked={form.publishToNostr}
              onChange={update('publishToNostr')}
              className="mt-1 h-4 w-4 shrink-0 accent-[#F7931A]"
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-cream">
                <Radio className="h-4 w-4 text-violet-300" /> Publish metadata to Nostr
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-cream-muted">
                Signs the title, description, category, cover and tags with your key as a NIP-23 event and broadcasts it to
                your relays. This makes your book discoverable in any Nostr client and proves you are its author.
              </span>
            </span>
          </label>

          {!isConnected && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex gap-2 text-xs leading-relaxed text-cream-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /> Connect a signer to prove you’re the author. We’ll
                never ask for your private key.
              </p>
              <button type="button" onClick={connect} disabled={isConnecting} className="btn-secondary btn-sm shrink-0">
                <KeyRound className="h-3.5 w-3.5 text-btc" /> Connect
              </button>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
            <Link to="/dashboard" className="btn-ghost">
              Cancel
            </Link>
            <button type="submit" disabled={submitting || !ownsEditing} className="btn-primary disabled:opacity-50">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Signing…' : editing ? 'Save changes' : 'Create book'}
            </button>
          </div>
        </form>

        {/* Live preview */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <p className="label">Live preview</p>
          <div className="mx-auto w-56 lg:w-full">
            <BookCover key={previewBook.coverUrl || 'generated'} book={previewBook} size="lg" />
          </div>
          <div className="panel flex gap-3 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-violet-300" />
            <p className="text-xs leading-relaxed text-cream-muted">
              Only public metadata is signed here. Your private key never leaves your signer and is never requested by this
              site.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
