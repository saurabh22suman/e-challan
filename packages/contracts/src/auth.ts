import { z } from 'zod';
import { RoleSchema } from './domain.js';

/**
 * F-02 approved demo-authentication contracts.
 *
 * Authority: `docs/eChallan_replacement_spec_v0.2.md` (addendum A v0.2), which
 * amends `docs/eChallan_replacement_spec.md` v0.1 on authentication only, and
 * the owner decision in `docs/handoffs/demo-env-login-decision.md`.
 *
 * These schemas are the single definition consumed by the API and by both
 * clients, so a login response, a session lookup and an error body cannot drift
 * between them.
 *
 * Scope boundary, stated plainly:
 *
 *  - **No role may be requested.** `LoginRequestSchema` has no `role` field and
 *    is strict, so a client-supplied role is a contract violation rather than an
 *    authorisation input (addendum A section 2.1).
 *  - **No password material is ever returned.** Neither the login nor the
 *    session response carries a password, a hash or a credential source.
 *  - **Post and shift are optional at login** and are resolved from stored data
 *    when omitted; they are `null` for roles that need no post.
 *  - This file models the demo sign-in exchange only. Admin password reset and
 *    its stored Argon2id hash are defined in `operations.ts`; user create/disable
 *    (the rest of PRD E1.4) remain out of scope.
 */

/** Session tokens are 32 random bytes, hex-encoded by the API. */
export const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** Session token as exchanged with the API. Never stored by the API in this form. */
export const SessionTokenSchema = z.string().regex(SESSION_TOKEN_PATTERN);

/**
 * Login request. `postId`/`shiftId` are optional: when omitted the API resolves
 * the single authorised post and compatible shift from stored data, and refuses
 * an ambiguous choice rather than guessing.
 */
