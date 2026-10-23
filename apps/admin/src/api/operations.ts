import {
  AdminUserListResponseSchema,
  AdminUserResponseSchema,
  ApiErrorSchema,
  ChallanDetailResponseSchema,
  ChallanEvidenceResponseSchema,
  ChallanListResponseSchema,
  ChallanReportQuerySchema,
  ChallanReportResponseSchema,
  CreateUserRequestSchema,
  MasterListResponseSchema,
  MasterResponseSchema,
  ProfileResponseSchema,
  ResetPasswordRequestSchema,
  ReviewTransitionSchema,
  type AdminUser,
  type ChallanDetailResponse,
  type ChallanEvidenceResponse,
  type ChallanReportQuery,
  type ChallanReportResponse,
  type ChallanStatus,
  type ChallanSummary,
  type CreateUserRequest,
  type MasterKind,
  type MasterListResponse,
  type MasterOperation,
  type MasterRecord,
  type ProfileResponse,
  type ReviewTransition,
} from '@echallan/contracts';
import { masterRequestSchema } from '@echallan/contracts';
import { API_PREFIX } from '../auth/api';

/**
 * Authenticated browser client for the review/user-administration API.
 *
 * Every response is parsed against the shared contract, so a drifted or proxy
 * HTML body becomes a visible failure instead of undefined UI state. No password
 * is stored or echoed by this module; the reset call passes it once.
 */

export class OperationsApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'OperationsApiError';
    this.status = status;
    this.code = code;
  }
}

export const OPERATIONS_FAILURE = 'The request could not be completed. Try again.';

async function readFailure(response: Response, fallback: string): Promise<OperationsApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const parsed = ApiErrorSchema.safeParse(body);
  if (parsed.success)
    return new OperationsApiError(response.status, parsed.data.error, parsed.data.message);
  return new OperationsApiError(response.status, 'unexpected_error', fallback);
}

async function request<T>(
  path: string,
  token: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new OperationsApiError(0, 'network_error', OPERATIONS_FAILURE);
  }

  if (!response.ok) throw await readFailure(response, OPERATIONS_FAILURE);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OperationsApiError(response.status, 'invalid_response', OPERATIONS_FAILURE);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new OperationsApiError(response.status, 'invalid_response', OPERATIONS_FAILURE);
  }
  return parsed.data;
}

export async function listChallans(
  token: string,
  status?: ChallanStatus,
): Promise<ChallanSummary[]> {
  const query = status === undefined ? '' : `?status=${encodeURIComponent(status)}`;
  const body = await request(`${'/challans'}${query}`, token, ChallanListResponseSchema);
  return body.items;
}

export async function getChallan(token: string, id: string): Promise<ChallanDetailResponse> {
  return request(`/challans/${encodeURIComponent(id)}`, token, ChallanDetailResponseSchema);
}

function reportQueryString(query: Partial<ChallanReportQuery>): string {
  const parsed = ChallanReportQuerySchema.parse(query);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.toString();
}

export async function getChallanReport(
  token: string,
  query: Partial<ChallanReportQuery> = {},
): Promise<ChallanReportResponse> {
  const search = reportQueryString(query);
  return request(`/challans/report?${search}`, token, ChallanReportResponseSchema);
}

export async function exportChallanReport(
  token: string,
  query: Partial<ChallanReportQuery> = {},
): Promise<{ blob: Blob; filename: string }> {
  const search = reportQueryString(query);
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}/challans/report/export?${search}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new OperationsApiError(0, 'network_error', OPERATIONS_FAILURE);
  }
  if (!response.ok) throw await readFailure(response, OPERATIONS_FAILURE);
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'echallan-report.xlsx';
  return { blob: await response.blob(), filename };
}

export async function listMasters(token: string, kind: MasterKind): Promise<MasterListResponse> {
  return request(`/masters/${encodeURIComponent(kind)}`, token, MasterListResponseSchema);
}

export async function listAdminMasters(
  token: string,
  kind: MasterKind,
): Promise<MasterListResponse> {
  return request(`/admin/masters/${encodeURIComponent(kind)}`, token, MasterListResponseSchema);
}

