import {
  ApiErrorSchema,
  ChallanCommitRequestSchema,
  ChallanCommitResponseSchema,
  DraftValidationErrorSchema,
  type ChallanCommitRequest,
  type ChallanCommitResponse,
  type DraftFieldError,
} from '@echallan/contracts';
import { API_PREFIX, authorisedFetch } from '../../auth/api';

/**
 * Client for the one issuance write (I-06).
 *
 * `operationId` is generated once per editing session and reused across retries.
 * The API therefore returns the already-issued record after a lost response
 * instead of creating a second challan.
 */
export class SubmitApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: DraftFieldError[];

  constructor(status: number, code: string, message: string, fields: DraftFieldError[] = []) {
    super(message);
    this.name = 'SubmitApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type CompatibleInput = Omit<ChallanCommitRequest, 'signature' | 'refusal'> & {
  signature: ChallanCommitRequest['signature'];
  refusal: ChallanCommitRequest['refusal'];
};

export async function submitChallan(input: CompatibleInput): Promise<ChallanCommitResponse> {
  const payload = ChallanCommitRequestSchema.parse(input);
  let response: Response;
  try {
    response = await authorisedFetch(`${API_PREFIX}/challans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new SubmitApiError(
      0,
      'network_error',
      "Couldn't reach the API. Your entries and evidence are still on this device.",
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SubmitApiError(
      response.status,
      'invalid_response',
      'The API returned an unreadable response. Nothing was confirmed.',
    );
  }

  if (!response.ok) {
    const draft = DraftValidationErrorSchema.safeParse(body);
    if (draft.success) {
      throw new SubmitApiError(
        response.status,
        draft.data.error,
        draft.data.message,
        draft.data.fields,
      );
    }
    const api = ApiErrorSchema.safeParse(body);
    throw new SubmitApiError(
      response.status,
      api.success ? api.data.error : 'unexpected_error',
      api.success ? api.data.message : 'The challan could not be issued. Nothing was confirmed.',
    );
  }

  const parsed = ChallanCommitResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new SubmitApiError(
      response.status,
      'invalid_response',
      'The API returned an unexpected confirmation. Check the challan list before retrying.',
    );
  }
  return parsed.data;
}
