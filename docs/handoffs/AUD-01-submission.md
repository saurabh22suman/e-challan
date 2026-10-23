# AUD-01 — Critical submission-path implementation

**Date:** 2026-10-21  
**Source:** `docs/audits/2026-10-21-comprehensive-app-audit.md`, finding AUD-01  
**Scope:** Marshal signed/refused challan submission, server numbering, evidence
persistence, audit row, idempotent retry, and the tablet confirmation screen.  
**Review state:** Implemented and verified locally; **independent review still
required.** No review box has been ticked.

## Why

The audit found that the tablet flow ended at photos/signature with no commit
control and that the API had no issuance route. This change adds the one write
that creates an issued challan. It is deliberately narrower than the full I-06 /
I-04 scope: authorised evidence retrieval, Admin cancellation, entry-start
timing, export and full media hardening remain separate tasks.

## Implemented

- Shared `ChallanCommitRequestSchema` and `ChallanCommitResponseSchema`
  (`packages/contracts/src/submission.ts`), including exactly-one
  signature/refusal validation and 1–4 photos.
- `POST /challans` (Marshal only, bound post/shift) with:
  - authoritative draft revalidation, final repeat/duplicate preview and
    summary-revision binding;
  - server-assigned `DEMO/YYYY/MM/NNNN` monthly sequence under an advisory lock;
  - unique operation id + payload hash for lost-response retries;
  - JPEG/PNG magic-byte and declared-byte checks;
  - local evidence files and DB evidence/signature/refusal rows;
  - immutable snapshots, audit row and all-or-nothing DB transaction;
  - file cleanup when the transaction fails.
- Green-only `Generate challan` action on signature and refusal steps, disabled
  until a photo plus matching signature/refusal exist, with an in-flight state.
- Success receipt showing the server number, status, driver, vehicle, gate pass,
  severity, occurrence and issued time; a reset action starts a new entry.
- `EVIDENCE_ROOT`, defaulting to `./var/evidence` (ignored by Git).
- Browser evidence: `docs/audits/evidence/2026-10-21/tablet/commit-ready-1366x768.png`,
  `challan-issued-1366x768.png`, `refusal-issued-1366x768.png`,
  `docs/audits/evidence/2026-10-21/admin/issued-challan-visible-1366x768.png`.

## Test evidence

| Gate | Result |
|---|---|
| `pnpm --filter @echallan/contracts exec vitest run test/submission.test.ts` | 5 passed |
| `pnpm --filter @echallan/api exec vitest run --project integration tests/integration/issuance-submission.test.ts` | 5 passed |
| `pnpm test` | contracts 68, API unit 104, tablet 88, admin 26 passed |
| `pnpm test:integration` | 13 files / 137 tests passed |
| `pnpm run typecheck` | passed |
| `pnpm run lint` | passed (one pre-existing warning in SignaturePad) |
| `pnpm format:check` | passed |
| `pnpm build` | passed |
| `pnpm check:tablet-size` | 156,815 B gzip, under 250,000 B |
| `pnpm test:foundation` | 27 passed |

Browser verification used the isolated test database and a fake media device:
signed submission issued `DEMO/2026/10/0007`; a refusal submission issued
`DEMO/2026/10/0008`; one photo file and, for the signed case, one signature file
were persisted; the Admin list/detail showed both new records.

## Known limits

- Evidence retrieval/viewing remains unimplemented (AUD-05); files are stored
  but not yet served.
- No server-observed entry-start timestamp (SUB-07) is recorded.
- The local disk adapter has no orphan TTL cleanup; a process crash between file
  write and DB commit can leave orphan files.
- No real-device camera/signature/HTTPS test was performed.
- The implementation plan's I-06 and review boxes remain unchecked pending
  independent review.