export async function saveMaster(
  token: string,
  kind: MasterKind,
  operation: MasterOperation,
  payload: Record<string, unknown>,
  id?: string,
): Promise<MasterRecord> {
  const schema = masterRequestSchema(kind, operation);
  const body = schema.parse(payload);
  const path =
    operation === 'create'
      ? `/admin/masters/${encodeURIComponent(kind)}`
      : `/admin/masters/${encodeURIComponent(kind)}/${encodeURIComponent(id ?? '')}`;
  const result = await request(path, token, MasterResponseSchema, {
    method: operation === 'create' ? 'POST' : 'PATCH',
    body: JSON.stringify(body),
  });
  return result.master;
}

export async function deactivateMaster(
  token: string,
  kind: MasterKind,
  id: string,
): Promise<MasterRecord> {
  const result = await request(
    `/admin/masters/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/deactivate`,
    token,
    MasterResponseSchema,
    { method: 'POST' },
  );
  return result.master;
}

export function getChallanEvidence(token: string, id: string): Promise<ChallanEvidenceResponse> {
  return request(
    `/challans/${encodeURIComponent(id)}/evidence`,
    token,
    ChallanEvidenceResponseSchema,
  );
}

/** Fetch an authorised evidence binary and return it as a Blob. */
export async function fetchEvidenceBlob(
  token: string,
  challanId: string,
  evidenceId: string,
): Promise<Blob> {
  return fetchBinary(
    `/challans/${encodeURIComponent(challanId)}/evidence/${encodeURIComponent(evidenceId)}`,
    token,
  );
}

export async function fetchSignatureBlob(token: string, challanId: string): Promise<Blob> {
  return fetchBinary(`/challans/${encodeURIComponent(challanId)}/signature`, token);
}

async function fetchBinary(path: string, token: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new OperationsApiError(0, 'network_error', OPERATIONS_FAILURE);
  }
  if (!response.ok) throw await readFailure(response, OPERATIONS_FAILURE);
  return response.blob();
}

export async function transitionChallan(
  token: string,
  id: string,
  transition: ReviewTransition,
): Promise<ChallanDetailResponse> {
  const payload = ReviewTransitionSchema.parse(transition);
  return request(`/challans/${encodeURIComponent(id)}/review`, token, ChallanDetailResponseSchema, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listUsers(token: string): Promise<AdminUser[]> {
  const body = await request('/admin/users', token, AdminUserListResponseSchema);
  return body.users;
}

export async function resetUserPassword(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const payload = ResetPasswordRequestSchema.parse({ password });
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}/admin/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new OperationsApiError(0, 'network_error', OPERATIONS_FAILURE);
  }
  if (!response.ok) throw await readFailure(response, OPERATIONS_FAILURE);
}

export async function createUser(token: string, input: CreateUserRequest): Promise<AdminUser> {
  const payload = CreateUserRequestSchema.parse(input);
  const body = await request('/admin/users', token, AdminUserResponseSchema, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return body.user;
}

async function accountAction(
  token: string,
  id: string,
  verb: 'deactivate' | 'reactivate',
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}/admin/users/${encodeURIComponent(id)}/${verb}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new OperationsApiError(0, 'network_error', OPERATIONS_FAILURE);
  }
  if (!response.ok) throw await readFailure(response, OPERATIONS_FAILURE);
}

export function deactivateUser(token: string, id: string): Promise<void> {
  return accountAction(token, id, 'deactivate');
}

export function reactivateUser(token: string, id: string): Promise<void> {
  return accountAction(token, id, 'reactivate');
}

export interface LocationOption {
  id: string;
  label: string;
}

export async function listLocations(token: string): Promise<LocationOption[]> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}/masters/locations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new OperationsApiError(0, 'network_error', OPERATIONS_FAILURE);
  }
  if (!response.ok) throw await readFailure(response, OPERATIONS_FAILURE);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OperationsApiError(response.status, 'invalid_response', OPERATIONS_FAILURE);
  }
  const parsed = MasterListResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new OperationsApiError(response.status, 'invalid_response', OPERATIONS_FAILURE);
  }
  return parsed.data.masters.map((master) => ({ id: master.id, label: master.label }));
}

export async function getProfile(token: string): Promise<ProfileResponse> {
  return request('/profile', token, ProfileResponseSchema);
}
