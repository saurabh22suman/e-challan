# Inclusive UX corrections — prepared planning record (rev 2 acceptance)

Prepared: 2026-10-19. Source: `docs/reviews/inclusive-ux.md`
(CHANGES_REQUIRED, R1–R7 and the §3 planner/acceptance table). This record
documents the missing/incorrect acceptance prepared before the production
corrections, per the review disposition. Preparation and implementation again
ran in one owner-authorised session (disclosed deviation, unchanged).

**This record approves nothing.** The combined review remains unchecked; the
corrected baseline needs its own independent re-review
(`docs/review-requests/inclusive-ux-corrections.md`).

## Acceptance prepared/revised for the corrections

| File | Change | Covers |
| --- | --- | --- |
| `apps/tablet/e2e/deferred-response.spec.ts` | Rewritten: observable completion synchronisation (no fixed 700 ms window); four cases: held validation + edit recovery + fresh successful check; held preview + edit recovery + fresh check; held validation settling as a server error (pending finishes, error summary focused, field correction clears only that error, fresh check succeeds); stale held validation settling after a newer successful check must not disturb it. | R1, UXA-15, error settlement |
| `apps/tablet/e2e/inclusive-ux.spec.ts` | UXA-04 rewritten: all six links focus their actual control; one edit keeps unrelated summary errors and `aria-invalid`; client-error retention; server 422 contractor error mapped, listed and focused. UXA-09 rewritten: ArrowUp roving; held search with loading-state active-descendant validity; Escape dismisses a searched result set; reopen works. UXA-12 extended: summary must show the carried plate with a truthful `Manual entry` chip and no registry-absence claim. New UXA-23/29 case: restored confirmed signature keeps the confirmed presentation; drawing area named/described/grouped; Clear-vs-Confirm vertical separation. UXA-25 extended: 2001-character reason maps to a length correction with counter and focus, value preserved. UXA-06: marshal policy wording asserted. | R2a, R3, R4, R5, R6, R7 |
| `apps/tablet/e2e/inclusive-ux-media.spec.ts` | New (Chromium fake device): confirm a signature, delete the last photo, assert the mounted pad reconciles to the invalidated state (no stale chip/local message, Confirm disabled, evidence-cleared notice) and the summary no longer reports a captured signature. | R2b |
| `apps/admin/e2e/inclusive-ux.spec.ts` | Desktop policy wording asserted: 60 minutes (3600 s), not the marshal's 600 s. | R7 |
| `apps/tablet/src/__tests__/signature-invalidation.test.tsx` | Planner revision: the restored-capture case asserts the confirmed presentation (chip + disabled Confirm) instead of an enabled Confirm; the test's purpose — a stroke after restoration immediately invalidates the parent acknowledgement — is unchanged. | R2 planner note |
| `apps/tablet/src/__tests__/pre-issuance-entry.test.tsx` | R5 revision: the summary chip assertion now expects `Manual entry` (exact), replacing the false registry-absence claim. | R5 |
| `apps/tablet/e2e/pre-issuance.spec.ts` | Same R5 revision for the browser journey. | R5 |

Newly exported shared constants used by the fixes (behaviour unchanged):
`REMARKS_MAX_LENGTH` (already present), `REFUSAL_REASON_MAX_LENGTH`,
`REFUSAL_WITNESS_NAME_MAX_LENGTH`, `REFUSAL_WITNESS_STAFF_ID_MAX_LENGTH`; the
sign-in copy derives its duration from `IDLE_TIMEOUT_SECONDS`.

## Recorded RED (before the production corrections)

- `deferred-response.spec.ts`: 4/4 failed (the stuck-action assertion after a
  single edit; no completion synchronisation).
- `inclusive-ux.spec.ts`: UXA-04, UXA-09, UXA-12, UXA-23/29, UXA-25 failed (all
  six links vs Department only, edit-time wipe, searched-panel dismissal, false
  chip, limit-vs-blank message, restored presentation and naming/separation).
- `inclusive-ux-media.spec.ts`: 1/1 failed (pending confirmation not
  reconciled).
- `apps/admin/e2e/inclusive-ux.spec.ts`: 1/1 failed (10 minutes stated).
- `signature-invalidation.test.tsx`: the revised restored-capture case failed
  (no confirmed presentation before the fix).

Existing assertions were not weakened; where strict-mode duplicates arose they
disambiguate the same required message.
