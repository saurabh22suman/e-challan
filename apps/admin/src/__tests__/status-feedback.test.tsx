import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser, ChallanStatus, ChallanSummary, MasterRecord } from '@echallan/contracts';
import App from '../App';

/**
 * Admin screen migration for docs/design.md §4–7: semantic status badges,
 * consequence-aware dialog headers and transient success feedback. Every test
 * drives the real screen through App so the shared ToastProvider is exercised.
 */

const TOKEN = 'c'.repeat(64);
const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
const TARGET_ID = '00000000-0000-4000-8000-0000000000a2';
const LOCATION_ID = '00000000-0000-4000-8000-0000000000c1';
const CHALLAN_IDS = [
  '00000000-0000-4000-8000-0000000000b1',
  '00000000-0000-4000-8000-0000000000b2',
  '00000000-0000-4000-8000-0000000000b3',
  '00000000-0000-4000-8000-0000000000b4',
];

const session = {
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: ADMIN_ID, username: 'DEMO-EMP-001', role: 'Admin' },
  post: null,
  shift: null,
};

const adminUser: AdminUser = {
  id: ADMIN_ID,
  username: 'DEMO-EMP-001',
  displayName: 'Meera Shah',
  role: 'Admin',
  isActive: true,
  locationLabels: ['Main gate'],
};

const activeTarget: AdminUser = {
  id: TARGET_ID,
  username: 'DEMO-EMP-003',
  displayName: 'Farah Ansari',
  role: 'Supervisor',
  isActive: true,
  locationLabels: ['Dispatch gate'],
};

const deactivatedTarget: AdminUser = { ...activeTarget, isActive: false };

const masterEntries: MasterRecord[] = [
  {
    id: '00000000-0000-4000-8000-0000000000e1',
    kind: 'violation-types',
    label: 'No helmet',
    isActive: true,
    severity: 'Major',
    defaultAction: 'warning_issued',
  },
  {
    id: '00000000-0000-4000-8000-0000000000e2',
    kind: 'violation-types',
    label: 'No seatbelt',
    isActive: false,
    severity: 'Minor',
    defaultAction: null,
  },
];

const summary = (index: number, status: ChallanStatus): ChallanSummary => ({
  id: CHALLAN_IDS[index] ?? CHALLAN_IDS[0]!,
  challanNumber: `DEMO/2026/10/000${index + 1}`,
  status,
  severity: 'Major',
  occurrenceNumber: 1,
  recommendedAction: 'warning_issued',
  gatePassNumber: `DEMO-GP-000${index + 1}`,
  vehicleRegistrationNumber: 'GJ05DS4821',
  driverName: 'Ramesh Kumar',
  locationId: LOCATION_ID,
  locationLabel: 'Main gate',
  issuedAt: '2026-10-01T05:30:00.000Z',
});

const challanDetail = (item: ChallanSummary, status: ChallanStatus = item.status) => ({
  ...item,
  status,
  departmentLabel: 'Logistics',
  contractorLabel: null,
  vehicleTypeLabel: 'Car',
  gateLabel: 'Gate 1 — main entry',
  issuedBy: {
    id: '00000000-0000-4000-8000-0000000000f1',
    username: 'DEMO-EMP-004',
    displayName: 'Ravi Patel',
  },
  remarks: 'Synthetic issued remark.',
  violations: [{ label: 'No seatbelt', severity: 'Major' as const }],
  actions:
    status === 'Issued'
      ? []
      : [
          {
            id: '00000000-0000-4000-8000-0000000000e9',
            toStatus: 'Under Review' as const,
            action: null,
            remarks: null,
            reason: null,
            performerUserId: ADMIN_ID,
            performerUsername: 'DEMO-EMP-001',
            performerDisplayName: 'Meera Shah',
            createdAt: '2026-10-02T05:30:00.000Z',
          },
        ],
  reopenedAt: null,
  reopenedByUserId: null,
  reopeningReason: null,
  cancellationReason: null,
});

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

interface Fixtures {
  users?: AdminUser[];
  masters?: MasterRecord[];
  challans?: ChallanSummary[];
}

