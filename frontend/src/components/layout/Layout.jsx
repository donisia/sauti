import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import FlashMessage from '../common/FlashMessage';
import PaymentModal from '../modals/PaymentModal';

/**
 * App shell. `minimal` hides global chrome for the distraction-free reader,
 * while keeping flash messages and the payment modal available everywhere.
 */
export default function Layout({ minimal = false }) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-btc focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>

      {!minimal && <Navbar />}

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      {!minimal && <Footer />}

      <FlashMessage />
      <PaymentModal />
    </div>
  );
}
