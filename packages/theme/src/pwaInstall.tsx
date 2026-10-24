import { useEffect, useState, useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SPACING } from './touchTargets.js';
import { ActionButton } from './button.js';
import { tokens } from './tokens.js';

/**
 * Mobile/tablet-only install affordance.
 *
 * The browser decides whether an app is installable. On a supported phone or
 * tablet we capture `beforeinstallprompt`, show our own labelled action and call
 * the browser prompt from that user gesture. Desktop deliberately gets no custom
 * banner: the event is prevented from producing a mini-infobar and the device
 * gate keeps the UI out of the dashboard layout.
 *
 * The capture listener is installed by `capturePwaInstallPrompt()` before React
 * starts, because the event may fire on the sign-in page before the authenticated
 * shell mounts.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'echallan.pwa-install-dismissed-until';
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let captureInitialized = false;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const subscriber of subscribers) subscriber();
}

function isStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  ) {
    return true;
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** True for phones and tablets, not a normal desktop browser. */
export function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent ?? '';
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet|IEMobile|Opera Mini/i.test(userAgent)) {
    return true;
  }

  const userAgentData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } })
    .userAgentData;
  if (userAgentData?.mobile === true) return true;

  // iPadOS reports a Macintosh user agent; the touch-point check distinguishes it
  // from a real desktop Mac.
  if (isIosDevice()) return true;

  if (typeof window.matchMedia !== 'function') return false;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  return coarsePointer && touchPoints > 0 && window.innerWidth <= 1024;
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent ?? '';
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

function readDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (raw === null) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_FOR_MS));
  } catch {
    /* dismissal simply does not persist */
  }
}

function subscribeToPrompt(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

function clearDeferredPrompt(): void {
  deferredPrompt = null;
  notify();
}

/** Attach the capture listener before React renders. Safe to call repeatedly. */
export function capturePwaInstallPrompt(): void {
  if (captureInitialized || typeof window === 'undefined') return;
  captureInitialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Suppress the browser mini-infobar. Our own banner is the only user-facing
    // prompt, and it is gated to phone/tablet devices below.
    event.preventDefault();
    if (!isMobileOrTabletDevice()) return;
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    clearDeferredPrompt();
  });
}

export function PwaInstallPrompt() {
  const deferred = useSyncExternalStore(
    subscribeToPrompt,
    () => deferredPrompt,
    () => null,
  );
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || readDismissed()) {
      setEligible(false);
      return;
    }
    const mobile = isMobileOrTabletDevice();
    setEligible(mobile);
    setIosHint(mobile && isIosDevice());
  }, []);

  if (!eligible || dismissed || isStandalone()) return null;
  if (deferred === null && !iosHint) return null;

  const dismiss = (): void => {
    writeDismissed();
    setDismissed(true);
  };

  const install = async (): Promise<void> => {
    if (deferred === null) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    clearDeferredPrompt();
    if (choice.outcome === 'accepted') setEligible(false);
    else dismiss();
  };

  return (
    <Box
      role="region"
      aria-label="Install e-Challan"
      sx={{
        width: `calc(100% - ${SPACING.xxl})`,
        maxWidth: 960,
        marginX: 'auto',
        marginY: SPACING.lg,
        border: `1px solid ${tokens.line}`,
        borderRadius: 2,
        backgroundColor: tokens.tint,
        padding: SPACING.md,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={SPACING.md}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Install e-Challan
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            {iosHint
              ? 'Tap Share, then Add to Home Screen to install this app.'
              : 'Add this app to this device for a full-screen, app-like experience.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={SPACING.sm} sx={{ flexShrink: 0 }}>
          <ActionButton tone="ghost" size="md" onClick={dismiss}>
            Not now
          </ActionButton>
          {!iosHint && (
            <ActionButton tone="primary" size="md" onClick={() => void install()}>
              Install
            </ActionButton>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
