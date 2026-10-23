import { z } from 'zod';

/**
 * F-01 approved demo-domain contracts (specification v0.1, owner-approved
 * 2026-10-02). Re-exported from the package root so consumers never reach into
 * package internals.
 */
export * from './domain.js';

/**
 * F-02 approved demo-authentication contracts (addendum A v0.2). Re-exported
 * from the package root so the API and both clients consume one definition.
 */
export * from './auth.js';

/**
 * F-03 approved master-data contracts (specification v0.1 and B-05). Re-exported
 * from the package root so the API and any future admin screen consume one
 * definition of the master kinds, payloads and responses.
 */
export * from './masters.js';

/**
 * F-04/I-01/I-05 pre-issuance contracts (specification v0.1 sections 3–5/7, B-02,
 * B-04, B-05, B-06, D5). Re-exported from the package root so the tablet client and
 * the API consume one definition of the entry draft, registry lookup and preview.
 */
export * from './preIssuance.js';

/**
 * I-02/I-03 issuance contracts (camera capture, signature, refusal, summary
 * binding). Re-exported from the package root so the tablet client and any
 * future API consumption share one definition. E-02/E-03 owner approval
 * 2026-10-15.
 */
export * from './issuance.js';

/**
 * I-06 atomic submission contract (PRD E2.15–E2.17). Additive to the frozen
 * pre-issuance/media contracts; re-exported so the tablet and API share one
 * commit request and confirmation shape.
 */
export * from './submission.js';

/**
 * Bounded review/user-administration contracts (specs/009, owner-authorised
 * 2026-10-21). Re-exported from the package root so the API and admin client
 * cannot drift on list/detail/reset shapes.
 */
export * from './operations.js';

/**
 * Authorised evidence metadata contracts (R-01/E3.2). Binaries are served by
 * separate logged routes, never embedded in detail JSON.
 */
export * from './evidence.js';

/**
 * Self-service profile contract (specs/011). Re-exported so both clients parse
 * the same own-profile shape.
 */
export * from './profile.js';

/**
 * Liveness payload: the API process is running. It never claims database state.
 */
export const HealthResponseSchema = z.strictObject({
  status: z.literal('ok'),
});

/**
 * Readiness payload: the API process is running *and* PostgreSQL answered.
 */
export const ReadyResponseSchema = z.strictObject({
  status: z.literal('ok'),
  database: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ReadyResponse = z.infer<typeof ReadyResponseSchema>;

export const HEALTH_OK: HealthResponse = { status: 'ok' };
export const READY_OK: ReadyResponse = { status: 'ok', database: 'ok' };

/**
 * Parse a response body against a shared schema. Consumers throw on a contract
 * violation instead of silently accepting a drifted payload.
 */
export function parseContract<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`Contract violation: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
