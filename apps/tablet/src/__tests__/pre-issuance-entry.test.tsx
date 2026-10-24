import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

/**
 * Planner-owned pre-issuance acceptance (UI-01 labels, ENT-01–ENT-06) at component
 * level, against contract-shaped API stubs. The entry flow is lazy: missing
 * screens/exports are surface-absence RED at preparation.
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
  departmentInactive: ID('5'),
  departmentOther: ID('6'),
  contractor: ID('7'),
  vehicleType: ID('8'),
  vehicleTypeOther: ID('9'),
  violationSeatbelt: ID('10'),
  violationRoute: ID('11'),
  violationOther: ID('12'),
  passRecord: ID('13'),
  driver: ID('14'),
  vehicle: ID('15'),
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

const LOGIN_BODY = {
  token: TOKEN,
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: IDS.user, username: 'EMP-3106', role: 'Marshal' },
  post: { id: IDS.post, label: 'Main Gate Post' },
  shift: { id: IDS.shift, label: 'A Shift (06:00–14:00)' },
};

const SESSION_BODY = {
  expiresAt: LOGIN_BODY.expiresAt,
  user: LOGIN_BODY.user,
  post: LOGIN_BODY.post,
  shift: LOGIN_BODY.shift,
};

const catalogue = (
  kind: string,
  rows: Array<{ id: string; label: string; isActive: boolean }>,
) => ({
  kind,
  masters: rows.map((row) => ({ ...row, kind })),
});

const CATALOGUES: Record<string, unknown> = {
  departments: catalogue('departments', [
    { id: IDS.department, label: 'Logistics', isActive: true },
    { id: IDS.departmentOther, label: 'Other', isActive: true },
    { id: IDS.departmentInactive, label: 'Retired department', isActive: false },
  ]),
  contractors: catalogue('contractors', [
    { id: IDS.contractor, label: 'Demo Western Freight', isActive: true },
  ]),
  'vehicle-types': catalogue('vehicle-types', [
    { id: IDS.vehicleType, label: 'Car', isActive: true },
    { id: IDS.vehicleTypeOther, label: 'Other', isActive: true },
  ]),
  'violation-types': {
    kind: 'violation-types',
    masters: [
      {
        id: IDS.violationSeatbelt,
        kind: 'violation-types',
        label: 'Not wearing a seat belt',
        isActive: true,
        severity: 'Minor',
        defaultAction: null,
      },
      {
        id: IDS.violationRoute,
        kind: 'violation-types',
        label: 'Driving against the designated route',
        isActive: true,
        severity: 'Critical',
        defaultAction: null,
      },
      {
        id: IDS.violationOther,
        kind: 'violation-types',
        label: 'Other',
        isActive: true,
        severity: 'Minor',
        defaultAction: null,
      },
    ],
  },
};

const MATCH = {
  gatePassRecordId: IDS.passRecord,
  gatePassNumber: 'HZ-GP-1051',
  driverId: IDS.driver,
  driverName: 'Kavita Joshi',
  vehicleId: IDS.vehicle,
  vehicleRegistrationNumber: 'GJ05JP6207',
  vehicleTypeId: IDS.vehicleType,
  vehicleTypeLabel: 'Car',
  departmentId: IDS.department,
  departmentLabel: 'Logistics',
  contractorId: IDS.contractor,
  contractorLabel: 'Demo Western Freight',
  status: 'active',
  validUntil: null,
};

interface StubOptions {
  lookup?: (url: string) => Promise<Response> | Response;
  validate?: (body: Record<string, unknown>) => Promise<Response> | Response;
  preview?: (body: Record<string, unknown>) => Promise<Response> | Response;
}

const VALID_RESPONSE = { severity: 'Minor', otherFields: [] };
const PREVIEW_RESPONSE = {
  severity: 'Minor',
  occurrenceNumber: 1,
  recommendedAction: 'warning_issued',
  duplicateWarning: { required: false, matchedCount: 0 },
  windowDays: 90,
  windowMinutes: 15,
};

function stubApi(options: StubOptions = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'];
    const body =
      init?.body === undefined
        ? undefined
        : (JSON.parse(String(init.body)) as Record<string, unknown>);

    if (url.includes('/auth/login') && method === 'POST') return jsonResponse(LOGIN_BODY, 200);
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
    if (url.includes('/registry/lookup')) {
      return options.lookup === undefined
        ? jsonResponse({ matches: [] }, 200)
        : options.lookup(url);
    }
    if (url.includes('/challans/validate')) {
      return options.validate === undefined
        ? jsonResponse(VALID_RESPONSE, 200)
        : options.validate(body ?? {});
    }
    if (url.includes('/challans/preview')) {
      return options.preview === undefined
        ? jsonResponse(PREVIEW_RESPONSE, 200)
        : options.preview(body ?? {});
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

const typeInto = async (label: RegExp | string, value: string) => {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText(label));
  await user.type(screen.getByLabelText(label), value);
  return user;
};

const settle = async (ms = 400) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('pre-issuance entry flow (ENT-01–ENT-06, UI-01)', () => {
  it('renders the statically labelled full-width entry form', async () => {
    stubApi();
    await renderSignedIn();

    for (const label of [
      'Vehicle registration',
      'Gate pass number',
      'Driver name',
      'Department',
      'Contractor',
      'Vehicle type',
      'Remarks',
    ]) {
      expect(
        screen.getByLabelText(label),
        `${label} must have a visible label`,
      ).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: /violations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check details/i })).toBeInTheDocument();
    // The session-bound location is displayed read-only, never typed.
    expect(screen.queryByLabelText(/location/i)).not.toBeInTheDocument();
  });

  it('offers only active catalogue entries for controlled fields', async () => {
    stubApi();
    await renderSignedIn();

    const department = screen.getByLabelText('Department');
    expect(within(department).queryByRole('option', { name: 'Retired department' })).toBeNull();
    expect(within(department).getByRole('option', { name: 'Logistics' })).toBeInTheDocument();
    expect(within(department).getByRole('option', { name: 'Other' })).toBeInTheDocument();
  });

  it('normalises the registration and rejects an unsupported form with a specific error', async () => {
    stubApi();
    await renderSignedIn();

    const registration = screen.getByLabelText('Vehicle registration');
    const user = await typeInto('Vehicle registration', 'gj 05 jp 6207');
    await user.tab();
    expect(registration).toHaveValue('GJ05JP6207');

    await typeInto('Vehicle registration', 'GJ-05-JP');
    await user.tab();
    expect(
      screen.getAllByText(/should look like GJ05DS4821 or 26BH1234AA/i).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /check details/i }));
    expect(screen.queryByRole('heading', { name: /driver summary/i })).not.toBeInTheDocument();
  });

  it('does not request suggestions before three characters and does request them after', async () => {
    const fetchMock = stubApi();
    await renderSignedIn();

    const lookupUrls = () =>
      fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('/registry/lookup'));
    // B-08 test-baseline revision (owner decision 2026-10-17): the vehicle
    // control is a searchable dropdown. Focusing/clicking it loads the
    // location list (empty q); two typed characters must still start no
    // *search* (q with 1-2 characters), and three or more must search.
    const searches = () => lookupUrls().filter((url) => !/[?&]q=$/.test(url));

    await typeInto('Vehicle registration', 'GJ');
    await settle();
    expect(searches(), 'two characters must not trigger a search').toHaveLength(0);

    await typeInto('Vehicle registration', 'GJ0');
    await settle();
    expect(searches().length).toBeGreaterThan(0);
  });

  it('fills known fields from a chosen suggestion and keeps them editable', async () => {
    stubApi({ lookup: () => jsonResponse({ matches: [MATCH] }, 200) });
    await renderSignedIn();

    await typeInto('Vehicle registration', 'GJ05JP6207');
    const option = await screen.findByRole('option', { name: /Kavita Joshi.*HZ-GP-1051/ });
    const user = userEvent.setup();
    await user.click(option);

    expect(screen.getByLabelText('Driver name')).toHaveValue('Kavita Joshi');
    expect(screen.getByLabelText('Gate pass number')).toHaveValue('HZ-GP-1051');
    expect(screen.getByLabelText('Department')).toHaveValue(IDS.department);
    expect(screen.getByLabelText('Vehicle type')).toHaveValue(IDS.vehicleType);

    // Approved edits remain possible after autofill.
    await typeInto('Driver name', 'Kavita J.');
    expect(screen.getByLabelText('Driver name')).toHaveValue('Kavita J.');
  });

  it('lists the location vehicles when the dropdown is opened, without a search', async () => {
    const fetchMock = stubApi({
      lookup: (url) =>
        /[?&]q=$/.test(url)
          ? jsonResponse({ matches: [MATCH] }, 200)
          : jsonResponse({ matches: [] }, 200),
    });
    await renderSignedIn();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Vehicle registration'));
    const listbox = await screen.findByRole('listbox', { name: /registry suggestions/i });
    expect(
      within(listbox).getByRole('option', { name: /Kavita Joshi.*HZ-GP-1051/ }),
    ).toBeInTheDocument();

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(
      urls.some((url) => url.includes('field=registration') && /[?&]q=$/.test(url)),
      'opening the dropdown uses the list mode (empty query)',
    ).toBe(true);
    expect(
      urls.some((url) => url.includes('/registry/lookup') && !/[?&]q=$/.test(url)),
      'opening the dropdown must not run a typed search',
    ).toBe(false);
  });

  it('offers one-off new vehicle entry that proceeds without registry provenance', async () => {
    let seenBody: unknown = null;
    stubApi({
      validate: (body) => {
        seenBody = body;
        return jsonResponse(VALID_RESPONSE, 200);
      },
      preview: () => jsonResponse(PREVIEW_RESPONSE, 200),
    });
    await renderSignedIn();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Vehicle registration'));
    await user.click(await screen.findByTestId('vehicle-new-entry'));
    expect(await screen.findByText(/manual entry\./i)).toBeInTheDocument();

    await typeInto('Vehicle registration', 'GJ99XX9999');
    await typeInto('Gate pass number', 'HZ-GP-9999');
    await typeInto('Driver name', 'New Driver');
    await user.selectOptions(screen.getByLabelText('Department'), IDS.department);
    await user.selectOptions(screen.getByLabelText('Vehicle type'), IDS.vehicleType);
    await user.click(screen.getByRole('checkbox', { name: 'Not wearing a seat belt' }));
    await user.click(screen.getByRole('button', { name: /check details/i }));

    expect(await screen.findByRole('heading', { name: /driver summary/i })).toBeInTheDocument();
    expect(seenBody).not.toBeNull();
    expect((seenBody as { registry: unknown }).registry).toBeNull();
    expect(screen.getByText('Manual entry', { exact: true })).toBeInTheDocument();
  });

  it('requires an explicit driver choice when a vehicle has several passes', async () => {
    const second = {
      ...MATCH,
      gatePassRecordId: ID('20'),
      gatePassNumber: 'HZ-GP-1047',
      driverId: ID('21'),
      driverName: 'Sanjay Patil',
      contractorId: null,
      contractorLabel: null,
    };
    stubApi({ lookup: () => jsonResponse({ matches: [MATCH, second] }, 200) });
    await renderSignedIn();

    await typeInto('Vehicle registration', 'MH12RT7306');
    const listbox = await screen.findByRole('listbox', { name: /registry suggestions/i });
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(2);
    const user = userEvent.setup();
    await user.click(screen.getByRole('option', { name: /Sanjay Patil.*HZ-GP-1047/ }));
    expect(screen.getByLabelText('Driver name')).toHaveValue('Sanjay Patil');
    expect(screen.getByLabelText('Gate pass number')).toHaveValue('HZ-GP-1047');
  });

  it('shows an expiry notice for an expired registry match', async () => {
    const expired = {
      ...MATCH,
      gatePassNumber: 'HZ-GP-1049',
      status: 'expired',
      validUntil: '2026-09-25T00:00:00.000Z',
    };
    stubApi({ lookup: () => jsonResponse({ matches: [expired] }, 200) });
    await renderSignedIn();

    await typeInto('Gate pass number', 'HZ-GP-1049');
    const option = await screen.findByRole('option', { name: /Kavita Joshi.*HZ-GP-1049/ });
    const user = userEvent.setup();
    await user.click(option);
    expect(await screen.findByText(/expired/i)).toBeInTheDocument();
  });

  it('surfaces lookup failure with a retry that recovers', async () => {
    // B-08 test-baseline revision (owner decision 2026-10-17): the open/click
    // list request (empty q) is separate from a typed search. Only the first
    // *search* fails here; the list request succeeds and the retry recovers.
    let searchAttempt = 0;
    stubApi({
      lookup: (url) => {
        if (/[?&]q=$/.test(url)) return jsonResponse({ matches: [] }, 200);
        searchAttempt += 1;
        return searchAttempt === 1
          ? jsonResponse({ error: 'internal_error', message: 'Something went wrong.' }, 500)
          : jsonResponse({ matches: [MATCH] }, 200);
      },
    });
    await renderSignedIn();

    await typeInto('Vehicle registration', 'GJ05JP6207');
    expect(await screen.findByText(/couldn't load the registry|try again/i)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('option', { name: /Kavita Joshi/ })).toBeInTheDocument();
  });

  it('shows an empty-result notice and never invents a match', async () => {
    stubApi({ lookup: () => jsonResponse({ matches: [] }, 200) });
    await renderSignedIn();

    await typeInto('Vehicle registration', 'GJ99XX9999');
    expect(await screen.findByText(/no matching gate pass/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('listbox', { name: /registry suggestions/i }),
      'an empty result must not offer any candidate',
    ).not.toBeInTheDocument();
  });

  it('never lets a slow old lookup overwrite a newer query result', async () => {
    const slow = new Promise<Response>((resolve) => {
      setTimeout(
        () => resolve(jsonResponse({ matches: [{ ...MATCH, driverName: 'Old Result' }] }, 200)),
        600,
      );
    });
    stubApi({
      lookup: (url) =>
        url.includes('GJ05JP62')
          ? jsonResponse({ matches: [{ ...MATCH, driverName: 'New Result' }] }, 200)
          : slow,
    });
    await renderSignedIn();

    await typeInto('Vehicle registration', 'GJ05JP6');
    await typeInto('Vehicle registration', 'GJ05JP62');
    expect(await screen.findByRole('option', { name: /New Result/ })).toBeInTheDocument();
    await settle(700);
    expect(screen.queryByRole('option', { name: /Old Result/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /New Result/ })).toBeInTheDocument();
  });

  it('derives severity from multiple violations and exposes no severity input', async () => {
    stubApi({
      validate: () => jsonResponse({ severity: 'Critical', otherFields: [] }, 200),
      preview: () => jsonResponse({ ...PREVIEW_RESPONSE, severity: 'Critical' }, 200),
    });
    await renderSignedIn();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Not wearing a seat belt' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Driving against the designated route' }),
    );
    expect(screen.getByText(/severity:\s*critical/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^severity/i)).not.toBeInTheDocument();
  });

  it('requires remarks when an Other master is selected and clears the error when filled', async () => {
    stubApi();
    await renderSignedIn();

    // Complete the rest of the draft so only the Other-remarks rule can block.
    await typeInto('Vehicle registration', 'GJ05JP6207');
    await typeInto('Gate pass number', 'HZ-GP-1051');
    await typeInto('Driver name', 'Kavita Joshi');
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Vehicle type'), IDS.vehicleType);
    await user.click(screen.getByRole('checkbox', { name: 'Not wearing a seat belt' }));
    await user.selectOptions(screen.getByLabelText('Department'), IDS.departmentOther);

    await user.click(screen.getByRole('button', { name: /check details/i }));
    expect(
      (await screen.findAllByText(/remarks are required when other is selected/i)).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /driver summary/i })).not.toBeInTheDocument();

    await typeInto('Remarks', 'Unlisted department');
    await user.click(screen.getByRole('button', { name: /check details/i }));
    expect(await screen.findByRole('heading', { name: /driver summary/i })).toBeInTheDocument();
  });

  it('reaches the plain-language summary and returns with every value preserved', async () => {
    stubApi({ lookup: () => jsonResponse({ matches: [MATCH] }, 200) });
    await renderSignedIn();

    await typeInto('Vehicle registration', 'GJ05JP6207');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('option', { name: /Kavita Joshi/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Not wearing a seat belt' }));
    await typeInto('Remarks', 'Routine check');

    await user.click(screen.getByRole('button', { name: /check details/i }));
    const summary = await screen.findByRole('heading', { name: /driver summary/i });
    expect(summary).toBeInTheDocument();
    expect(screen.getByText(/Kavita Joshi/)).toBeInTheDocument();
    expect(screen.getByText(/GJ05JP6207/)).toBeInTheDocument();
    expect(screen.getByText(/Not wearing a seat belt/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^change details$/i }));
    expect(screen.getByLabelText('Driver name')).toHaveValue('Kavita Joshi');
    expect(screen.getByLabelText('Remarks')).toHaveValue('Routine check');
    expect(screen.getByRole('checkbox', { name: 'Not wearing a seat belt' })).toBeChecked();
  });

  it('clears the in-memory draft on logout and idle expiry', async () => {
    stubApi();
    await renderSignedIn();
    await typeInto('Driver name', 'Draft Person');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /log ?out|sign out/i }));
    await screen.findByLabelText(/username/i);
    await user.type(screen.getByLabelText(/username/i), MARSHAL.username);
    await user.type(screen.getByLabelText('Password', { exact: true }), MARSHAL.password);
    await user.click(screen.getByRole('button', { name: /sign in|log in/i }));
    await screen.findByLabelText('Vehicle registration');
    expect(screen.getByLabelText('Driver name')).toHaveValue('');
  });
});
