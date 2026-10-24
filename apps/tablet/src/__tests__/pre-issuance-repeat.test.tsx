import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

/**
 * Planner-owned pre-issuance acceptance (REP-03/04/05) at component level: the
 * persistent repeat/duplicate notices, explicit acknowledgement and invalidation
 * after material changes or a changed re-preview.
 *
 * Read-only planner input. Do not replace, skip or weaken these assertions.
 */

const MARSHAL = { username: 'EMP-3106', password: 'planner-demo-marshal-secret' };
const TOKEN = 'a'.repeat(64);
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

const preview = (overrides: Record<string, unknown> = {}) => ({
  severity: 'Minor',
  occurrenceNumber: 1,
  recommendedAction: 'warning_issued',
  duplicateWarning: { required: false, matchedCount: 0 },
  windowDays: 90,
  windowMinutes: 15,
  ...overrides,
});

function stubApi(previewResponses: unknown[]) {
  let previewCalls = 0;
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
      const kind = url.split('/api/masters/')[1]?.split('?')[0] ?? '';
      return jsonResponse(CATALOGUES[kind] ?? { kind, masters: [] }, 200);
    }
    if (url.includes('/registry/lookup')) return jsonResponse({ matches: [] }, 200);
    if (url.includes('/challans/validate')) {
      return jsonResponse({ severity: 'Minor', otherFields: [] }, 200);
    }
    if (url.includes('/challans/preview')) {
      const response = previewResponses[Math.min(previewCalls, previewResponses.length - 1)];
      previewCalls += 1;
      return jsonResponse(response, 200);
    }
    return jsonResponse({ error: 'not_found', message: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderSignedIn() {
  render(<App />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/username/i), MARSHAL.username);
  await user.type(screen.getByLabelText('Password', { exact: true }), MARSHAL.password);
  await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
  await screen.findByLabelText('Vehicle registration');
}

async function fillMinimalDraft() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Vehicle registration'), 'GJ05JP6207');
  await user.type(screen.getByLabelText('Gate pass number'), 'HZ-GP-1051');
  await user.type(screen.getByLabelText('Driver name'), 'Kavita Joshi');
  await user.selectOptions(screen.getByLabelText('Department'), IDS.department);
  await user.selectOptions(screen.getByLabelText('Vehicle type'), IDS.vehicleType);
  await user.click(screen.getByRole('checkbox', { name: 'Not wearing a seat belt' }));
  return user;
}

const reviewSummary = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /check details/i }));
  return user;
};

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  // Allow outstanding microtasks (e.g. fetch rejections) to settle so
  // they do not bleed into the next test.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('pre-issuance repeat and duplicate notices (REP-03/04/05)', () => {
  // EM-09 follow-up: the previous run timed out at 5s on renderSignedIn when
  // the previous test's catalogues or lookup state was still resolving. The
  // bounded tests below now use a longer per-test timeout; per-case
  // renderSignedIn awaits the standard <Vehicle registration> label.
  const CASE_TIMEOUT = 15_000;
  it(
    'shows a persistent occurrence and prescribed-action notice before the summary',
    async () => {
      stubApi([
        preview({ occurrenceNumber: 5, recommendedAction: 'referred_to_department_contractor' }),
      ]);
      await renderSignedIn();
      await fillMinimalDraft();
      await reviewSummary();

      const notice = await screen.findByText(/occurrence\s*5/i);
      expect(notice).toBeInTheDocument();
      expect(screen.getByText(/referred to department\/contractor/i)).toBeInTheDocument();

      // Persistent, not a transient toast: it is still present after a settle.
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(screen.getByText(/occurrence\s*5/i)).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: /driver summary/i })).toBeInTheDocument();
    },
    CASE_TIMEOUT,
  );

  it(
    'does not require acknowledgement when no duplicate exists',
    async () => {
      stubApi([preview()]);
      await renderSignedIn();
      await fillMinimalDraft();
      await reviewSummary();

      expect(await screen.findByRole('heading', { name: /driver summary/i })).toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', { name: /acknowledge the duplicate warning/i }),
      ).not.toBeInTheDocument();
    },
    CASE_TIMEOUT,
  );

  it(
    'requires an explicit duplicate acknowledgement before the summary can proceed',
    async () => {
      stubApi([preview({ duplicateWarning: { required: true, matchedCount: 1 } })]);
      await renderSignedIn();
      await fillMinimalDraft();

      const user = await reviewSummary();
      expect(screen.queryByRole('heading', { name: /driver summary/i })).not.toBeInTheDocument();
      const warning = await screen.findByRole('alert');
      expect(warning).toHaveTextContent(/already recorded at this location/i);

      await user.click(
        screen.getByRole('checkbox', { name: /acknowledge the duplicate warning/i }),
      );
      await user.click(screen.getByRole('button', { name: /check details/i }));
      expect(await screen.findByRole('heading', { name: /driver summary/i })).toBeInTheDocument();
      // The warning remains visible on the summary as a persistent notice.
      expect(screen.getByRole('alert')).toHaveTextContent(/already recorded at this location/i);
    },
    CASE_TIMEOUT,
  );

  it(
    'invalidates the acknowledgement when a material input changes',
    async () => {
      stubApi([
        preview({ duplicateWarning: { required: true, matchedCount: 1 } }),
        preview({ duplicateWarning: { required: true, matchedCount: 1 } }),
      ]);
      await renderSignedIn();
      await fillMinimalDraft();

      const user = await reviewSummary();
      await user.click(
        screen.getByRole('checkbox', { name: /acknowledge the duplicate warning/i }),
      );

      // A material change clears the acknowledgement and the summary state.
      await user.clear(screen.getByLabelText('Driver name'));
      await user.type(screen.getByLabelText('Driver name'), 'Kavita J.');
      expect(
        screen.getByRole('checkbox', { name: /acknowledge the duplicate warning/i }),
        'a changed draft must not keep a stale acknowledgement',
      ).not.toBeChecked();

      await user.click(screen.getByRole('button', { name: /check details/i }));
      expect(screen.queryByRole('heading', { name: /driver summary/i })).not.toBeInTheDocument();
    },
    CASE_TIMEOUT,
  );

  it(
    'reflects a changed re-preview after new history',
    async () => {
      stubApi([
        preview({ occurrenceNumber: 1, recommendedAction: 'warning_issued' }),
        preview({
          occurrenceNumber: 3,
          recommendedAction: 'referred_to_department_contractor',
          duplicateWarning: { required: true, matchedCount: 1 },
        }),
      ]);
      await renderSignedIn();
      await fillMinimalDraft();
      await reviewSummary();
      expect(await screen.findByText(/occurrence\s*1/i)).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^change details$/i }));
      await user.clear(screen.getByLabelText('Remarks'));
      await user.type(screen.getByLabelText('Remarks'), 'Changed after preview');
      await user.click(screen.getByRole('button', { name: /check details/i }));

      expect(await screen.findByText(/occurrence\s*3/i)).toBeInTheDocument();
      expect(screen.getByText(/referred to department\/contractor/i)).toBeInTheDocument();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        /already recorded at this location/i,
      );
    },
    CASE_TIMEOUT,
  );
});
