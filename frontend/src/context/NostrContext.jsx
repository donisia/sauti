import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { useFlash } from '../hooks/useFlash';
import { DEFAULT_RELAYS, hexToNpub, publishToRelay } from '../utils/nostr';

/**
 * Nostr identity & signing.
 * Modes:
 *  - 'nip07' : a browser extension (Alby, nos2x) holds the key and signs.
 *  - 'local' : the app creates a real key in this browser (no signup needed).
 */
export const NostrContext = createContext(null);

const STORAGE_KEY = 'sp:nostr-session';
const LOCAL_KEY = 'sp:local-sk';

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

function getLocalSecretKey() {
  let hex = localStorage.getItem(LOCAL_KEY);
  if (!hex) {
    hex = toHex(generateSecretKey());
    localStorage.setItem(LOCAL_KEY, hex);
  }
  return fromHex(hex);
}

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return s?.mode === 'simulated' ? null : s; // drop old fake sessions
  } catch {
    return null;
  }
}

export function NostrProvider({ children }) {
  const flash = useFlash();
  const [session, setSession] = useState(readSession);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasExtension, setHasExtension] = useState(() => typeof window !== 'undefined' && Boolean(window.nostr));

  useEffect(() => {
    if (window.nostr) return undefined;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (window.nostr) {
        setHasExtension(true);
        clearInterval(interval);
      } else if (attempts > 12) {
        clearInterval(interval);
      }
    }, 250);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      if (window.nostr?.getPublicKey) {
        const pubkey = await window.nostr.getPublicKey();
        const next = { pubkey, npub: hexToNpub(pubkey), mode: 'nip07' };
        setSession(next);
        flash.success('Your signer shared your public key. Your private key never left the extension.', {
          title: 'Nostr identity connected',
        });
        return next;
      }

      const pubkey = getPublicKey(getLocalSecretKey());
      const next = { pubkey, npub: hexToNpub(pubkey), mode: 'local' };
      setSession(next);
      flash.success('A new Nostr key was created in this browser. No email or phone number needed.', {
        title: 'Pen name created',
      });
      return next;
    } catch (error) {
      flash.error(error?.message || 'Could not connect.', { title: 'Connection failed' });
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [flash]);

  const disconnect = useCallback(() => {
    setSession(null);
    flash.info('Your session was cleared from this browser.', { title: 'Disconnected' });
  }, [flash]);

  const signEvent = useCallback(
    async (template) => {
      if (!session) throw new Error('Connect a Nostr identity before signing.');
      const base = {
        kind: template.kind ?? 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: template.tags ?? [],
        content: template.content ?? '',
      };

      if (session.mode === 'nip07' && window.nostr?.signEvent) {
        return window.nostr.signEvent({ ...base, pubkey: session.pubkey });
      }
      return finalizeEvent(base, getLocalSecretKey());
    },
    [session],
  );

  const publishEvent = useCallback(async (event, relayUrls = DEFAULT_RELAYS.map((r) => r.url)) => {
    return Promise.all(relayUrls.map((url) => publishToRelay(url, event).then((result) => ({ url, ...result }))));
  }, []);

  const signAndPublish = useCallback(
    async (template) => {
      const event = await signEvent(template);
      const results = await publishEvent(event);
      return { event, results, accepted: results.filter((r) => r.ok).length };
    },
    [signEvent, publishEvent],
  );

  const value = useMemo(
    () => ({
      isConnected: Boolean(session),
      pubkey: session?.pubkey ?? null,
      npub: session?.npub ?? null,
      mode: session?.mode ?? null,
      isSimulated: false,
      hasExtension,
      isConnecting,
      relays: DEFAULT_RELAYS,
      connect,
      disconnect,
      signEvent,
      publishEvent,
      signAndPublish,
    }),
    [session, hasExtension, isConnecting, connect, disconnect, signEvent, publishEvent, signAndPublish],
  );

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>;
}