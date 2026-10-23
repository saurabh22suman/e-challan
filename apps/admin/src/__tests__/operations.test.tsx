import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

/**
 * Planner-owned component acceptance for the bounded review/user-administration
 * slice (`specs/009-review-admin-basics`). Covers the Supervisor review surface
 * and the Admin user-reset surface against a contract-faithful fetch stand-in.
 * Real API behavior is covered by the API integration suite.
 */

const TOKEN = 'd'.repeat(64);
const SUPERVISOR_ID = '00000000-0000-4000-8000-0000000000a1';
const ADMIN_ID = '00000000-0000-4000-8000-0000000000a2';
const CHALLAN_ID = '00000000-0000-4000-8000-0000000000b1';
const LOCATION_ID = '00000000-0000-4000-8000-0000000000c1';
const TARGET_ID = '00000000-0000-4000-8000-0000000000d1';

const identity = (role: 'Supervisor' | 'Admin', id: string) => ({
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: {
    id,
    username: role === 'Admin' ? 'DEMO-EMP-001' : 'DEMO-EMP-002',
    role,
  },
  post: null,
  shift: null,
});

const summary = {
  id: CHALLAN_ID,
  challanNumber: 'DEMO/2026/10/0005',
  status: 'Issued' as const,
  severity: 'Major' as const,
  occurrenceNumber: 1,
  recommendedAction: 'warning_issued' as const,
  gatePassNumber: 'DEMO-GP-0001',
  vehicleRegistrationNumber: 'GJ05DS4821',
  driverName: 'Ramesh Kumar',
  locationId: LOCATION_ID,
  locationLabel: 'Main gate',
  issuedAt: '2026-10-01T05:30:00.000Z',
};

interface DetailFixture {
  id: string;
  challanNumber: string;
  status: 'Issued' | 'Under Review' | 'Resolved';
  severity: 'Major';
  occurrenceNumber: number;
  recommendedAction: string;
  gatePassNumber: string;
  vehicleRegistrationNumber: string;
  driverName: string;
  locationId: string;
  locationLabel: string;
  issuedAt: string;
  issuedBy: { id: string; username: string; displayName: string };
  departmentLabel: string;
  contractorLabel: string | null;
  vehicleTypeLabel: string;
  gateLabel: string;
  remarks: string | null;
  violations: Array<{ label: string; severity: string }>;
  actions: Array<{
    id: string;
    toStatus: string;
    action: string | null;
    remarks: string | null;
    reason: string | null;
    performerUserId: string;
    performerUsername: string;
    performerDisplayName: string;
    createdAt: string;
  }>;
  reopenedAt: string | null;
  reopenedByUserId: string | null;
  reopeningReason: string | null;
  cancellationReason: string | null;
}

const detail = (status: DetailFixture['status'] = 'Issued'): DetailFixture => ({
  ...summary,
  status,
  issuedBy: {
    id: '00000000-0000-4000-8000-0000000000f1',
    username: 'DEMO-EMP-004',
    displayName: 'Ravi Patel',
  },
  departmentLabel: 'Logistics',
  contractorLabel: 'West Contractors',
  vehicleTypeLabel: 'Car',
  gateLabel: 'Gate 1 — main entry',
  remarks: 'Synthetic issued remark.',
  violations: [{ label: 'No seatbelt', severity: 'Major' }],
  actions:
    status === 'Issued'
      ? []
      : [
          {
            id: '00000000-0000-4000-8000-0000000000e1',
            toStatus: 'Under Review',
            action: null,
            remarks: null,
            reason: null,
            performerUserId: SUPERVISOR_ID,
            performerUsername: 'DEMO-EMP-002',
            performerDisplayName: 'Sunil Deshmukh',
            createdAt: '2026-10-02T05:30:00.000Z',
          },
        ],
  reopenedAt: null,
  reopenedByUserId: null,
  reopeningReason: null,
  cancellationReason: null,
});

