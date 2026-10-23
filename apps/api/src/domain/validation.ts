import { ChallanSubmissionSchema, type ChallanSubmission } from '@echallan/contracts';

/**
 * F-01 internal API validation adapter.
 *
 * This is internal plumbing, not an endpoint: there is deliberately no
 * unauthenticated route that exposes validation or issuance. The API validates
 * every request through the shared contract so the client and server cannot
 * drift, and it returns exactly the shared schema's canonical parse result.
 *
 * It is *structural* validation only. The following are deliberately NOT proven
 * here and must not be claimed as enforced by this adapter, because they need
 * real API/domain context in their later tasks:
 *
 *  - that a master ID is active, or that an "Other" selection forces remarks;
 *  - that an evidence object exists, is owned by the issuing session, or was
 *    captured from the camera (byte budgets and ownership arrive with I-02–I-06);
 *  - that a signature ID exists and belongs to this submission, or that a
 *    refusal's witness actually holds the Supervisor role (E2.14);
 *  - that the actor/post/shift attribution is authorised, or that the current
 *    duplicate/repeat acknowledgement is present;
 *  - occurrence counting, the recommendation preview, numbering or issuance.
 */

/**
 * Validate an untrusted challan submission against the approved shared contract.
 *
 * @param input untrusted request body
 * @returns the canonical object, with registration/gate-pass/text normalised
 * @throws {z.ZodError} when the structure violates the contract
 */
export function validateChallanSubmission(input: unknown): ChallanSubmission {
  return ChallanSubmissionSchema.parse(input);
}