function stubApi(fixtures: Fixtures = {}) {
  let users = (fixtures.users ?? [adminUser]).map((user) => ({ ...user }));
  const masters = fixtures.masters ?? [];
  const challans = fixtures.challans ?? [];
  const reviewBodies: Array<Record<string, unknown>> = [];

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
      return jsonResponse({ kind: 'locations', masters: [] }, 200);
    }
    if (url.includes('/admin/masters/') && method === 'GET') {
      return jsonResponse({ kind: 'violation-types', masters }, 200);
    }
    if (url.includes('/admin/users/') && url.endsWith('/deactivate') && method === 'POST') {
      const id = url.split('/admin/users/')[1]?.split('/')[0];
      users = users.map((user) => (user.id === id ? { ...user, isActive: false } : user));
      return NO_CONTENT();
    }
    if (url.includes('/admin/users/') && url.endsWith('/reactivate') && method === 'POST') {
      const id = url.split('/admin/users/')[1]?.split('/')[0];
      users = users.map((user) => (user.id === id ? { ...user, isActive: true } : user));
      return NO_CONTENT();
    }
    if (url.endsWith('/admin/users') && method === 'GET') {
      return jsonResponse({ users }, 200);
    }
    if (url.includes('/challans/report') && method === 'GET') {
      return jsonResponse(
        {
          items: challans,
          page: 1,
          pageSize: 25,
          total: challans.length,
          totals: {
            total: challans.length,
            issuedToday: 0,
            pending: 0,
            resolved: 0,
            repeatOffenders: 0,
          },
        },
        200,
      );
    }
    if (url.includes('/evidence') && method === 'GET') {
      return jsonResponse({ photos: [], signature: null, refusal: null }, 200);
    }
    if (url.includes('/review') && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      reviewBodies.push(body);
      const item = challans[0];
      if (item === undefined) {
        return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
      }
      return jsonResponse(
        challanDetail(item, body['to'] === 'Resolved' ? 'Resolved' : 'Under Review'),
        200,
      );
    }
    if (/\/challans\/[0-9a-f-]+$/u.test(url) && method === 'GET') {
      const item = challans[0];
      return item === undefined
        ? jsonResponse({ error: 'not_found', message: 'Not found.' }, 404)
        : jsonResponse(challanDetail(item), 200);
    }
    if (url.includes('/challans') && method === 'GET') {
      return jsonResponse({ items: challans }, 200);
    }
    return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, reviewBodies };
}

async function signIn() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/username/i), 'DEMO-EMP-001');
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

describe('admin status feedback', () => {
  it('uses distinct badges instead of Yes/No for user account state', async () => {
    stubApi({ users: [adminUser, deactivatedTarget] });
    render(<App />);
    const user = await signIn();

    await user.click(await screen.findByRole('tab', { name: 'Users' }));
    const table = await screen.findByRole('table', { name: 'Users' });

    const active = within(table).getByRole('status', { name: 'Active' });
    const deactivated = within(table).getByRole('status', { name: 'Deactivated' });

    expect(active).toHaveAttribute('data-tone', 'success');
    expect(deactivated).toHaveAttribute('data-tone', 'neutral');
    expect(active.getAttribute('data-tone')).not.toBe(deactivated.getAttribute('data-tone'));
    expect(within(table).queryByText(/^(Yes|No)$/u)).not.toBeInTheDocument();
  });

  it('keeps the master Inactive label on the neutral tone', async () => {
    stubApi({ masters: masterEntries });
    render(<App />);
    const user = await signIn();

    await user.click(await screen.findByRole('tab', { name: 'Masters' }));
    const table = await screen.findByRole('table', { name: 'Master data' });

    const active = within(table).getByRole('status', { name: 'Active' });
    const inactive = within(table).getByRole('status', { name: 'Inactive' });

    expect(active).toHaveAttribute('data-tone', 'success');
    expect(inactive).toHaveAttribute('data-tone', 'neutral');
  });

  it('maps every challan status in the list to a distinct semantic tone', async () => {
    stubApi({
      challans: [
        summary(0, 'Issued'),
        summary(1, 'Under Review'),
        summary(2, 'Resolved'),
        summary(3, 'Cancelled'),
      ],
    });
    render(<App />);
    await signIn();

    const table = await screen.findByRole('table', { name: 'Challans' });
    const expected: Array<[string, string]> = [
      ['Issued', 'info'],
      ['Under Review', 'warning'],
      ['Resolved', 'success'],
      ['Cancelled', 'cancelled'],
    ];

    for (const [label, tone] of expected) {
      expect(within(table).getByRole('status', { name: label })).toHaveAttribute('data-tone', tone);
    }
    const tones = expected.map(([label]) =>
      within(table).getByRole('status', { name: label }).getAttribute('data-tone'),
    );
    expect(new Set(tones).size).toBe(expected.length);
  });

  it('tones a destructive dialog and confirms with a success toast', async () => {
    stubApi({ users: [adminUser, activeTarget] });
    render(<App />);
    const user = await signIn();

    await user.click(await screen.findByRole('tab', { name: 'Users' }));
    await user.click(await screen.findByRole('button', { name: 'Deactivate DEMO-EMP-003' }));

    const dialog = await screen.findByRole('dialog', { name: /deactivate user/i });
    expect(within(dialog).getByRole('heading', { name: 'Deactivate user' })).toHaveAttribute(
      'data-tone',
      'danger',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Deactivate user' }));

    const toast = await screen.findByRole('status', { name: /user deactivated/i });
    expect(toast).toHaveAttribute('data-tone', 'success');
    expect(within(toast).getByText(/Farah Ansari/)).toBeInTheDocument();
  });

  it('shows a success toast after a completed review transition', async () => {
    const { reviewBodies } = stubApi({ challans: [summary(0, 'Issued')] });
    render(<App />);
    const user = await signIn();

    await user.click(await screen.findByRole('button', { name: 'Open DEMO/2026/10/0001' }));
    await screen.findByRole('dialog', { name: /challan details/i });
    await user.click(screen.getByRole('button', { name: 'Start review' }));

    expect(reviewBodies).toStrictEqual([{ to: 'Under Review' }]);

    // The detail modal marks background content aria-hidden, so close it before
    // asserting the transient toast through its accessibility role.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    const toast = await screen.findByRole('status', { name: 'Review started' });
    expect(toast).toHaveAttribute('data-tone', 'success');
  });
});
