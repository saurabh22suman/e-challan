import {
  ApiErrorSchema,
  CreateHandoffResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  SessionResponseSchema,
  type CreateHandoffResponse,
  type LoginRequest,
  type LoginResponse,
  type SessionResponse,
} from '@echallan/contracts';

/**
 * Browser client for the demo authentication API (admin dashboard).
 *
 * The browser only ever calls same-origin `/api/...`; the Vite dev/preview proxy
 * strips the `/api` prefix and forwards to the Fastify origin. Nothing here is a
 * stub: there is no client-side authentication shortcut, and the server remains
 * the only authority on whether a session is valid.
 */

/** Same-origin prefix. The proxy, not this module, decides where it lands. */
export const API_PREFIX = '/api';

const LOGIN_PATH = `${API_PREFIX}/auth/login`;
const LOGOUT_PATH = `${API_PREFIX}/auth/logout`;
const SESSION_PATH = `${API_PREFIX}/auth/session`;

/** A refusal from the API, carrying its stable code so callers branch on that. */
export class AuthApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
  }
}

/** Shown when the API could not be reached at all. Never a credential hint. */
export const GENERIC_SIGN_IN_FAILURE =
  'Sign in failed. Check the username and password and try again.';

/**
 * Read an error body defensively: a refusal may arrive from a proxy or an older
 * server, so a missing or drifted body still produces a usable message and never
 * an exception that would leave the form silent.
 */
async function readFailure(response: Response, fallback: string): Promise<AuthApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const parsed = ApiErrorSchema.safeParse(body);
  if (parsed.success)
    return new AuthApiError(response.status, parsed.data.error, parsed.data.message);
  return new AuthApiError(response.status, 'unexpected_error', fallback);
}

/** Exchange credentials for a session. Throws {@link AuthApiError} on refusal. */
export async function signInWithPassword(request: LoginRequest): Promise<LoginResponse> {
  let payload: LoginRequest;
  try {
    payload = LoginRequestSchema.parse(request);
  } catch {
    throw new AuthApiError(400, 'invalid_request', 'Enter your username and password.');
  }
  let response: Response;
  try {
    response = await fetch(LOGIN_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AuthApiError(0, 'network_error', GENERIC_SIGN_IN_FAILURE);
  }
  if (!response.ok) throw await readFailure(response, GENERIC_SIGN_IN_FAILURE);

  const parsed = LoginResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    // A drifted or unexpected success body is a failure, never a silent login.
    throw new AuthApiError(response.status, 'invalid_response', GENERIC_SIGN_IN_FAILURE);
  }
  return parsed.data;
}

/**
 * Mint a one-time code that transfers this session to the tablet origin.
 *
 * The code is not the session token and is never accepted in place of one.
 * It expires after a minute and is revoked on exchange.
 */
export async function requestHandoff(token: string): Promise<CreateHandoffResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}/auth/handoff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AuthApiError(0, 'network_error', GENERIC_SIGN_IN_FAILURE);
  }
  if (!response.ok) throw await readFailure(response, GENERIC_SIGN_IN_FAILURE);

  const parsed = CreateHandoffResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new AuthApiError(response.status, 'invalid_response', GENERIC_SIGN_IN_FAILURE);
  }
  return parsed.data;
}

/**
 * Exchange a one-time handoff code for a session on this origin.
 *
 * The code is not a session token; the API returns a newly issued token, which
 * the caller stores under the dashboard's client storage key.
 */
export async function exchangeHandoff(code: string): Promise<LoginResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}/auth/handoff/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  } catch {
    throw new AuthApiError(0, 'network_error', GENERIC_SIGN_IN_FAILURE);
  }
  if (!response.ok) throw await readFailure(response, GENERIC_SIGN_IN_FAILURE);

  const parsed = LoginResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new AuthApiError(response.status, 'invalid_response', GENERIC_SIGN_IN_FAILURE);
  }
  return parsed.data;
}

/**
 * Ask the API who the caller is, or `null` when the server refuses.
 *
 * The server is asked on **every** load, with no stored token as well as with
 * one. Nothing is inferred from client storage: an expired, revoked or unknown
 * token comes back as a refusal and the client drops it, which is why a reload
 * cannot resurrect a session the API has ended, and why an unconfigured or
 * tampered client store cannot invent one.
 */
export async function fetchSession(token: string | null): Promise<SessionResponse | null> {
  // No token means no session to restore. Do not probe a protected endpoint
  // anonymously just to log a 401 on every sign-in screen.
  if (token === null) return null;
  let response: Response;
  try {
    response = await fetch(SESSION_PATH, {
      method: 'GET',
      ...(token === null ? {} : { headers: { Authorization: `Bearer ${token}` } }),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const parsed = SessionResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    // An interrupted body or non-JSON payload (proxy HTML, truncated response) is
    // "no session", exactly like a refusal. The helper must never reject: a
    // restoration failure has to reach the caller as a value it can clean up.
    return null;
  }
}

/**
 * Revoke the session server-side.
 *
 * Best effort by design: the client clears its own state either way, because a
 * logout that fails on the network must still return the operator to the login
 * screen.
 */
export async function signOutWithToken(token: string | null): Promise<AuthApiError | null> {
  if (token === null) return null;
  try {
    const response = await fetch(LOGOUT_PATH, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) return null;
    return await readFailure(response, 'Signed out on this device.');
  } catch {
    return new AuthApiError(0, 'network_error', 'Signed out on this device.');
  }
}
