import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const { replaceLocationMock } = vi.hoisted(() => ({ replaceLocationMock: vi.fn() }));
vi.mock('../auth/navigate', () => ({ replaceLocation: replaceLocationMock }));

/**
 * Planner-owned F-02 admin acceptance (AUTH-01 UI half): a real login screen,
 * protected content, login error feedback and logout for the Supervisor/Admin
 * dashboard shell.
 *
 * These are read-only planner inputs. Do not replace, skip or weaken these assertions.
 * Idle logout is a tablet requirement (PRD E1.3) and is covered in the tablet suite
 * and by the session store's idle window; the admin desktop session uses the longer
 * window recorded in `docs/eChallan_replacement_spec_v0.2.md` section 2.2.
 */

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

/** Synthetic but contract-valid identifiers: UUIDs and a 32-byte hex token. */
const TOKEN = 'b'.repeat(64);
const USER_ID = '00000000-0000-4000-8000-00000000bb01';

const LOGIN_BODY = {
  token: TOKEN,
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: USER_ID, username: 'DEMO-EMP-002', role: 'Supervisor' },
  post: null,
  shift: null,
};

/** The identity-only body the session lookup returns; it never re-issues a token. */
const SESSION_BODY = {
  expiresAt: LOGIN_BODY.expiresAt,
  user: LOGIN_BODY.user,
  post: null,
  shift: null,
};

/** The documented client storage seam (spec section "Client behaviour"). */
const STORAGE_KEY = 'echallan.admin.session-token';

/** A correctly formed Marshal identity: the wrong role for the dashboard. */
const MARSHAL_TOKEN = 'e'.repeat(64);
const MARSHAL_LOGIN_BODY = {
  token: MARSHAL_TOKEN,
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: '00000000-0000-4000-8000-00000000bb11', username: 'DEMO-EMP-004', role: 'Marshal' },
  post: { id: '00000000-0000-4000-8000-00000000bb12', label: 'DEMO-POST-01' },
  shift: { id: '00000000-0000-4000-8000-00000000bb13', label: 'Demo day shift' },
};
const MARSHAL_SESSION_BODY = {
  expiresAt: MARSHAL_LOGIN_BODY.expiresAt,
  user: MARSHAL_LOGIN_BODY.user,
  post: MARSHAL_LOGIN_BODY.post,
  shift: MARSHAL_LOGIN_BODY.shift,
};

/** Empty 204 response, as the contract requires for logout. */
const NO_CONTENT = (): Response =>
  ({
    ok: true,
    status: 204,
    json: async () => {
      throw new Error('204 has no body');
    },
  }) as unknown as Response;

interface StubOptions {
  loginStatus?: number;
  /** Login success body; defaults to the canonical Supervisor response. */
  loginBody?: unknown;
  sessionStatus?: number;
  /** Session identity body; defaults to the Supervisor identity. */
  sessionBody?: unknown;
  /**
   * When set, `/auth/session` returns this promise instead of answering. Used by the
   * R2 ordering cases to release a restoration response at a controlled instant.
   */
  heldSession?: Promise<Response>;
  /**
   * When true, `/auth/session` answers `200 OK` with a body whose `json()` rejects
   * (an interrupted body or proxy HTML). Exercises restoration decoding failure.
   */
  sessionJsonThrows?: boolean;
}

/** A successful response whose body cannot be decoded. */
const INVALID_JSON_RESPONSE = (): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token \'<\', "<html>" is not valid JSON');
    },
  }) as unknown as Response;

/**
 * Capture Node's unhandled-rejection signal without depending on @types/node in this
 * app's tsconfig. A restoration body that cannot be decoded must not reject unhandled;
 * this tracker makes that requirement falsifiable.
 */
function captureUnhandledRejections(): { errors: unknown[]; stop: () => void } {
  const errors: unknown[] = [];
  const listener = (reason: unknown) => errors.push(reason);
  const processLike = (
    globalThis as unknown as {
      process: {
        on: (event: 'unhandledRejection', handler: (reason: unknown) => void) => void;
        off: (event: 'unhandledRejection', handler: (reason: unknown) => void) => void;
      };
    }
  ).process;
  processLike.on('unhandledRejection', listener);
  return { errors, stop: () => processLike.off('unhandledRejection', listener) };
}

/** Let the rejection/cleanup microtasks and Node's unhandled-rejection turn settle. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Contract-faithful fetch stand-in: a canonical login/session body, an invalid or
 * signed-out session as 401, and logout as 204 with no body. The session lookup only
 * yields an identity when a token is presented.
 */
