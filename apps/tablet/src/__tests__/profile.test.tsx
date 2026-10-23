import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

/**
 * Planner-owned tablet Profile acceptance (`specs/011-profile-tracking`): a
 * Marshal can open their own login/profile details from the toolbar, and the
 * dialog never shows password material.
 */

const TOKEN = 'a'.repeat(64);
const ID = (suffix: string): string => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;
const IDS = {
  user: ID('1'),
  post: ID('2'),
  shift: ID('3'),
} as const;

const session = {
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: IDS.user, username: 'DEMO-EMP-004', role: 'Marshal' },
  post: { id: IDS.post, label: 'DEMO-POST-01' },
  shift: { id: IDS.shift, label: 'Demo day shift' },
};

const profile = {
  user: {
    id: IDS.user,
    username: 'DEMO-EMP-004',
    displayName: 'Ravi Patel',
    employeeId: 'DEMO-EMP-004',
    role: 'Marshal',
    isActive: true,
    locationLabels: ['Demo industrial campus — main entrance'],
  },
  session: {
    expiresAt: session.expiresAt,
    post: session.post,
    shift: session.shift,
  },
};

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const catalogue = (kind: string) => ({ kind, masters: [] });

function stubApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'];
    if (url.includes('/auth/login') && method === 'POST') {
      return jsonResponse({ token: TOKEN, ...session }, 200);
    }
    if (url.includes('/auth/logout') && method === 'POST') {
      return { ok: true, status: 204, json: async () => ({}) } as Response;
    }
    if (url.includes('/auth/session')) {
      return auth === `Bearer ${TOKEN}`
        ? jsonResponse(session, 200)
        : jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401);
    }
    if (url.endsWith('/profile') && method === 'GET') {
      return auth === `Bearer ${TOKEN}`
        ? jsonResponse(profile, 200)
        : jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401);
    }
    if (url.includes('/api/masters/')) {
      const kind = url.split('/api/masters/')[1]?.split('?')[0] ?? '';
      return jsonResponse(catalogue(kind), 200);
    }
    return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function signedIn() {
  render(<App />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/username/i), 'DEMO-EMP-004');
  await user.type(screen.getByLabelText('Password', { exact: true }), 'planner-demo-secret');
  await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
  await screen.findByLabelText('Vehicle registration');
  return user;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('tablet profile', () => {
  it('opens the Marshal profile with stored details and session context', async () => {
    const fetchMock = stubApi();
    const user = await signedIn();

    await user.click(screen.getByRole('button', { name: 'Profile' }));
    const dialog = await screen.findByRole('dialog', { name: /profile/i });

    expect(within(dialog).getByText('Ravi Patel')).toBeInTheDocument();
    expect(within(dialog).getAllByText('DEMO-EMP-004').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Marshal')).toBeInTheDocument();
    expect(within(dialog).getByText('DEMO-POST-01')).toBeInTheDocument();
    expect(within(dialog).getByText('Demo day shift')).toBeInTheDocument();
    expect(within(dialog).getByText(/main entrance/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/password/i)).not.toBeInTheDocument();

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith('/api/profile') &&
          (init?.headers as Record<string, string> | undefined)?.['Authorization'] ===
            `Bearer ${TOKEN}`,
      ),
      'the profile must be fetched with the session token',
    ).toBe(true);
  });
});
