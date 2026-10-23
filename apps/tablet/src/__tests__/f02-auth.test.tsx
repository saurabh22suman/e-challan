import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const { replaceLocationMock } = vi.hoisted(() => ({ replaceLocationMock: vi.fn() }));
vi.mock('../auth/navigate', () => ({ replaceLocation: replaceLocationMock }));

/**
 * Planner-owned F-02 tablet acceptance (AUTH-01, AUTH-04 UI/E2E half): a real login
 * screen, protected content, login error feedback, logout, and the 10-minute idle
 * logout clearing unsent state.
 *
 * These are read-only planner inputs. Do not replace, skip or weaken these assertions.
 * Note the honest boundary recorded in
 * `docs/eChallan_replacement_spec_v0.2.md`: the challan draft does not exist until
 * I-01, so "unsent state" here is the session and any in-progress form state the
 * tablet holds. No draft is claimed to be proven.
 */

const MARSHAL = { username: 'DEMO-EMP-004', password: 'planner-demo-marshal-secret' };

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

/** Synthetic but contract-valid identifiers: UUIDs and a 32-byte hex token. */
const TOKEN = 'a'.repeat(64);
const USER_ID = '00000000-0000-4000-8000-00000000aa01';
const POST_ID = '00000000-0000-4000-8000-00000000aa02';
const SHIFT_ID = '00000000-0000-4000-8000-00000000aa03';

const LOGIN_BODY = {
  token: TOKEN,
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: USER_ID, username: 'DEMO-EMP-004', role: 'Marshal' },
  post: { id: POST_ID, label: 'DEMO-POST-01' },
  shift: { id: SHIFT_ID, label: 'Demo day shift' },
};

/** The identity-only body the session lookup returns; it never re-issues a token. */
const SESSION_BODY = {
  expiresAt: LOGIN_BODY.expiresAt,
  user: LOGIN_BODY.user,
  post: LOGIN_BODY.post,
  shift: LOGIN_BODY.shift,
};

/** The documented client storage seam (spec section "Client behaviour"). */
const STORAGE_KEY = 'echallan.tablet.session-token';

/** A correctly formed Supervisor identity: the wrong role for the marshal tablet. */
const SUPERVISOR_TOKEN = 'd'.repeat(64);
const SUPERVISOR_LOGIN_BODY = {
  token: SUPERVISOR_TOKEN,
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: {
    id: '00000000-0000-4000-8000-00000000aa11',
    username: 'DEMO-EMP-002',
    role: 'Supervisor',
  },
  post: null,
  shift: null,
};
const SUPERVISOR_SESSION_BODY = {
  expiresAt: SUPERVISOR_LOGIN_BODY.expiresAt,
  user: SUPERVISOR_LOGIN_BODY.user,
  post: null,
  shift: null,
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
  /** Login success body; defaults to the canonical Marshal response. */
  loginBody?: unknown;
  sessionStatus?: number;
  /** Session identity body; defaults to the Marshal identity. */
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
 * yields an identity when a token is presented. Anything else resolves to a 404 so an
 * unstubbed call cannot look like success.
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
    // The authenticated shell loads its master catalogues; a healthy empty
    // catalogue keeps these auth-focused tests free of unrelated notices.
    if (url.includes('/api/masters/')) {
      const kind = url.split('/api/masters/')[1]?.split('?')[0] ?? '';
      return jsonResponse({ kind, masters: [] }, 200);
    }
    return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const signIn = async (account: { username: string; password: string } = MARSHAL) => {
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
  vi.useRealTimers();
  localStorage.clear();
});