function stubFetch(options: StubOptions = {}) {
  const loginStatus = options.loginStatus ?? 200;
  const sessionStatus = options.sessionStatus ?? 200;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'];

    if (url.includes('/auth/login') && method === 'POST') {
      return loginStatus === 200
        ? jsonResponse(options.loginBody ?? LOGIN_BODY, 200)
        : jsonResponse({ error: 'invalid_credentials', message: 'Sign in failed.' }, 401);
    }
    if (url.includes('/auth/logout') && method === 'POST') {
      return NO_CONTENT();
    }
    if (url.includes('/auth/handoff') && method === 'POST') {
      if (auth === undefined) {
        return jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401);
      }
      return jsonResponse(
        { code: 'test-handoff-code', expiresAt: '2099-01-01T00:00:00.000Z' },
        200,
      );
    }
    if (url.includes('/auth/session')) {
      if (options.heldSession !== undefined) return options.heldSession;
      if (options.sessionJsonThrows === true) return INVALID_JSON_RESPONSE();
      if (sessionStatus !== 200 || auth === undefined) {
        return jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401);
      }
      return jsonResponse(options.sessionBody ?? SESSION_BODY, 200);
    }
    return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const signIn = async (
  account: { username: string; password: string } = {
    username: 'DEMO-EMP-002',
    password: 'planner-demo-supervisor-secret',
  },
) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/username/i), account.username);
  await user.type(screen.getByLabelText('Password', { exact: true }), account.password);
  await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
};

