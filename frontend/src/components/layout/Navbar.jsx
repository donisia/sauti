import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, KeyRound, LayoutDashboard, Loader2, LogOut, Menu, PenLine, User, X } from 'lucide-react';
import { useNostr } from '../../hooks/useNostr';
import { shortenKey } from '../../utils/nostr';
import Logo from '../common/Logo';

const NAV_LINKS = [
  { to: '/explore', label: 'Explore' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/about', label: 'About' },
];

const linkClass = ({ isActive }) =>
  `relative rounded-full px-3.5 py-2 text-sm transition-colors ${
    isActive ? 'text-cream' : 'text-cream-muted hover:text-cream'
  }`;

/** Connect / identity pill with dropdown. Only ever handles public keys. */
function IdentityButton({ onNavigate }) {
  const { isConnected, isConnecting, npub, isSimulated, connect, disconnect } = useNostr();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handle = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', handle);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', handle);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isConnected) {
    return (
      <button type="button" onClick={connect} disabled={isConnecting} className="btn-secondary btn-sm">
        {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5 text-btc" />}
        {isConnecting ? 'Connecting…' : 'Connect Nostr'}
      </button>
    );
  }

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn-secondary btn-sm gap-2 pl-2"
      >
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-btc/15 text-btc">
          <User className="h-3.5 w-3.5" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-surface" />
        </span>
        <span className="font-mono text-[12px]">{shortenKey(npub)}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right animate-scale-in overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-card"
        >
          <div className="px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">Signed in as</p>
            <p className="mt-1 truncate font-mono text-xs text-cream">{shortenKey(npub, 14, 8)}</p>
            <p className={`mt-1.5 text-[11px] ${isSimulated ? 'text-amber-300' : 'text-emerald-300'}`}>
              {isSimulated ? 'Simulated demo identity' : 'NIP-07 signer connected'}
            </p>
          </div>
          <div className="hairline my-1" />
          <Link to={`/author/${npub}`} onClick={close} role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-cream-muted hover:bg-white/5 hover:text-cream">
            <User className="h-4 w-4" /> Public profile
          </Link>
          <Link to="/dashboard" onClick={close} role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-cream-muted hover:bg-white/5 hover:text-cream">
            <LayoutDashboard className="h-4 w-4" /> Author dashboard
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              disconnect();
              close();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        scrolled || menuOpen ? 'border-line/80 bg-ink/85 backdrop-blur-xl' : 'border-transparent bg-ink/40 backdrop-blur-sm'
      }`}
    >
      <nav className="container-wide flex h-16 items-center justify-between gap-4" aria-label="Primary">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {({ isActive }) => (
                <>
                  {link.label}
                  {isActive && <span className="absolute inset-x-3.5 -bottom-[13px] h-px bg-btc" />}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/create-book" className="btn-ghost btn-sm">
            <PenLine className="h-3.5 w-3.5" /> Write
          </Link>
          <IdentityButton />
        </div>

        <button
          type="button"
          className="icon-btn md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="h-[calc(100dvh-4rem)] animate-fade-in overflow-y-auto border-t border-line bg-ink md:hidden">
          <div className="container-page flex flex-col gap-1 py-6">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-3.5 font-display text-2xl transition ${
                    isActive ? 'bg-white/[0.04] text-btc' : 'text-cream hover:bg-white/[0.03]'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="hairline my-4" />
            <div className="flex flex-col gap-3 px-1">
              <Link to="/create-book" className="btn-primary w-full">
                <PenLine className="h-4 w-4" /> Start publishing
              </Link>
              <div className="flex justify-center">
                <IdentityButton onNavigate={() => setMenuOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