const users = [
  {
    id: ADMIN_ID,
    username: 'DEMO-EMP-001',
    displayName: 'Meera Shah',
    role: 'Admin',
    isActive: true,
    locationLabels: ['Main gate', 'Dispatch gate'],
  },
  {
    id: SUPERVISOR_ID,
    username: 'DEMO-EMP-002',
    displayName: 'Sunil Deshmukh',
    role: 'Supervisor',
    isActive: true,
    locationLabels: ['Main gate'],
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

interface FetchCalls {
  listUrls: string[];
  reviewBodies: Array<{ url: string; body: Record<string, unknown> }>;
  resetBodies: Array<{ url: string; body: Record<string, unknown> }>;
}

function stubApi(options: { role?: 'Supervisor' | 'Admin'; listStatus?: number } = {}) {
  const role = options.role ?? 'Supervisor';
  const session = identity(role, role === 'Admin' ? ADMIN_ID : SUPERVISOR_ID);
  const calls: FetchCalls = { listUrls: [], reviewBodies: [], resetBodies: [] };
  let currentDetail: DetailFixture = detail();

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
    if (url.includes('/admin/users/') && url.endsWith('/reset-password') && method === 'POST') {
      calls.resetBodies.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
      return NO_CONTENT();
    }
    if (url.endsWith('/admin/users') && method === 'GET') {
      return jsonResponse({ users }, 200);
    }
    if (url.includes('/review') && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      calls.reviewBodies.push({ url, body });
      currentDetail =
        body['to'] === 'Resolved'
          ? {
              ...currentDetail,
              status: 'Resolved',
              actions: [
                ...currentDetail.actions,
                {
                  id: '00000000-0000-4000-8000-0000000000e2',
                  toStatus: 'Resolved',
                  action: String(body['action']),
                  remarks: String(body['remarks']),
                  reason: null,
                  performerUserId: SUPERVISOR_ID,
                  performerUsername: 'DEMO-EMP-002',
                  performerDisplayName: 'Sunil Deshmukh',
                  createdAt: '2026-10-03T05:30:00.000Z',
                },
              ],
            }
          : {
              ...currentDetail,
              status: 'Under Review',
              actions: [
                ...currentDetail.actions,
                {
                  id: '00000000-0000-4000-8000-0000000000e3',
                  toStatus: 'Under Review',
                  action: null,
                  remarks: null,
                  reason: null,
                  performerUserId: SUPERVISOR_ID,
                  performerUsername: 'DEMO-EMP-002',
                  performerDisplayName: 'Sunil Deshmukh',
                  createdAt: '2026-10-03T05:30:00.000Z',
                },
              ],
            };
      return jsonResponse(currentDetail, 200);
    }
    if (url.includes('/challans/report') && method === 'GET') {
      calls.listUrls.push(url);
      if (options.listStatus !== undefined && options.listStatus !== 200) {
        return jsonResponse(
          { error: 'internal_error', message: 'Something went wrong.' },
          options.listStatus,
        );
      }
      return jsonResponse(
        {
          items: [summary],
          page: 1,
          pageSize: 25,
          total: 1,
          totals: { total: 1, issuedToday: 0, pending: 1, resolved: 0, repeatOffenders: 0 },
        },
        200,
      );
    }
    if (/\/challans\/[0-9a-f-]+$/.test(url) && method === 'GET') {
      return jsonResponse(currentDetail, 200);
    }
    if (url.includes('/challans') && method === 'GET') {
      calls.listUrls.push(url);
      if (options.listStatus !== undefined && options.listStatus !== 200) {
        return jsonResponse(
          { error: 'internal_error', message: 'Something went wrong.' },
          options.listStatus,
        );
      }
      return jsonResponse({ items: [summary] }, 200);
    }
    return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

async function signIn(role: 'Supervisor' | 'Admin' = 'Supervisor') {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText(/username/i),
    role === 'Admin' ? 'DEMO-EMP-001' : 'DEMO-EMP-002',
  );
  await user.type(screen.getByLabelText('Password', { exact: true }), 'planner-demo-secret');
  await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
  await screen.findByRole('heading', { name: /demo review workspace/i });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Supervisor review surface', () => {
  it('loads the scoped list, filters by status and opens the detail with history', async () => {
    const { calls } = stubApi();
    render(<App />);
    await signIn('Supervisor');

    expect(await screen.findByText('DEMO/2026/10/0005')).toBeInTheDocument();
    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
    expect(screen.getByText('Main gate')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Users' })).not.toBeInTheDocument();
    expect(calls.listUrls[0]).toContain('/api/challans');

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Filter by status'));
    await user.click(await screen.findByRole('option', { name: 'Issued' }));
    await waitFor(() => {
      expect(calls.listUrls.at(-1)).toContain('status=Issued');
    });

    await user.click(screen.getByRole('button', { name: 'Open DEMO/2026/10/0005' }));
    const dialog = await screen.findByRole('dialog', { name: /challan details/i });
    expect(within(dialog).getByText(/No seatbelt/)).toBeInTheDocument();
    expect(within(dialog).getByText('Synthetic issued remark.')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: /tracking history/i })).toBeInTheDocument();
  });

  it('searches the review queue and persists a saved triage view', async () => {
    const { calls } = stubApi();
    render(<App />);
    await signIn('Admin');

    const user = userEvent.setup();
    const search = await screen.findByLabelText('Search challans');
    await user.type(search, '0005');
    await waitFor(() => {
      expect(calls.listUrls.at(-1)).toContain('search=0005');
    });
    await user.clear(search);

    await user.click(screen.getByRole('button', { name: 'Needs attention' }));
    await waitFor(() => {
      expect(calls.listUrls.at(-1)).toContain('status=Under');
    });
    await user.click(screen.getByRole('button', { name: 'Save current view' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save current view' });
    await user.type(within(dialog).getByLabelText('View name'), 'Needs review');
    await user.click(within(dialog).getByRole('button', { name: 'Save view' }));

    await waitFor(() => {
      expect(localStorage.getItem('echallan.admin.report-views.v1')).toContain('Needs review');
    });
    await user.click(screen.getByLabelText('Saved view'));
    expect(await screen.findByRole('option', { name: 'Needs review' })).toBeInTheDocument();
  });

  it('starts review and resolves only with an action and nonblank remarks', async () => {
    const { calls } = stubApi();
    render(<App />);
    await signIn('Supervisor');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open DEMO/2026/10/0005' }));
    await screen.findByRole('dialog', { name: /challan details/i });

    await user.click(screen.getByRole('button', { name: 'Start review' }));
    await waitFor(() => {
      expect(calls.reviewBodies[0]?.body).toStrictEqual({ to: 'Under Review' });
    });

    // The action form is present and local validation blocks a blank resolution.
    await screen.findByLabelText(/^remarks/i);
    await user.click(screen.getByRole('button', { name: 'Resolve challan' }));
    expect(await screen.findByText(/select an action/i)).toBeInTheDocument();
    expect(calls.reviewBodies).toHaveLength(1);

    await user.click(screen.getByLabelText('Action taken'));
    await user.click(await screen.findByRole('option', { name: 'Warning issued' }));
    await user.type(screen.getByLabelText(/^remarks/i), 'Warning issued at the gate.');
    await user.click(screen.getByRole('button', { name: 'Resolve challan' }));

    await waitFor(() => {
      expect(calls.reviewBodies.at(-1)?.body).toStrictEqual({
        to: 'Resolved',
        action: 'warning_issued',
        remarks: 'Warning issued at the gate.',
      });
    });
    expect((await screen.findAllByText('Resolved')).length).toBeGreaterThan(0);
  });

  it('shows a persistent, non-alert notice when the list cannot load', async () => {
    stubApi({ listStatus: 500 });
    render(<App />);
    await signIn('Supervisor');

    const notice = await screen.findByText(/something went wrong/i);
    expect(notice.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Admin user administration', () => {
  it('shows the Users tab only for an Admin and lists users without password material', async () => {
    stubApi({ role: 'Admin' });
    render(<App />);
    await signIn('Admin');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Users' }));
    expect(await screen.findByText('Farah Ansari')).toBeInTheDocument();
    expect(screen.queryByText(/argon2/i)).not.toBeInTheDocument();
  });

  it('validates and submits a password reset from the dialog', async () => {
    const { calls } = stubApi({ role: 'Admin' });
    render(<App />);
    await signIn('Admin');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Users' }));
    await user.click(
      await screen.findByRole('button', { name: 'Reset password for DEMO-EMP-003' }),
    );

    const dialog = await screen.findByRole('dialog', { name: /reset password/i });
    const newPassword = within(dialog).getByLabelText(/^new password/i);
    const confirmPassword = within(dialog).getByLabelText(/^confirm new password/i);

    await user.type(newPassword, 'short');
    await user.type(confirmPassword, 'different');
    await user.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    expect(await within(dialog).findByText(/at least 12/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/do not match/i)).toBeInTheDocument();
    expect(calls.resetBodies).toHaveLength(0);

    await user.clear(newPassword);
    await user.clear(confirmPassword);
    await user.type(newPassword, 'a-valid-reset-password');
    await user.type(confirmPassword, 'a-valid-reset-password');
    await user.click(within(dialog).getByRole('button', { name: 'Reset password' }));

    await waitFor(() => {
      expect(calls.resetBodies).toHaveLength(1);
    });
    expect(calls.resetBodies[0]?.body).toStrictEqual({ password: 'a-valid-reset-password' });
    expect(await screen.findByText(/password reset/i)).toBeInTheDocument();
  });

  it('signs the Admin out after resetting their own password', async () => {
    stubApi({ role: 'Admin' });
    render(<App />);
    await signIn('Admin');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Users' }));
    await user.click(
      await screen.findByRole('button', { name: 'Reset password for DEMO-EMP-001' }),
    );
    const dialog = await screen.findByRole('dialog', { name: /reset password/i });
    await user.type(within(dialog).getByLabelText(/^new password/i), 'a-valid-reset-password');
    await user.type(
      within(dialog).getByLabelText(/^confirm new password/i),
      'a-valid-reset-password',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /demo review workspace/i }),
    ).not.toBeInTheDocument();
  });
});
