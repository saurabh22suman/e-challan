import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { TABLET_IDLE_LOGOUT_MS, type SessionResponse } from '@echallan/contracts';
import {
  AuthApiError,
  SESSION_STORAGE_KEY,
  fetchSession,
  signInWithPassword,
  signOutWithToken,
} from './api';
import { clearUnsentState } from './unsentState';

/**
 * Tablet session state.
 *
 * The API is the only authority: a stored token is validated against
 * `GET /auth/session` on every load, so a reload cannot resurrect a session the
 * server has revoked, expired or never issued. The token itself is kept in
 * `localStorage` so a page reload keeps the operator signed in; the token is
 * opaque and carries no authority of its own.
 */

const TOKEN_STORAGE_KEY = SESSION_STORAGE_KEY;

/** What the shell may render, decided only by the server's answer. */
export type SessionStatus = 'checking' | 'anonymous' | 'authenticated';

/**
 * The tablet accepts every approved role at the API boundary. The app shell sends
 * Marshal identities to the field workspace and hands Supervisor/Admin identities
 * back to the dashboard, so a single sign-in page can serve all three roles. The
 * API's own role/scope enforcement remains independently in force.
 */
export interface SignInContext {
  postId?: string;
  shiftId?: string;
}

export interface SessionValue {
  status: SessionStatus;
  identity: SessionResponse | null;
  /** The live bearer token, for authenticated profile reads. Null when anonymous. */
  token: string | null;
  /** Set when a session was refused (for example, the wrong role). */
  notice: string | null;
  /** True while a stored token is being validated against the API. */
  restoring: boolean;
  /** Resolves on success; throws {@link AuthApiError} so the form can show why. */
  signIn: (username: string, password: string, context?: SignInContext) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Private browsing or a blocked storage partition: behave as signed out.
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token === null) window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    else window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    /* storage unavailable: the session simply does not survive a reload */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Signed out is the initial, safe state: protected content is never rendered
  // before the API has confirmed a session. `restoring` distinguishes "no token"
  // from "a token is still being validated", so the single-login redirect waits
  // for the restoration instead of racing it.
  const [status, setStatus] = useState<SessionStatus>('anonymous');
  const [restoring, setRestoring] = useState(() => readStoredToken() !== null);
  const [identity, setIdentity] = useState<SessionResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  // Monotonic transition identity. Only the newest transition may apply state, so
  // a delayed restoration response can never overwrite a newer login or logout.
  const transitionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const token = readStoredToken();
    tokenRef.current = token;
    const transition = ++transitionRef.current;
    // Defensive cleanup: a rejected restoration is "no session". It only applies
    // while this restoration is still the current transition, so a stale failure
    // can never erase a newer login or its token.
    const failClosed = (): void => {
      if (cancelled || transition !== transitionRef.current) return;
      tokenRef.current = null;
      writeStoredToken(null);
      setToken(null);
      setIdentity(null);
      setNotice(null);
      setRestoring(false);
      setStatus('anonymous');
    };
    void fetchSession(token)
      .then(async (resolved) => {
        if (cancelled || transition !== transitionRef.current) return;
        if (resolved === null) {
          // The server refused (or there was no token): drop it and stay signed out.
          tokenRef.current = null;
          writeStoredToken(null);
          setToken(null);
          setIdentity(null);
          setNotice(null);
          setRestoring(false);
          setStatus('anonymous');
          return;
        }
        tokenRef.current = token;
        setToken(token);
        setIdentity(resolved);
        setNotice(null);
        setRestoring(false);
        setStatus('authenticated');
      })
      .catch(failClosed);
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (username: string, password: string, context: SignInContext = {}) => {
      const transition = ++transitionRef.current;
      // A fresh attempt supersedes any in-flight restoration, including its
      // redirect-suppression flag.
      setRestoring(false);
      const result = await signInWithPassword({ username, password, ...context });
      if (transition !== transitionRef.current) return;
      tokenRef.current = result.token;
      writeStoredToken(result.token);
      setToken(result.token);
      setIdentity({
        expiresAt: result.expiresAt,
        user: result.user,
        post: result.post,
        shift: result.shift,
      });
      setNotice(null);
      setStatus('authenticated');
    },
    [],
  );

  const signOut = useCallback(async () => {
    // Logout supersedes any in-flight restoration or login response.
    ++transitionRef.current;
    const token = tokenRef.current;
    tokenRef.current = null;
    // Unsent in-memory state is discarded whether or not the API answers, so a
    // failed revoke cannot leave the previous operator's draft behind.
    clearUnsentState();
    writeStoredToken(null);
    setToken(null);
    setIdentity(null);
    setNotice(null);
    setRestoring(false);
    setStatus('anonymous');
    if (token !== null) await signOutWithToken(token);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ status, identity, token, notice, restoring, signIn, signOut }),
    [status, identity, token, notice, restoring, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}

/** Allowed-activity events that reset the idle clock. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Idle logout for the tablet (PRD E1.3, addendum A section 2.4).
 *
 * After `idleMs` without allowed activity the session ends: the API session is
 * revoked, the client session is dropped and unsent state is cleared. Any allowed
 * activity restarts the window.
 *
 * Rendered only while authenticated, so the timer never runs on the login screen.
 */
export function IdleLogoutGuard({
  idleMs = TABLET_IDLE_LOGOUT_MS,
  onIdle,
}: {
  idleMs?: number;
  onIdle: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    const restart = () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void onIdleRef.current();
      }, idleMs);
    };

    restart();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, restart, { passive: true });
    }
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, restart);
      }
    };
  }, [idleMs]);

  return null;
}

export { AuthApiError };
