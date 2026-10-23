# Re-review request: CHAR-01 catalogue failure mapping (008, revision 2)

Requested: 2026-10-19. Source finding: `docs/reviews/marshal-character.md` §1
CHAR-01. Feature `specs/008-marshal-character/`; implementation evidence
`docs/handoffs/marshal-character-char01.md`; preparation
`docs/handoffs/marshal-character-char01-prepared.md`; active frozen manifest
`docs/handoffs/marshal-character-tests.sha256` revision 2 (revision 1 archived
as `docs/handoffs/marshal-character-tests-rev1.sha256`).

## Correction summary

`useCatalogues` now classifies any non-2xx/401/403 HTTP response as
`service_error` with the status; only a rejected transport is `network`.
EntryFlow renders an honest server-error callout (`marshal-service-error`,
concerned illustration, Retry) for 500/503 and keeps the crossed-Wi-Fi
connection callout exclusively for transport rejection. 401/403 and malformed
200 stay character-free and distinct. Retry recovers the real seeded catalogue
after both failure classes.

## Commands to rerun independently

```bash
sha256sum -c docs/handoffs/marshal-character-tests.sha256
pnpm run format:check && pnpm run lint && pnpm run typecheck
pnpm run test && pnpm run test:integration && pnpm run test:e2e
pnpm run build && pnpm run check:tablet-size
pnpm run test:foundation
docs/handoffs/marshal-character-char01-fault-sensitivity.sh
```

## Specific review questions

1. Is the classification boundary correct: rejected transport → connection
   character only; HTTP 500/503 → server-error message with Retry and no
   “can't reach” claim; 401/403 and malformed bodies unchanged?
2. Do the new controls fail meaningfully (the fault script records RED and
   restored GREEN) and recover the real catalogue without fabricated options?
3. Are the existing 008 tests, assets, animations and R1–R7 regressions
   preserved unchanged?
4. Is the documented revision-2 baseline acceptable: two new acceptance files,
   the CHAR-01 requirement in `spec.md`, revision 1 archived, and `tasks.md`
   still excluded from the manifest?
5. Does the corrected `EntryFlow.tsx`/`useCatalogues.ts` now satisfy the
   affected inclusive-UX scope so the 007 combined-review checkbox and a new
   accepted snapshot can be considered?

No self-review is claimed. MC-03/MC-05 are re-ticked on the correction evidence;
the 008 review box and the 007 combined-review box remain unchecked.