export const LoginRequestSchema = z.strictObject({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
  postId: z.uuid().optional(),
  shiftId: z.uuid().optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** The identity a session carries. The role always comes from stored data. */
export const SessionUserSchema = z.strictObject({
  id: z.uuid(),
  username: z.string().min(1),
  role: RoleSchema,
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

/** A referenced post or shift, identified and labelled for display only. */
export const SessionContextRefSchema = z.strictObject({
  id: z.uuid(),
  label: z.string().min(1),
});
export type SessionContextRef = z.infer<typeof SessionContextRefSchema>;

/** Identity and bound context, without a token. */
export const SessionIdentitySchema = z.strictObject({
  expiresAt: z.iso.datetime(),
  user: SessionUserSchema,
  post: SessionContextRefSchema.nullable(),
  shift: SessionContextRefSchema.nullable(),
});
export type SessionIdentity = z.infer<typeof SessionIdentitySchema>;

/**
 * Login response: the canonical identity plus the raw token, returned exactly
 * once. The token is never persisted by the API in this form.
 */
export const LoginResponseSchema = z.strictObject({
  token: SessionTokenSchema,
  ...SessionIdentitySchema.shape,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/**
 * Session lookup response: the same identity without a token, so a client can
 * restore a session after a reload without ever re-issuing one.
 */
export const SessionResponseSchema = SessionIdentitySchema;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/**
 * One-time, short-lived code used to move an authenticated session between the
 * admin portal and the tablet origin. The code is signed by the API and is not a
 * session token; it expires quickly and the source session is revoked when the
 * code is exchanged. It is carried in the URL fragment so it is never sent to a
 * web server or written to access logs.
 */
export const HANDOFF_TTL_SECONDS = 60;
export const HandoffCodeSchema = z.string().min(1).max(4096);
export const CreateHandoffResponseSchema = z.strictObject({
  code: HandoffCodeSchema,
  expiresAt: z.iso.datetime(),
});
export type CreateHandoffResponse = z.infer<typeof CreateHandoffResponseSchema>;

export const ExchangeHandoffRequestSchema = z.strictObject({
  code: HandoffCodeSchema,
});
export type ExchangeHandoffRequest = z.infer<typeof ExchangeHandoffRequestSchema>;

export const ExchangeHandoffResponseSchema = LoginResponseSchema;
export type ExchangeHandoffResponse = z.infer<typeof ExchangeHandoffResponseSchema>;

/**
 * Error body with a **stable machine-readable code**, so a client branches on
 * the code and never on prose. `message` is safe to display and must never carry
 * credential material.
 */
export const ApiErrorSchema = z.strictObject({
  error: z.string().min(1),
  message: z.string().min(1),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * The one richer refusal, used only when omitted `postId`/`shiftId` cannot be
 * resolved to a single candidate (addendum A section 2.2 as specified for F-02).
 *
 * `postOptions` and `shiftOptions` carry **stored, authorised, active** candidates
 * only, so the operator can choose explicitly and nothing has to be guessed. The
 * two resolution steps are separate: while the post is ambiguous the shift list is
 * empty, because shift options depend on the chosen post. The candidates are
 * disclosed only to a caller who already presented valid credentials.
 */
export const AmbiguousContextResponseSchema = z.strictObject({
  error: z.literal('ambiguous_context'),
  message: z.string().min(1),
  postOptions: z.array(SessionContextRefSchema),
  shiftOptions: z.array(SessionContextRefSchema),
});
export type AmbiguousContextResponse = z.infer<typeof AmbiguousContextResponseSchema>;

/**
 * Approved error codes. Every refusal uses one of these, so the set is the
 * reviewable surface of what the API can refuse.
 */
export const API_ERROR_CODES = {
  /** One indistinguishable code for an unknown username and a wrong password. */
  invalidCredentials: 'invalid_credentials',
  /** No session, unknown token, revoked token, idle-expired or absolute-expired. */
  unauthenticated: 'unauthenticated',
  /** The request body violates the shared contract. */
  invalidRequest: 'invalid_request',
  /** A supplied or resolved post/shift the caller may not use. */
  forbiddenContext: 'forbidden_context',
  /** Omitted post/shift could not be resolved to exactly one candidate. */
  ambiguousContext: 'ambiguous_context',
  /** The configured username resolves to a stored user with a different role. */
  roleMismatch: 'role_mismatch',
  /** A valid caller reached a record outside its authorised scope. */
  forbidden: 'forbidden',
  /** No such record, or a malformed record id. */
  notFound: 'not_found',
  /** A referenced master (for example a gate's location) is unknown or inactive. */
  invalidReference: 'invalid_reference',
  /** An unexpected server error; the body never carries internal detail. */
  internalError: 'internal_error',
  /** A draft that fails authoritative pre-issuance validation; carries field errors. */
  invalidDraft: 'invalid_draft',
  /** No configured demo accounts on this instance: authentication fails closed. */
  unavailable: 'authentication_unavailable',
  /** The record exists but the requested status change is illegal from its current state. */
  invalidTransition: 'invalid_transition',
  /** Uniqueness or state conflict, for example a duplicate username. */
  conflict: 'conflict',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** Build an error body from an approved code and a display-safe message. */
export function apiError(code: ApiErrorCode, message: string): ApiError {
  return { error: code, message };
}

/**
 * Idle windows, in seconds, from addendum A section 2.2: 600 s for a
 * Marshal/tablet session and 3600 s for the Supervisor and Admin desktop
 * sessions. The value is stored per session so a policy change does not
 * retroactively reinterpret existing rows.
 */
export const IDLE_TIMEOUT_SECONDS = {
  Marshal: 600,
  Supervisor: 3600,
  Admin: 3600,
} as const satisfies Record<z.infer<typeof RoleSchema>, number>;

/** Upper bound on a session's lifetime regardless of activity. */
export const ABSOLUTE_SESSION_LIFETIME_SECONDS = 43_200;

/** Tablet idle window in milliseconds, for the client's idle-logout hook. */
export const TABLET_IDLE_LOGOUT_MS = IDLE_TIMEOUT_SECONDS.Marshal * 1000;
