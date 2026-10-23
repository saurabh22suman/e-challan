# Review request — inclusive UX corrections R1–R7 (2026-10-19)

Independent re-review requested for the corrected baseline returned by
`docs/reviews/inclusive-ux.md` (CHANGES_REQUIRED). Run in a fresh session/model;
the correction session cannot approve it. Supersedes the earlier request
`docs/review-requests/inclusive-ux.md` for acceptance purposes (that record and
its review findings remain the basis).

## What to review

1. **R1 closure** (`EntryFlow.tsx`): a superseded review resets pending
   immediately; the identity-guarded settlement cannot clear a newer request's
   pending; held validation/preview recovery and fresh successful checks are
   asserted by the four rewritten `deferred-response.spec.ts` cases with
   observable synchronisation (no fixed waits). Confirm the reviewer's stuck
   reproduction now recovers and that no stale response advances the flow.
2. **R2 closure** (`SignaturePad.tsx`): restoration of the parent's
   acknowledged capture shows the confirmed presentation without mutation;
   external invalidation (last photo removed) reconciles the mounted pad and the
   parent summary together. Confirm neither direction can show a stale
   confirmation and that C2 start-of-drawing invalidation, hydration
   generation guards and multi-stroke behaviour are intact. The planner
   revision of `signature-invalidation.test.tsx` (restored capture is
   confirmed) keeps the test's purpose; confirm it.
3. **R3 closure**: one field edit retains unresolved unrelated errors and
   `aria-invalid`; every UXA-04 summary link focuses its actual control
   (violations included); `contractorId` is mapped, listed and focused for
   server 422 errors and clears on correction.
4. **R4 closure**: Escape/chevron dismiss an actively searched panel; new input
   and deliberate reopen restore it; active-descendant references are removed on
   close and, when present, reference an existing option; ArrowUp is asserted.
5. **R5 closure**: the summary shows `Manual entry` with no registry-absence
   claim; the repeat notice no longer calls the prospective occurrence a
   "challan number".
6. **R6 closure**: canvas named/described/grouped; `Clear signature` is
   physically separated from confirmation; the witnessed-refusal rule is
   unchanged.
7. **R7 closure**: sign-in copy derives from `IDLE_TIMEOUT_SECONDS` (marshal 10
   minutes, desktop 60 minutes); no server expiry changed; both surfaces assert
   their wording.
8. **Acceptance integrity**: confirm the documented revision in
   `docs/handoffs/inclusive-ux-corrections-prepared.md` (R5 chip, R2 restored
   presentation, same-message disambiguation) weakens nothing; verify the rev-2
   manifest and the archived rev 1.
9. **Re-run independently**: `sha256sum -c
   docs/handoffs/inclusive-ux-tests.sha256` (revision 2; rev 1 archived at
   `inclusive-ux-tests-rev1.sha256`), `pnpm run format:check`, `pnpm run lint`,
   `pnpm run typecheck`, `pnpm run test`, `pnpm run test:integration`,
   `pnpm run test:e2e`, `pnpm run build`, `pnpm run check:tablet-size`,
   `pnpm run test:foundation`.

## Evidence

`docs/handoffs/inclusive-ux-corrections.md` (per-finding corrections, RED/GREEN,
gates) and the prepared record above. Live reproductions verified with
Playwright MCP: R1 held-request recovery, R3 retention/violations focus, R4
dismissal/reopen, R2 restoration, R5 truthful chip, R7 60-minute wording.
Screenshots: `.playwright-mcp/corrections-r2-restored-confirmed.png`,
`.playwright-mcp/corrections-r7-admin-policy.png`.

## Known open items (not defects)

- Representative-user/real-device validation remains pending (B-03/V-03); the
  fake camera is not hardware acceptance.
- The optional inactivity advance warning is not implemented.
- Mascot/character work is intentionally untouched pending owner scheduling.

Report PASS / CHANGES_REQUIRED / BLOCKED in
`docs/reviews/inclusive-ux-corrections.md` with accepted file hashes and rerun
results.
