import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

/**
 * Planner-owned component acceptance for `specs/010-user-management`:
 * Admin create-user dialog, location selection, deactivate confirmation,
 * reactivate, and the self-lockout guard. Real API behavior is covered by the
 * integration suite; password reset remains covered by the 009 suite.
 */

const TOKEN = 'f'.repeat(64);
const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
const TARGET_ID = '00000000-0000-4000-8000-0000000000a2';
const LOCATION_ID = '00000000-0000-4000-8000-0000000000c1';
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-0000000000c2';

const session = {
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: ADMIN_ID, username: 'DEMO-EMP-001', role: 'Admin' },
  post: null,
  shift: null,
};

const initialUsers = [
  {
    id: ADMIN_ID,
    username: 'DEMO-EMP-001',
    displayName: 'Meera Shah',
    role: 'Admin',
    isActive: true,
    locationLabels: ['Main gate', 'Dispatch gate'],
  },
  {
    id: TARGET_ID,
    username: 'DEMO-EMP-003',
    displayName: 'Farah Ansari',
    role: 'Supervisor',
    isActive: true,
    locationLabels: ['Dispatch gate'],
  },
];

const locations = {
  kind: 'locations',
  masters: [
    { id: LOCATION_ID, kind: 'locations', label: 'Main gate', isActive: true },
    { id: OTHER_LOCATION_ID, kind: 'locations', label: 'Dispatch gate', isActive: true },
  ],
};

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

interface Calls {
  creates: Array<Record<string, unknown>>;
  deactivates: string[];
  reactivates: string[];
}

