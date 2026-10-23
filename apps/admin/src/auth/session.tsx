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
import type { SessionResponse } from '@echallan/contracts';
import { AuthApiError, fetchSession, signInWithPassword, signOutWithToken } from './api';

/**
 * Admin dashboard session state.
 *
 * The API is the only authority: the stored token is validated against
 * `GET /auth/session` on every load, so a reload cannot resurrect a session the
 * server has revoked, expired or never issued.
 *
 * There is deliberately **no idle hook here**. PRD E1.3's ten-minute idle return
 * is a tablet requirement; the dashboard session is governed by the longer
 * Supervisor/Admin window the API enforces (addendum A section 2.2), so adding a
 * client-side timer would invent a rule the specification does not state.
 */

const TOKEN_STORAGE_KEY = 'echallan.admin.session-token';

/** What the shell may render, decided only by the server's answer. */
export type SessionStatus = 'checking' | 'anonymous' | 'authenticated';

/**
 * The dashboard admits **Supervisor** and **Admin** sessions only. The boundary
 * applies to a fresh login and to a restored session, and the API's own role and
 * scope enforcement remains independently in force.
 */
const ALLOWED_ROLES: readonly string[] = ['Supervisor', 'Admin'];

/** Visible feedback when the signed-in account belongs to another surface. */
const WRONG_SURFACE_MESSAGE = 'This account is not authorised for the dashboard.';

export interface SessionValue {
  status: SessionStatus;
  identity: SessionResponse | null;
  /** The live bearer token, for authenticated dashboard calls. Null when anonymous. */
  token: string | null;
  /** Set when a session was refused (for example, the wrong role). */
  notice: string | null;
  /** Resolves on success; throws `AuthApiError` so the form can show why. */
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Blocked storage partition: behave as signed out.
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
  // before the API has confirmed a session. A stored token is validated in the
  // background and promotes the state when the server agrees.
  const [status, setStatus] = useState<SessionStatus>('anonymous');
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
          setStatus('anonymous');
          return;
        }
        if (!ALLOWED_ROLES.includes(resolved.user.role)) {
          // A session for another surface is revoked, never rendered.
          tokenRef.current = null;
          writeStoredToken(null);
          setToken(null);
          setIdentity(null);
          setNotice(WRONG_SURFACE_MESSAGE);
          setStatus('anonymous');
          if (token !== null) await signOutWithToken(token);
          return;
        }
        tokenRef.current = token;
        setToken(token);
        setIdentity(resolved);
        setNotice(null);
        setStatus('authenticated');
      })
      .catch(failClosed);
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const transition = ++transitionRef.current;
    // The stored token is replaced only after the API has issued a new one.
    const result = await signInWithPassword({ username, password });
    if (transition !== transitionRef.current) return;
    if (!ALLOWED_ROLES.includes(result.user.role)) {
      // The API issued a real session, but this surface must not use it: revoke it
      // and fail the sign-in rather than retaining a token we will not honour.
      await signOutWithToken(result.token);
      throw new AuthApiError(403, 'role_not_allowed', WRONG_SURFACE_MESSAGE);
    }
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
  }, []);

  const signOut = useCallback(async () => {
    // Logout supersedes any in-flight restoration or login response.
    ++transitionRef.current;
    const token = tokenRef.current;
    tokenRef.current = null;
    writeStoredToken(null);
    setToken(null);
    setIdentity(null);
    setNotice(null);
    setStatus('anonymous');
    if (token !== null) await signOutWithToken(token);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ status, identity, token, notice, signIn, signOut }),
    [status, identity, token, notice, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}
