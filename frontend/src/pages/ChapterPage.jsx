import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, FlaskConical, Lock, Minus, Plus, Unlock } from 'lucide-react';
import ChapterContent from '../components/reader/ChapterContent';
import LockedChapterOverlay from '../components/reader/LockedChapterOverlay';
import EmptyState from '../components/common/EmptyState';
import { PageError, PageLoading } from '../components/common/PageStatus';
import { useApi } from '../hooks/useApi';
import { useLightning } from '../hooks/useLightning';
import { api } from '../utils/api';
import { toRoman } from '../utils/format';

const TEXT_SIZES = ['1.0625rem', '1.1875rem', '1.3125rem', '1.4375rem'];
const TEXT_SIZE_KEY = 'sp:reader-size';

/** Reading progress (0–100) based on window scroll. */
function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return progress;
}

/** Sticky demo switch to flip a paid chapter between locked and unlocked. */
function DemoToggle({ book, chapter, unlocked }) {
  const { unlockChapter, lockChapter } = useLightning();

  if (chapter.isFree) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
      <div className="flex items-center gap-3 rounded-full border border-btc/30 bg-surface/95 py-1.5 pl-4 pr-1.5 shadow-card backdrop-blur-xl">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-btc">
          <FlaskConical className="h-3.5 w-3.5" /> Demo
        </span>
        <div className="flex rounded-full bg-ink p-1" role="radiogroup" aria-label="Chapter access state">
          <button
            type="button"
            role="radio"
            aria-checked={!unlocked}
            onClick={() => lockChapter(book.id, chapter.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              !unlocked ? 'bg-card text-cream shadow' : 'text-cream-faint hover:text-cream'
            }`}
          >
            <Lock className="h-3 w-3" /> Locked
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={unlocked}
            onClick={() => unlockChapter(book.id, chapter.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              unlocked ? 'bg-btc text-ink' : 'text-cream-faint hover:text-cream'
            }`}
          >
            <Unlock className="h-3 w-3" /> Unlocked
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChapterPage() {
  const { id, chapterId } = useParams();
  const { isUnlocked, openPayment, openSubscription, entitlementKey } = useLightning();
  const progress = useScrollProgress();
  const [sizeIndex, setSizeIndex] = useState(() => Number(localStorage.getItem(TEXT_SIZE_KEY) ?? 1));

  useEffect(() => {
    localStorage.setItem(TEXT_SIZE_KEY, String(sizeIndex));
  }, [sizeIndex]);

  // Re-fetch when this browser gains or loses access (a chapter unlock or an
  // author subscription), so the server sends the full text or only the preview.
  const { data, error, loading, reload } = useApi(
    (signal) => api.getChapter(id, chapterId, { signal }),
    [id, chapterId, entitlementKey],
  );

  const stale = data && (data.book.id !== id || data.chapter.id !== chapterId);
  if (loading && (!data || stale)) return <PageLoading label="Opening chapter…" />;
  if (error && error.status !== 404) return <PageError error={error} onRetry={reload} />;

  if (!data) {
    return (
      <div className="container-page py-24">
        <EmptyState
          title="Chapter not found"
          description="This chapter doesn’t exist or hasn’t been published yet."
          actionLabel="Back to book"
          actionTo={`/book/${id}`}
        />
      </div>
    );
  }

  const { book, chapter, paragraphs, unlocked } = data;
  const { author } = book;
  const index = book.chapters.findIndex((c) => c.id === chapter.id);
  const prev = book.chapters[index - 1];
  const next = book.chapters[index + 1];

  return (
    <div className="min-h-screen bg-ink">
      {/* -------------------------- Reader bar -------------------------- */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to={`/book/${book.id}`} className="inline-flex shrink-0 items-center gap-2 text-sm text-cream-muted transition hover:text-btc">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Book</span>
            <span className="sm:hidden">Back</span>
          </Link>

          <p className="min-w-0 truncate text-center font-display text-sm text-cream">
            {book.title}
            <span className="hidden text-cream-faint sm:inline">
              {' '}
              · {index + 1} of {book.chapters.length}
            </span>
          </p>

          <div className="flex shrink-0 items-center gap-0.5" aria-label="Text size">
            <button
              type="button"
              onClick={() => setSizeIndex((i) => Math.max(0, i - 1))}
              disabled={sizeIndex === 0}
              className="icon-btn h-9 w-9 disabled:opacity-30"
              aria-label="Decrease text size"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="font-display text-sm text-cream-faint" aria-hidden="true">
              Aa
            </span>
            <button
              type="button"
              onClick={() => setSizeIndex((i) => Math.min(TEXT_SIZES.length - 1, i + 1))}
              disabled={sizeIndex === TEXT_SIZES.length - 1}
              className="icon-btn h-9 w-9 disabled:opacity-30"
              aria-label="Increase text size"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-0.5 bg-btc transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </header>

      {/* ---------------------------- Content ---------------------------- */}
      <div className="mx-auto max-w-[680px] px-5 pb-36 pt-14 sm:px-6 sm:pt-20" style={{ '--reading-size': TEXT_SIZES[sizeIndex] }}>
        <header className="mb-14 text-center">
          <p className="eyebrow">Chapter {toRoman(chapter.number)}</p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-cream text-balance sm:text-5xl">{chapter.title}</h1>
          <p className="mt-5 text-sm text-cream-faint">
            {author.name} · <Clock className="-mt-0.5 inline h-3.5 w-3.5" /> {chapter.readingMinutes} min read
          </p>
          <div className="mx-auto mt-8 h-px w-16 bg-btc/60" />
        </header>

        {unlocked ? (
          <div key="unlocked" className="animate-fade-in">
            <ChapterContent paragraphs={paragraphs} format={book.format} />
          </div>
        ) : (
          <LockedChapterOverlay
            key="locked"
            chapter={chapter}
            author={author}
            paragraphs={paragraphs}
            format={book.format}
            onUnlock={() => openPayment(book, chapter)}
            onSubscribe={() => openSubscription(author, { book, chapter })}
          />
        )}

        {/* Prev / next navigation */}
        <nav className="mt-16 grid gap-3 border-t border-line pt-8 sm:grid-cols-2" aria-label="Chapter navigation">
          {prev ? (
            <Link to={`/book/${book.id}/chapter/${prev.id}`} className="panel group p-4 transition hover:border-btc/40">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-cream-faint">
                <ArrowLeft className="h-3 w-3" /> Previous
              </span>
              <span className="mt-1.5 block font-display text-cream transition group-hover:text-btc">{prev.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && (
            <Link to={`/book/${book.id}/chapter/${next.id}`} className="panel group p-4 text-right transition hover:border-btc/40">
              <span className="flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-[0.16em] text-cream-faint">
                Next <ArrowRight className="h-3 w-3" />
                {!isUnlocked(book, next) && <Lock className="h-3 w-3 text-btc" />}
              </span>
              <span className="mt-1.5 block font-display text-cream transition group-hover:text-btc">{next.title}</span>
            </Link>
          )}
        </nav>
      </div>

      <DemoToggle book={book} chapter={chapter} unlocked={unlocked} />
    </div>
  );
}