function stubApi() {
  const calls: Calls = { creates: [], deactivates: [], reactivates: [] };
  let users = initialUsers.map((user) => ({ ...user }));

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'];

    if (url.includes('/auth/login') && method === 'POST') {
      return jsonResponse({ token: TOKEN, ...session }, 200);
    }
    if (url.includes('/auth/logout') && method === 'POST') return NO_CONTENT();
    if (url.includes('/auth/session')) {
      return auth === `Bearer ${TOKEN}`
        ? jsonResponse(session, 200)
        : jsonResponse({ error: 'unauthenticated', message: 'Sign in required.' }, 401);
    }
    if (url.endsWith('/masters/locations') && method === 'GET') {
      return jsonResponse(locations, 200);
    }
    if (url.endsWith('/admin/users') && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      calls.creates.push(body);
      const created = {
        id: '00000000-0000-4000-8000-0000000000a3',
        username: String(body['username']),
        displayName: String(body['displayName']),
        role: String(body['role']),
        isActive: true,
        locationLabels: ['Main gate'],
      };
      users = [...users, created];
      return jsonResponse({ user: created }, 201);
    }
    if (url.includes('/deactivate') && method === 'POST') {
      const id = url.split('/admin/users/')[1]?.split('/')[0] as string;
      calls.deactivates.push(id);
      users = users.map((user) => (user.id === id ? { ...user, isActive: false } : user));
      return NO_CONTENT();
    }
    if (url.includes('/reactivate') && method === 'POST') {
      const id = url.split('/admin/users/')[1]?.split('/')[0] as string;
      calls.reactivates.push(id);
      users = users.map((user) => (user.id === id ? { ...user, isActive: true } : user));
      return NO_CONTENT();
    }
    if (url.endsWith('/admin/users') && method === 'GET') {
      return jsonResponse({ users }, 200);
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
  return { fetchMock, calls };
}

async function openUsers() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/username/i), 'DEMO-EMP-001');
  await user.type(screen.getByLabelText('Password', { exact: true }), 'planner-demo-secret');
  await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
  await screen.findByRole('heading', { name: /demo review workspace/i });
  await user.click(await screen.findByRole('tab', { name: 'Users' }));
  await screen.findByText('Farah Ansari');
  return user;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Admin create user', () => {
  it('creates a Supervisor with a role, location and confirmed initial password', async () => {
    const { calls } = stubApi();
    render(<App />);
    const user = await openUsers();

    await user.click(screen.getByRole('button', { name: 'Create user' }));
    const dialog = await screen.findByRole('dialog', { name: /create user/i });

    await user.type(within(dialog).getByLabelText(/^username/i), 'SUP-EMP-010');
    await user.type(within(dialog).getByLabelText(/^display name/i), 'Nina Rao');
    await user.type(within(dialog).getByLabelText(/employee id/i), 'EMP-101');

    await user.click(within(dialog).getByLabelText(/^role/i));
    await user.click(await screen.findByRole('option', { name: 'Supervisor' }));

    await user.click(within(dialog).getByLabelText(/^locations/i));
    await user.click(await screen.findByRole('option', { name: 'Main gate' }));
    await user.keyboard('{Escape}');

    await user.type(
      within(dialog).getByLabelText(/^initial password/i),
      'a-valid-initial-password',
    );
    await user.type(
      within(dialog).getByLabelText(/^confirm initial password/i),
      'a-valid-initial-password',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }));

    await waitFor(() => {
      expect(calls.creates).toHaveLength(1);
    });
    expect(calls.creates[0]).toStrictEqual({
      username: 'SUP-EMP-010',
      displayName: 'Nina Rao',
      employeeId: 'EMP-101',
      role: 'Supervisor',
      locationIds: [LOCATION_ID],
      password: 'a-valid-initial-password',
    });
    expect(await screen.findByText('Nina Rao')).toBeInTheDocument();
    expect(await screen.findByText(/user created/i)).toBeInTheDocument();
  });

  it('blocks missing fields, missing locations and mismatched passwords locally', async () => {
    const { calls } = stubApi();
    render(<App />);
    const user = await openUsers();

    await user.click(screen.getByRole('button', { name: 'Create user' }));
    const dialog = await screen.findByRole('dialog', { name: /create user/i });
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }));

    expect(await within(dialog).findByText(/enter a username/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/enter a display name/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a role.')).toBeInTheDocument();
    expect(within(dialog).getByText(/choose at least one location/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/at least 12 characters/i)).toBeInTheDocument();
    expect(calls.creates).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/^username/i), 'SUP-EMP-011');
    await user.type(within(dialog).getByLabelText(/^display name/i), 'Nina Rao');
    await user.click(within(dialog).getByLabelText(/^role/i));
    await user.click(await screen.findByRole('option', { name: 'Admin' }));
    await user.type(
      within(dialog).getByLabelText(/^initial password/i),
      'a-valid-initial-password',
    );
    await user.type(
      within(dialog).getByLabelText(/^confirm initial password/i),
      'a-different-password',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }));
    expect(await within(dialog).findByText(/do not match/i)).toBeInTheDocument();
    expect(calls.creates).toHaveLength(0);
  });
});

describe('Admin deactivate and reactivate', () => {
  it('confirms deactivation, then reactivates the same retained account', async () => {
    const { calls } = stubApi();
    render(<App />);
    const user = await openUsers();

    await user.click(screen.getByRole('button', { name: 'Deactivate DEMO-EMP-003' }));
    const confirm = await screen.findByRole('dialog', { name: /deactivate user/i });
    expect(within(confirm).getByText(/retained/i)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(calls.deactivates).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Deactivate DEMO-EMP-003' }));
    const retry = await screen.findByRole('dialog', { name: /deactivate user/i });
    await user.click(within(retry).getByRole('button', { name: 'Deactivate user' }));

    await waitFor(() => {
      expect(calls.deactivates).toStrictEqual([TARGET_ID]);
    });
    expect(
      await screen.findByRole('button', { name: 'Reactivate DEMO-EMP-003' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/user deactivated/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reactivate DEMO-EMP-003' }));
    await waitFor(() => {
      expect(calls.reactivates).toStrictEqual([TARGET_ID]);
    });
    expect(
      await screen.findByRole('button', { name: 'Deactivate DEMO-EMP-003' }),
    ).toBeInTheDocument();
  });

  it('disables self-deactivation with an explanation', async () => {
    stubApi();
    render(<App />);
    await openUsers();

    expect(screen.getByRole('button', { name: 'Deactivate DEMO-EMP-001' })).toBeDisabled();
    expect(screen.getByText(/cannot deactivate your own account/i)).toBeInTheDocument();
  });
});
