# Independent implementation re-review requested: F-02 C1 correction

Task: **F-02 — Login, roles, shift attribution and idle expiry**, feature
`specs/003-demo-auth`. Scope: the bounded **C1** correction only, prepared at
`docs/handoffs/F-02-prepared.md` revision 4 and approved for implementation in
`docs/reviews/F-02-preparation-revision-4.md`. Q1–Q4, R1, R3 and R4 are closed and
were not reopened.

Implementation evidence: the **"C1 regression correction (2026-10-05)"** section of
`docs/handoffs/F-02.md`. Parent `Implemented` and T009/T011/T013 are ticked on that
evidence; **`Reviewed` is unchecked and reviewer-owned.**

## What changed

- `fetchSession` in both clients reads/decodes the body inside a `try`/`catch` and
  resolves to `null` on any body-read or JSON decoding failure — never rejects.
- Both providers attach a defensive restoration rejection handler; cleanup runs only
  while that restoration is still the current transition.
- No contract, migration, seed, fixture or frozen-acceptance change.

Accepted hashes for review:

```
beb461e7bb003f06bbd8e576ba9bda479905bcc238f7fae30602840651ae7503  apps/tablet/src/auth/api.ts
7d27e57954dd815a0886f3acc8fdf646712e93b09feb0f3ff1b55d153ddfaaff  apps/admin/src/auth/api.ts
cb14a7746900b0268d8a3800db6bd03e5d9d020a7cec2019df6afd743a62eb2d  apps/tablet/src/auth/session.tsx
89410660cbc45f7d0067611ce6cbe3f2e028f715b7121dd034af3465e55df901  apps/admin/src/auth/session.tsx
```

## Evidence summary

- RED before: tablet 2 failed / 19 passed (21), admin 2 failed / 15 passed (17), both
  on the unhandled-rejection assertion for an undecodable restoration body.
- GREEN after: tablet 21, admin 17, root units 122, real-DB integration 66, browser 17
  (two consecutive clean runs), builds, 144 788 B gzip initial JS, foundation 27.
- Frozen revision-4 baseline verifies 24/24; rev-3 archive hash `9c46ed06…` unchanged
  (22 OK / 2 expected mismatches, the C1-extended files).
- Disposable-copy sensitivity: unhandled body read, skipped cleanup and unguarded
  stale cleanup each fail the matching C1/R2 cases on both clients; clean rerun
  16/16 tablet and 12/12 admin in the copy.
- Environmental observation recorded: one browser attempt failed while stray reused
  `tsx watch` API servers were present; two clean runs passed after stopping them.

## Reviewer checklist

1. Verify the revision-4 baseline and the four production hashes above.
2. Rerun the focused client suites and confirm both C1 cases and the controls.
3. Inspect that cleanup from a failed restoration is transition-guarded and that the
   helper cannot reject on body-read/decoding failure.
4. Repeat C1 fault sensitivity independently and confirm the matching failures.
5. Rerun the prescribed regressions, builds, tablet budget and foundation checks.
6. Record PASS / CHANGES_REQUIRED in `docs/reviews/F-02-c1-implementation.md`; on PASS,
   tick `Reviewed` and issue the accepted snapshot. F-03 remains blocked until then.