/** A manually released promise, for deterministic response ordering. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  replaceLocationMock.mockReset();
  localStorage.clear();
});

describe('AUTH-01: admin login, protected routes and logout', () => {
  it('shows a labelled login form and no dashboard content before authentication', () => {
    stubFetch();
    render(<App />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /demo review workspace/i }),
    ).not.toBeInTheDocument();
  });

  it('reveals the dashboard shell after a successful sign in', async () => {
    stubFetch();
    render(<App />);

    await signIn();

    expect(
      await screen.findByRole('heading', { name: /demo review workspace/i }),
    ).toBeInTheDocument();
  });

  it('reports a login error and stays on the login screen', async () => {
    stubFetch({ loginStatus: 401 });
    render(<App />);

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent(/sign in failed|incorrect|invalid/i);
    expect(
      screen.queryByRole('heading', { name: /demo review workspace/i }),
    ).not.toBeInTheDocument();
  });

  it('logs out on request, clears the session and tells the API', async () => {
    const fetchMock = stubFetch();
    render(<App />);
    await signIn();
    expect(
      await screen.findByRole('heading', { name: /demo review workspace/i }),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /log ?out|sign out/i }));

    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /demo review workspace/i }),
    ).not.toBeInTheDocument();
    const logoutCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).includes('/api/auth/logout') &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(
      logoutCall,
      'logout must be POSTed to the API, not only cleared in the client',
    ).toBeDefined();
    const headers = (logoutCall?.[1] as RequestInit | undefined)?.headers as
      Record<string, string> | undefined;
    expect(
      headers?.['Authorization'],
      'logout must present the session token so the API can revoke that session',
    ).toContain(TOKEN);
  });

  describe('R1: a Marshal is handed off to the tablet, never shown the dashboard', () => {
    it('mints a one-time handoff after a fresh Marshal login instead of rendering the shell', async () => {
      const fetchMock = stubFetch({ loginBody: MARSHAL_LOGIN_BODY });
      render(<App />);

      await signIn({ username: 'DEMO-EMP-004', password: 'planner-demo-marshal-secret' });

      expect(
        await screen.findByRole('heading', { name: /opening the marshal tablet/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /demo review workspace/i }),
      ).not.toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(MARSHAL_TOKEN);

      const handoffCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/auth/handoff') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(handoffCall, 'the dashboard must ask the API for a handoff code').toBeDefined();
      const headers = (handoffCall?.[1] as RequestInit | undefined)?.headers as
        Record<string, string> | undefined;
      expect(headers?.['Authorization']).toContain(MARSHAL_TOKEN);

      await vi.waitFor(() => {
        expect(replaceLocationMock).toHaveBeenCalledWith(
          'http://127.0.0.1:5173/#handoff=test-handoff-code',
        );
      });
    });

    it('hands off a restored Marshal session instead of rendering the shell', async () => {
      localStorage.setItem(STORAGE_KEY, MARSHAL_TOKEN);
      stubFetch({ sessionBody: MARSHAL_SESSION_BODY });
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: /opening the marshal tablet/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /demo review workspace/i }),
      ).not.toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(MARSHAL_TOKEN);

      await vi.waitFor(() => {
        expect(replaceLocationMock).toHaveBeenCalledWith(
          'http://127.0.0.1:5173/#handoff=test-handoff-code',
        );
      });
    });
  });

  describe('R2: obsolete session responses cannot replace newer state', () => {
    it('keeps a newer successful login when a stale anonymous restoration is released', async () => {
      // A stale token is present, so the mount really does start a restoration
      // request; the test cannot pass by the client simply never asking.
      localStorage.setItem(STORAGE_KEY, 'f'.repeat(64));
      const held = deferred<Response>();
      stubFetch({ heldSession: held.promise });
      render(<App />);

      await signIn();
      expect(
        await screen.findByRole('heading', { name: /demo review workspace/i }),
      ).toBeInTheDocument();
      const issuedToken = localStorage.getItem(STORAGE_KEY);
      expect(issuedToken).toBe(TOKEN);

      await act(async () => {
        held.resolve(jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401));
        await held.promise;
      });

      expect(
        screen.getByRole('heading', { name: /demo review workspace/i }),
        'a stale refusal must not erase the newer session',
      ).toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(issuedToken);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not let a stale valid restoration resurrect the session after logout', async () => {
      localStorage.setItem(STORAGE_KEY, TOKEN);
      const held = deferred<Response>();
      stubFetch({ heldSession: held.promise });
      render(<App />);

      expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
      await signIn();
      expect(
        await screen.findByRole('heading', { name: /demo review workspace/i }),
      ).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /log ?out|sign out/i }));
      expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

      await act(async () => {
        held.resolve(jsonResponse(SESSION_BODY, 200));
        await held.promise;
      });

      expect(
        screen.queryByRole('heading', { name: /demo review workspace/i }),
        'a stale valid restoration must not sign the operator back in',
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('C1: restoration body decoding failures are treated as no session', () => {
    it('treats a successful restoration response with invalid JSON as no session, without an unhandled rejection', async () => {
      localStorage.setItem(STORAGE_KEY, TOKEN);
      stubFetch({ sessionJsonThrows: true });
      const tracker = captureUnhandledRejections();
      try {
        render(<App />);

        expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
        await settle();

        expect(tracker.errors, 'an undecodable restoration body must not reject unhandled').toEqual(
          [],
        );
        expect(
          localStorage.getItem(STORAGE_KEY),
          'a token that cannot be restored must be removed',
        ).toBeNull();
        expect(
          screen.queryByRole('heading', { name: /demo review workspace/i }),
        ).not.toBeInTheDocument();
      } finally {
        tracker.stop();
      }
    });

    it('control: a decoded invalid-schema restoration is already treated as no session', async () => {
      localStorage.setItem(STORAGE_KEY, TOKEN);
      stubFetch({ sessionBody: {} });
      const tracker = captureUnhandledRejections();
      try {
        render(<App />);

        expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
        await settle();

        expect(tracker.errors).toEqual([]);
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(
          screen.queryByRole('heading', { name: /demo review workspace/i }),
        ).not.toBeInTheDocument();
      } finally {
        tracker.stop();
      }
    });

    it('control: a valid restoration restores the session and keeps the token', async () => {
      localStorage.setItem(STORAGE_KEY, TOKEN);
      stubFetch({ sessionBody: SESSION_BODY });
      const tracker = captureUnhandledRejections();
      try {
        render(<App />);

        expect(
          await screen.findByRole('heading', { name: /demo review workspace/i }),
        ).toBeInTheDocument();
        await settle();

        expect(tracker.errors).toEqual([]);
        expect(localStorage.getItem(STORAGE_KEY)).toBe(TOKEN);
      } finally {
        tracker.stop();
      }
    });

    it('a stale restoration read failure cannot erase a newer login', async () => {
      localStorage.setItem(STORAGE_KEY, 'f'.repeat(64));
      const held = deferred<Response>();
      stubFetch({ heldSession: held.promise });
      const tracker = captureUnhandledRejections();
      try {
        render(<App />);

        await signIn();
        expect(
          await screen.findByRole('heading', { name: /demo review workspace/i }),
        ).toBeInTheDocument();
        expect(localStorage.getItem(STORAGE_KEY)).toBe(TOKEN);

        // Release the stale restoration with an undecodable body after the login.
        await act(async () => {
          held.resolve(INVALID_JSON_RESPONSE());
          await held.promise;
        });
        await settle();

        expect(tracker.errors, 'the stale failure must be handled, not unhandled').toEqual([]);
        expect(
          screen.getByRole('heading', { name: /demo review workspace/i }),
          'a stale decoding failure must not erase the newer login',
        ).toBeInTheDocument();
        expect(localStorage.getItem(STORAGE_KEY)).toBe(TOKEN);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      } finally {
        tracker.stop();
      }
    });
  });
});
