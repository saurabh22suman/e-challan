import { ProfileResponseSchema, type ProfileResponse } from '@echallan/contracts';
import { API_PREFIX } from '../auth/api';

/** Browser client for the caller's own profile; never carries a user id. */
export class ProfileApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ProfileApiError';
    this.status = status;
  }
}

export async function fetchProfile(token: string): Promise<ProfileResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ProfileApiError(0, 'Your profile could not be loaded.');
  }
  if (!response.ok) {
    throw new ProfileApiError(response.status, 'Your profile could not be loaded.');
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ProfileApiError(response.status, 'Your profile could not be loaded.');
  }
  const parsed = ProfileResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ProfileApiError(response.status, 'Your profile could not be loaded.');
  }
  return parsed.data;
}
