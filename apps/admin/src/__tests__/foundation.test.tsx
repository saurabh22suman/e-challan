import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

/**
 * F-04 shell acceptance for the dashboard (UI-03, component layer).
 *
 * F-04 revision: the foundation screen is replaced by the approved dashboard shell
 * with a lazy, honest empty-state screen. The substantive checks are preserved —
 * protected content only after authentication and no fabricated data presented as
 * a completed feature. Read-only planner input.
 */

const TOKEN = 'b'.repeat(64);
const SUPERVISOR = { username: 'EMP-2217', password: 'planner-demo-supervisor-secret' };
const ID = (suffix: string): string => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const NO_CONTENT = (): Response =>
  ({
    ok: true,
    status: 204,
    json: async () => {
      throw new Error('204 has no body');
    },
  }) as unknown as Response;

const SESSION_BODY = {
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: ID('1'), username: 'EMP-2217', role: 'Supervisor' },
  post: null,
  shift: null,
};

const stubApi = () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'];

    if (url.includes('/auth/login') && method === 'POST') {
      return jsonResponse({ token: TOKEN, ...SESSION_BODY }, 200);
    }
    if (url.includes('/auth/logout') && method === 'POST') return NO_CONTENT();
    if (url.includes('/auth/session')) {
      return auth === `Bearer ${TOKEN}`
        ? jsonResponse(SESSION_BODY, 200)
        : jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401);
    }
    if (url.includes('/challans/report') && method === 'GET') {
      return jsonResponse(
        {
          items: [],
          page: 1,
          pageSize: 25,
          total: 0,
          totals: { total: 0, issuedToday: 0, pending: 0, resolved: 0, repeatOffenders: 0 },
        },
        200,
      );
    }
    if (url.includes('/challans') && method === 'GET') {
      return jsonResponse({ items: [] }, 200);
    }
    return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

async function renderSignedIn() {
  render(<App />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/username/i), SUPERVISOR.username);
  await user.type(screen.getByLabelText('Password', { exact: true }), SUPERVISOR.password);
  await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
  await screen.findByRole('heading', { name: /review workspace/i });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('dashboard shell (F-04)', () => {
  it('renders the labelled dashboard shell with the real review surface', async () => {
    stubApi();
    await renderSignedIn();

    expect(screen.getByRole('heading', { name: /review workspace/i })).toBeInTheDocument();
    expect(await screen.findByText(/no challans match this filter/i)).toBeInTheDocument();
    // Reporting tiles are now backed by the server report.
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Issued today')).toBeInTheDocument();
  });

  it('logs out from the dashboard and returns to the login screen', async () => {
    stubApi();
    await renderSignedIn();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /log ?out|sign out/i }));
    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /review workspace/i })).not.toBeInTheDocument();
  });
});
