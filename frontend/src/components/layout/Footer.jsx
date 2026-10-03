import { Link } from 'react-router-dom';
import { ShieldCheck, Zap } from 'lucide-react';
import Logo from '../common/Logo';

const COLUMNS = [
  {
    title: 'Read',
    links: [
      { to: '/explore', label: 'Explore books' },
      { to: '/explore?category=Fiction', label: 'Fiction' },
      { to: '/explore?category=Feminism', label: 'Feminism' },
      { to: '/explore?category=Poetry', label: 'Poetry' },
      { to: '/explore?category=Technology', label: 'Technology' },
    ],
  },
  {
    title: 'Publish',
    links: [
      { to: '/create-book', label: 'New book' },
      { to: '/create-chapter', label: 'New chapter' },
      { to: '/dashboard', label: 'Author dashboard' },
    ],
  },
  {
    title: 'Network',
    links: [
      { to: '/about', label: 'Manifesto' },
      { to: '/about#limitations', label: 'Limitations' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line/80 bg-ink-deep">
      <div className="container-wide grid gap-12 py-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream-muted">
            A home for independent voices. Write under any name, keep the rights to every word, and get
            paid directly — M-Pesa or Lightning.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="badge-nostr">
              <ShieldCheck className="h-3 w-3" /> We never ask for your nsec
            </span>
            <span className="badge-btc">
              <Zap className="h-3 w-3" /> Lightning-native
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream-faint">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-cream-muted transition hover:text-btc">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line/60">
        <div className="container-wide flex flex-col gap-2 py-6 text-xs text-cream-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Sauti · Your voice. Your story. Your freedom.</p>
          <p className="font-mono">Signed with Nostr · Paid in sats or shillings</p>
        </div>
      </div>
    </footer>
  );
}
