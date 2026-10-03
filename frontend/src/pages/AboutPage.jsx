import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Copyright, KeyRound, Radio, Route, ShieldAlert, Zap } from 'lucide-react';

const HOW_IT_WORKS = [
  {
    icon: KeyRound,
    title: 'Identity is a key, not an account',
    body: 'Authors sign in with a Nostr key pair through a browser signer. Their public key (npub) is their pen name’s permanent, verifiable address.',
  },
  {
    icon: Radio,
    title: 'Metadata lives on open relays',
    body: 'Book and chapter metadata is published as signed NIP-23 events to many independent relays. Any Nostr client can find and verify it.',
  },
  {
    icon: Zap,
    title: 'Payments settle over Lightning',
    body: 'Readers pay per chapter with a Lightning invoice. Sats route directly to the author’s wallet — typically in under a second, for fractions of a cent in fees.',
  },
];

const LIMITATIONS = [
  {
    icon: Radio,
    title: 'Relay persistence is not guaranteed',
    body: 'Relays are run by independent operators who may prune old events, go offline, or shut down. We publish to several relays for redundancy, but authors should keep their own backups and ideally run or pay for a relay.',
  },
  {
    icon: Route,
    title: 'Lightning routing fees and failures',
    body: 'Most payments cost a few sats or less to route, but fees vary and a payment can occasionally fail to find a path. Failed payments never debit the reader; they can simply retry.',
  },
  {
    icon: ShieldAlert,
    title: 'Paywalls don’t prevent piracy',
    body: 'Once a paying reader can see a chapter, they can copy it. Micropayments make paying easier than pirating, but no technology — including ours — makes copying impossible.',
  },
  {
    icon: Copyright,
    title: 'Signatures are not copyright',
    body: 'A Nostr signature proves which key published a work and when. It is not a copyright registration and does not by itself establish legal ownership. Copyright still arises under the law of your jurisdiction.',
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Header */}
      <section className="relative overflow-hidden border-b border-line/70">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-btc/10 blur-[120px]" />
        <div className="container-page relative max-w-4xl py-20 text-center sm:py-28">
          <p className="eyebrow">Manifesto</p>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] text-cream text-balance sm:text-6xl">
            Writers should not need permission <span className="italic text-btc">to be read.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl font-serif text-xl leading-relaxed text-cream-muted">
            Sauti means “voice” in Swahili. It is an experiment in giving authors the two things platforms have always
            rented back to them: their identity and their income.
          </p>
        </div>
      </section>

      <div className="container-page max-w-4xl py-16 sm:py-24">
        {/* The Problem */}
        <section className="grid gap-6 md:grid-cols-[180px_1fr] md:gap-12">
          <h2 className="font-display text-sm uppercase tracking-[0.2em] text-btc md:pt-2">I. The Problem</h2>
          <div className="prose-reading space-y-5">
            <p className="drop-cap">
              Independent authors today publish on borrowed ground. Their audience lives in a company’s database, their
              reach depends on an algorithm they can’t inspect, and their earnings arrive weeks later, minus a cut they
              didn’t negotiate.
            </p>
            <p>
              An account can be suspended, a book delisted, a payout frozen — often without explanation and rarely with
              appeal. For writers working on politically sensitive subjects, or in countries with fragile banking, that
              dependency is not an inconvenience. It is a ceiling.
            </p>
          </div>
        </section>

        <div className="hairline my-16" />

        {/* Mission */}
        <section className="grid gap-6 md:grid-cols-[180px_1fr] md:gap-12">
          <h2 className="font-display text-sm uppercase tracking-[0.2em] text-btc md:pt-2">II. Our Mission</h2>
          <div>
            <blockquote className="border-l-2 border-btc pl-6 font-display text-2xl italic leading-snug text-cream sm:text-3xl">
              “Your voice. Your story. Your freedom.”
            </blockquote>
            <p className="prose-reading mt-8">
              We’re building a publishing tool where the author’s key is the account, the open network is the
              storefront, and every sat a reader spends goes straight to the person who wrote the words. No exclusivity,
              no lock-in: leave whenever you like and take everything with you.
            </p>
          </div>
        </section>

        <div className="hairline my-16" />

        {/* How it works */}
        <section className="grid gap-6 md:grid-cols-[180px_1fr] md:gap-12">
          <h2 className="font-display text-sm uppercase tracking-[0.2em] text-btc md:pt-2">III. How It Works</h2>
          <ol className="space-y-4">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="card flex gap-5 p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-btc/25 bg-btc/10 text-btc">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">Step {i + 1}</p>
                  <h3 className="mt-1 font-display text-xl text-cream">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Limitations */}
        <section id="limitations" className="mt-20 scroll-mt-24 rounded-3xl border border-amber-400/25 bg-amber-400/[0.04] p-6 sm:p-10">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow text-amber-300">Read before you publish</p>
              <h2 className="mt-2 font-display text-3xl text-cream">Platform Limitations</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream-muted">
                Decentralization trades some guarantees for others. We’d rather you hear these from us than discover them
                later.
              </p>
            </div>
          </div>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {LIMITATIONS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-2xl border border-line bg-ink/60 p-5">
                <Icon className="h-5 w-5 text-amber-300" />
                <h3 className="mt-3 text-[15px] font-semibold text-cream">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
          <Link to="/create-book" className="btn-primary btn-lg">
            Start publishing <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/explore" className="btn-secondary btn-lg">
            Explore books
          </Link>
        </div>
      </div>
    </div>
  );
}
