import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

/**
 * F-04 shell acceptance for the marshal tablet (UI-01/UI-03, component layer).
 *
 * F-04 revision: the foundation screen is replaced by the approved role shell and
 * the lazy entry flow. The substantive checks are preserved — the shell renders
 * only for an authenticated session, the screen is labelled, and a contract-invalid
 * master payload is reported rather than rendered. Read-only planner input.
 */

const TOKEN = 'a'.repeat(64);
const MARSHAL = { username: 'EMP-3106', password: 'planner-demo-marshal-secret' };
const ID = (suffix: string): string => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;
const IDS = {
  user: ID('1'),
  post: ID('2'),
  shift: ID('3'),
  department: ID('4'),
  contractor: ID('7'),
  vehicleType: ID('8'),
  violation: ID('10'),
} as const;

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
  user: { id: IDS.user, username: 'EMP-3106', role: 'Marshal' },
  post: { id: IDS.post, label: 'Main Gate Post' },
  shift: { id: IDS.shift, label: 'A Shift (06:00–14:00)' },
};

const catalogue = (kind: string, rows: Array<{ id: string; label: string }>) => ({
  kind,
  masters: rows.map((row) => ({ ...row, kind, isActive: true })),
});

const CATALOGUES: Record<string, unknown> = {
  departments: catalogue('departments', [{ id: IDS.department, label: 'Logistics' }]),
  contractors: catalogue('contractors', [{ id: IDS.contractor, label: 'Demo Western Freight' }]),
  'vehicle-types': catalogue('vehicle-types', [{ id: IDS.vehicleType, label: 'Car' }]),
  'violation-types': {
    kind: 'violation-types',
    masters: [
      {
        id: IDS.violation,
        kind: 'violation-types',
        label: 'Not wearing a seat belt',
        isActive: true,
        severity: 'Minor',
        defaultAction: null,
      },
    ],
  },
};

const stubApi = (options: { masterStatus?: number } = {}) => {
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
    if (url.includes('/api/masters/')) {
      if (options.masterStatus !== undefined && options.masterStatus !== 200) {
        return jsonResponse(
          { error: 'internal_error', message: 'Something went wrong.' },
          options.masterStatus,
        );
      }
      const kind = url.split('/api/masters/')[1]?.split('?')[0] ?? '';
      return jsonResponse(CATALOGUES[kind] ?? { kind, masters: [] }, 200);
    }
    return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

async function renderSignedIn() {
  render(<App />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/username/i), MARSHAL.username);
  await user.type(screen.getByLabelText('Password', { exact: true }), MARSHAL.password);
  await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
  await screen.findByLabelText('Vehicle registration');
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('tablet shell (F-04)', () => {
  it('renders the labelled marshal shell with the lazy entry flow', async () => {
    stubApi();
    await renderSignedIn();

    expect(
      screen.getByRole('heading', { name: /create new safety violation/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Vehicle registration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check details/i })).toBeInTheDocument();
  });

  it('reports a master-catalogue failure instead of rendering an invented option', async () => {
    stubApi({ masterStatus: 500 });
    render(<App />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/username/i), MARSHAL.username);
    await user.type(screen.getByLabelText('Password', { exact: true }), MARSHAL.password);
    await user.click(screen.getByRole('button', { name: /sign in|log in/i }));

    expect(await screen.findByText(/couldn't load|try again/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Vehicle registration')).not.toBeInTheDocument();
  });

  it('logs out from the shell and returns to the login screen', async () => {
    stubApi();
    await renderSignedIn();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /log ?out|sign out/i }));
    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /create new safety violation/i }),
    ).not.toBeInTheDocument();
  });
});