describe('AUTH-01/AUTH-04: tablet login, protected routes and idle logout', () => {
  it('shows a labelled login form and no protected content before authentication', () => {
    stubFetch();
    render(<App />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Password', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
    // Protected content must not exist in the DOM before a session.
    expect(
      screen.queryByRole('heading', { name: /create new safety violation/i }),
    ).not.toBeInTheDocument();
  });

  it('labels the password field so it is never identified by placeholder alone', () => {
    stubFetch();
    render(<App />);

    const password = screen.getByLabelText('Password', { exact: true });
    expect(password).toHaveAttribute('type', 'password');
  });

  it('reveals the protected screen after a successful sign in', async () => {
    stubFetch();
    render(<App />);

    await signIn();

    expect(
      await screen.findByRole('heading', { name: /create new safety violation/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });

  it('reports a login error and stays on the login screen', async () => {
    stubFetch({ loginStatus: 401 });
    render(<App />);

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent(/sign in failed|incorrect|invalid/i);
    expect(
      screen.queryByRole('heading', { name: /create new safety violation/i }),
    ).not.toBeInTheDocument();
  });

  it('logs out on request and clears the session', async () => {
    const fetchMock = stubFetch();
    render(<App />);
    await signIn();
    expect(
      await screen.findByRole('heading', { name: /create new safety violation/i }),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /log ?out|sign out/i }));

    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /create new safety violation/i }),
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

  it('returns to login after 10 idle minutes and clears unsent state', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    stubFetch();
    render(<App />);

    await user.type(screen.getByLabelText(/username/i), MARSHAL.username);
    await user.type(screen.getByLabelText('Password', { exact: true }), MARSHAL.password);
    await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
    expect(
      await screen.findByRole('heading', { name: /create new safety violation/i }),
    ).toBeInTheDocument();

    // Type something that represents unsent in-memory state.
    const postField = await screen.findByLabelText(/driver name/i);
    await user.clear(postField);
    await user.type(postField, 'UNSENT-1');
    expect(postField).toHaveValue('UNSENT-1');

    // Just under the window: still signed in, state preserved.
    await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
    expect(
      screen.getByRole('heading', { name: /create new safety violation/i }),
    ).toBeInTheDocument();
    expect(postField).toHaveValue('UNSENT-1');

    // Crossing 10 minutes: idle logout, unsent state cleared.
    await vi.advanceTimersByTimeAsync(61 * 1000);
    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /create new safety violation/i }),
    ).not.toBeInTheDocument();

    // Disappearing from the DOM is not proof the state was discarded: sign in again
    // and confirm the unsent value was not restored.
    await user.type(screen.getByLabelText(/username/i), MARSHAL.username);
    await user.type(screen.getByLabelText('Password', { exact: true }), MARSHAL.password);
    await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
    const field = await screen.findByLabelText(/driver name/i);
    expect(
      field,
      'unsent state must be discarded, not restored after re-authentication',
    ).not.toHaveValue('UNSENT-1');
  });

  it('resets the idle timer on allowed activity', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    stubFetch();
    render(<App />);

    await user.type(screen.getByLabelText(/username/i), MARSHAL.username);
    await user.type(screen.getByLabelText('Password', { exact: true }), MARSHAL.password);
    await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
    await screen.findByRole('heading', { name: /create new safety violation/i });

    // Activity every 8 minutes for 24 minutes must never idle out.
    for (let step = 0; step < 3; step += 1) {
      await vi.advanceTimersByTimeAsync(8 * 60 * 1000);
      const field = screen.getByLabelText(/driver name/i);
      await user.click(field);
      expect(
        screen.getByRole('heading', { name: /create new safety violation/i }),
        'allowed activity must keep resetting the idle timer',
      ).toBeInTheDocument();
    }
  });

  describe('R1: a non-Marshal is handed back to the dashboard, never shown the tablet shell', () => {
    it('mints a one-time handoff after a fresh Supervisor login instead of rendering the shell', async () => {
      const fetchMock = stubFetch({ loginBody: SUPERVISOR_LOGIN_BODY });
      render(<App />);

      await signIn({ username: 'DEMO-EMP-002', password: 'planner-demo-supervisor-secret' });

      expect(await screen.findByRole('heading', { name: /opening the dashboard/i })).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: /create new safety violation/i }),
      ).not.toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(SUPERVISOR_TOKEN);

      const handoffCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/auth/handoff') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(handoffCall, 'the tablet must ask the API for a handoff code').toBeDefined();
      const headers = (handoffCall?.[1] as RequestInit | undefined)?.headers as
        Record<string, string> | undefined;
      expect(headers?.['Authorization']).toContain(SUPERVISOR_TOKEN);

      await vi.waitFor(() => {
        expect(replaceLocationMock).toHaveBeenCalledWith(
          'http://127.0.0.1:5174/#handoff=test-handoff-code',
        );
      });
    });

    it('hands off a restored Supervisor session instead of rendering the shell', async () => {
      localStorage.setItem(STORAGE_KEY, SUPERVISOR_TOKEN);
      stubFetch({ sessionBody: SUPERVISOR_SESSION_BODY });
      render(<App />);

      expect(await screen.findByRole('heading', { name: /opening the dashboard/i })).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: /create new safety violation/i }),
      ).not.toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(SUPERVISOR_TOKEN);

      await vi.waitFor(() => {
        expect(replaceLocationMock).toHaveBeenCalledWith(
          'http://127.0.0.1:5174/#handoff=test-handoff-code',
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
        await screen.findByRole('heading', { name: /create new safety violation/i }),
      ).toBeInTheDocument();
      const issuedToken = localStorage.getItem(STORAGE_KEY);
      expect(issuedToken).toBe(TOKEN);

      // Release the stale restoration refusal after the successful login.
      await act(async () => {
        held.resolve(jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401));
        await held.promise;
      });

      expect(
        screen.getByRole('heading', { name: /create new safety violation/i }),
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
        await screen.findByRole('heading', { name: /create new safety violation/i }),
      ).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /log ?out|sign out/i }));
      expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

      // Release the stale restoration identity after logout.
      await act(async () => {
        held.resolve(jsonResponse(SESSION_BODY, 200));
        await held.promise;
      });

      expect(
        screen.queryByRole('heading', { name: /create new safety violation/i }),
        'a stale valid restoration must not sign the operator back in',
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('R3: ambiguous context is resolved with stored options only', () => {
    const POST_ALPHA = '00000000-0000-4000-8000-00000000c001';
    const POST_BETA = '00000000-0000-4000-8000-00000000c002';
    const SHIFT_DAY = '00000000-0000-4000-8000-00000000c003';
    const SHIFT_NIGHT = '00000000-0000-4000-8000-00000000c004';

    it('offers the API candidates, resubmits the chosen ids and reaches the shell', async () => {
      const attempts: Array<Record<string, unknown>> = [];
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url.includes('/auth/login') && method === 'POST') {
          const body = JSON.parse(String((init as RequestInit).body ?? '{}')) as Record<
            string,
            unknown
          >;
          attempts.push(body);
          if (attempts.length === 1) {
            return jsonResponse(
              {
                error: 'ambiguous_context',
                message: 'Select the post to work at.',
                postOptions: [
                  { id: POST_ALPHA, label: 'Post Alpha' },
                  { id: POST_BETA, label: 'Post Beta' },
                ],
                shiftOptions: [],
              },
              422,
            );
          }
          if (attempts.length === 2) {
            return jsonResponse(
              {
                error: 'ambiguous_context',
                message: 'Select the shift to work.',
                postOptions: [{ id: POST_ALPHA, label: 'Post Alpha' }],
                shiftOptions: [
                  { id: SHIFT_DAY, label: 'Day shift' },
                  { id: SHIFT_NIGHT, label: 'Night shift' },
                ],
              },
              422,
            );
          }
          // The session MUST reflect the selection the operator actually made; a
          // different post or shift here would let an inconsistent client pass.
          return jsonResponse(
            {
              token: TOKEN,
              expiresAt: '2099-01-01T00:00:00.000Z',
              user: { id: USER_ID, username: 'DEMO-EMP-004', role: 'Marshal' },
              post: { id: POST_ALPHA, label: 'Post Alpha' },
              shift: { id: SHIFT_NIGHT, label: 'Night shift' },
            },
            200,
          );
        }
        if (url.includes('/auth/session')) {
          return jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401);
        }
        return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
      });
      vi.stubGlobal('fetch', fetchMock);

      const optionValues = (select: HTMLElement): string[] =>
        Array.from((select as HTMLSelectElement).options).map((option) => option.value);
      const optionLabels = (select: HTMLElement): string[] =>
        Array.from((select as HTMLSelectElement).options)
          .filter((option) => option.value !== '')
          .map((option) => option.textContent);

      render(<App />);
      await signIn();

      expect(await screen.findByRole('alert')).toHaveTextContent(/ambiguous|select/i);

      // Every option comes from the API response and only from it; the placeholder
      // is empty and nothing is selected on the operator's behalf.
      const postSelect = await screen.findByLabelText(/post/i);
      expect(postSelect).toBeInTheDocument();
      expect(
        optionValues(postSelect),
        'exactly the offered posts plus an empty placeholder',
      ).toEqual(['', POST_ALPHA, POST_BETA]);
      expect(optionLabels(postSelect), 'no invented, extra or unauthorised post').toEqual([
        'Post Alpha',
        'Post Beta',
      ]);
      expect((postSelect as HTMLSelectElement).value, 'no post may be pre-selected').toBe('');
      expect(screen.queryByLabelText(/shift/i)).not.toBeInTheDocument();

      const user = userEvent.setup();
      await user.selectOptions(postSelect, POST_ALPHA);
      await user.click(screen.getByRole('button', { name: /sign in|continue|select/i }));

      // The shift selector is exactly the shift options the API returned, again with
      // nothing pre-selected.
      const shiftSelect = await screen.findByLabelText(/shift/i);
      expect(
        optionValues(shiftSelect),
        'exactly the offered shifts plus an empty placeholder',
      ).toEqual(['', SHIFT_DAY, SHIFT_NIGHT]);
      expect(optionLabels(shiftSelect), 'no invented, extra or unauthorised shift').toEqual([
        'Day shift',
        'Night shift',
      ]);
      expect((shiftSelect as HTMLSelectElement).value, 'no shift may be pre-selected').toBe('');

      await user.selectOptions(shiftSelect, SHIFT_NIGHT);
      await user.click(screen.getByRole('button', { name: /sign in|continue|select/i }));

      expect(
        await screen.findByRole('heading', { name: /create new safety violation/i }),
      ).toBeInTheDocument();
      // The shell shows the post the operator chose, not a different one.
      expect(screen.getByText('Post Alpha')).toBeInTheDocument();

      expect(attempts).toHaveLength(3);
      // Credentials are preserved across every retry (never re-typed, never dropped):
      // the first retry is checked above, the final retry here.
      expect(attempts[1]?.username).toBe(MARSHAL.username);
      expect(attempts[1]?.password).toBe(MARSHAL.password);
      expect(attempts[1]?.postId).toBe(POST_ALPHA);
      expect(attempts[1]?.shiftId).toBeUndefined();
      expect(attempts[2]?.username).toBe(MARSHAL.username);
      expect(attempts[2]?.password).toBe(MARSHAL.password);
      expect(attempts[2]?.postId).toBe(POST_ALPHA);
      expect(attempts[2]?.shiftId).toBe(SHIFT_NIGHT);
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
          screen.queryByRole('heading', { name: /create new safety violation/i }),
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
          screen.queryByRole('heading', { name: /create new safety violation/i }),
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
          await screen.findByRole('heading', { name: /create new safety violation/i }),
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
          await screen.findByRole('heading', { name: /create new safety violation/i }),
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
          screen.getByRole('heading', { name: /create new safety violation/i }),
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
