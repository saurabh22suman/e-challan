import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

/**
 * Planner-owned component acceptance for the dashboard Profile tab
 * (`specs/011-profile-tracking`): self-service details, session context and no
 * password material.
 */

const TOKEN = 'a'.repeat(64);
const USER_ID = '00000000-0000-4000-8000-0000000000a1';

const supervisorSession = {
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: USER_ID, username: 'DEMO-EMP-002', role: 'Supervisor' },
  post: null,
  shift: null,
};

const profile = {
  user: {
    id: USER_ID,
    username: 'DEMO-EMP-002',
    displayName: 'Sunil Deshmukh',
    employeeId: 'DEMO-EMP-002',
    role: 'Supervisor',
    isActive: true,
    locationLabels: ['Demo industrial campus — main entrance'],
  },
  session: {
    expiresAt: '2099-01-01T12:30:00.000Z',
    post: null,
    shift: null,
  },
};

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

function stubApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'];
    if (url.includes('/auth/login') && method === 'POST') {
      return jsonResponse({ token: TOKEN, ...supervisorSession }, 200);
    }
    if (url.includes('/auth/logout') && method === 'POST') {
      return { ok: true, status: 204, json: async () => ({}) } as Response;
    }
    if (url.includes('/auth/session')) {
      return auth === `Bearer ${TOKEN}`
        ? jsonResponse(supervisorSession, 200)
        : jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401);
    }
    if (url.endsWith('/profile') && method === 'GET') {
      return auth === `Bearer ${TOKEN}`
        ? jsonResponse(profile, 200)
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
}

async function signIn() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/username/i), 'DEMO-EMP-002');
  await user.type(screen.getByLabelText('Password', { exact: true }), 'planner-demo-secret');
  await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
  await screen.findByRole('heading', { name: /demo review workspace/i });
  return user;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('dashboard profile', () => {
  it('shows a Supervisor their own login and assignment details', async () => {
    const fetchMock = stubApi();
    render(<App />);
    const user = await signIn();

    await user.click(await screen.findByRole('tab', { name: 'Profile' }));

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByText('Sunil Deshmukh')).toBeInTheDocument();
    expect(within(main).getAllByText('DEMO-EMP-002').length).toBeGreaterThan(0);
    expect(within(main).getByText('Supervisor')).toBeInTheDocument();
    expect(within(main).getByText('Demo industrial campus — main entrance')).toBeInTheDocument();
    expect(within(main).getByText(/session ends/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith('/api/profile') &&
          (init?.headers as Record<string, string> | undefined)?.['Authorization'] ===
            `Bearer ${TOKEN}`,
      ),
      'the profile must be fetched with the real session token',
    ).toBe(true);
  });

  it('does not show a Users tab to a Supervisor', async () => {
    stubApi();
    render(<App />);
    await signIn();
    expect(screen.queryByRole('tab', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Profile' })).toBeInTheDocument();
  });
});
