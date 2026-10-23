# Pre-issuance batch implementation evidence — F-04 + I-01 + I-05

Task: **F-04 + I-01 + I-05** as one owner-authorised bounded batch. Feature:
`specs/005-pre-issuance`; brief `docs/handoffs/pre-issuance-batch.md`; prepared
handoff `docs/handoffs/pre-issuance-prepared.md`; baseline
`docs/handoffs/pre-issuance-tests.sha256` **revision 2** (rev 1 archived at
`docs/handoffs/pre-issuance-tests-rev1.sha256`).

**Disclosed owner override:** the owner authorised implementation explicitly while
**no independent preparation-confirmation record existed**
(`docs/reviews/pre-issuance-preparation.md` is absent). Recorded in
`docs/implementation-plan.md`; the missing confirmation is not fabricated and the
combined independent review at batch exit is required. Implementation boxes are
ticked on complete verification; **all review boxes stay unchecked**.

## Delivered journey

- **F-04:** self-hosted IBM Plex Sans/Mono via pinned `@fontsource` 5.3.0 (no CDN),
  identifier mono typography, visible focus, outlined severity/notice primitives,
  role shells with lazy screens (`EntryFlow`, `DashboardScreen`), honest admin empty
  state, foundation suites reconciled to the new shells, R4 lazy-route paths updated.
- **I-01:** shared pre-issuance contracts, Marshal-only post-scoped
  `GET /registry/lookup` (3+ chars, one match per pass, zero-history vehicles,
  expired status), authoritative `POST /challans/validate` with `422 invalid_draft`
  field codes, and the full-width tablet entry form with debounced/cancelled
  autofill, multiple-driver choice, editable fills, Other-remarks coupling,
  read-only derived severity and the summary/Back flow.
- **I-05:** `POST /challans/preview` with an injected clock, gate-pass-keyed
  non-cancelled 90-day counting (inclusive lower, `T` excluded), approved
  recommendation tiers, vehicle+session-location 15-minute duplicate warning, no
  writes; persistent repeat/duplicate notices and explicit acknowledgement that is
  invalidated by material changes or a changed re-preview.

No evidence, signature, submission, numbering, review mutation, export, screens,
offline queue or deployment was added. No migration was needed.

## Changed files (production)

New: `packages/theme/src/{fonts.ts,css.d.ts,primitives.tsx}`,
`packages/contracts/src/preIssuance.ts`,
`apps/api/src/preIssuance/{rules.ts,service.ts,routes.ts}`,
`apps/tablet/src/routes/EntryFlow.tsx`, `apps/admin/src/routes/DashboardScreen.tsx`.
Modified: `packages/theme/src/{index.ts,createTheme.ts}`, `packages/contracts/src/{index.ts,auth.ts}`,
`apps/api/src/app.ts`, `apps/tablet/src/{App.tsx,auth/api.ts,auth/session.tsx}`,
`apps/admin/src/App.tsx`, `packages/theme/package.json`, `pnpm-lock.yaml`.
Deleted: tablet/admin `FoundationScreen`, `FieldNotesScreen`, `ContractNotesScreen`,
`useHashRoute` (replaced by the real shells).

Key hashes for review:

```
a9625834507199f7764f513cc66579e3bff62f95b4a8e396968bec9839883743  packages/theme/src/fonts.ts
7a2b240895adafb288cc95e32edcb63b40e7f7a436f32a851fe54fb166963cb2  packages/theme/src/primitives.tsx
2b7c340a9dc4adedf0d793d433235750381a8b8103cf9f4adde104915c60f5e2  packages/contracts/src/preIssuance.ts
1619147fed0cc343ae75c5ed852396e2271af20aef3090f867625aabcff78b96  apps/api/src/preIssuance/rules.ts
3b7b5f772f37ba3109627f1d159e6e3990e7fa62b5df4109f20433b3acd3056e  apps/api/src/preIssuance/service.ts
7ec665e60823f6285898fd8296c5d7a4100fb67a78e084053df2891926381088  apps/api/src/preIssuance/routes.ts
fbb5a5740fe0beac17fb541a1ecad7111945a7ee396ee0cd4fc28f0baef1f8af  apps/tablet/src/routes/EntryFlow.tsx
63bb351bae0ffe6cf83fc7d376b99d9d90332d325abb3dfe2beaf8a3a4f6c8c4  apps/admin/src/routes/DashboardScreen.tsx
c8161a7d3126858c64585dcf613f120ce629d565fbd09a1aa9126c5cbdb93d20  apps/tablet/src/App.tsx
da7198c0a8745195da3b62c1d1b412b20796b5ae935b3b774d0132c3cdf12a49  apps/admin/src/App.tsx
```

## RED → GREEN

Preparation RED (surface absence): contracts 17 failed; API rules module missing;
integration 24 failed; tablet 31/38 failed; admin 8/14 failed; browser 18/25 failed;
typecheck 12 errors; foundation 6 failed. During implementation, genuine
behavioural RED was observed before the fixes: missing severity derivation, unscoped
options, absent required-field blocking, and boundary queries — each then made
GREEN.

Final GREEN, commands run serially:

| Gate | Result |
|---|---|
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS, boundary gate 94 files |
| `pnpm run typecheck` | PASS |
| `pnpm run test` | **178 passed** — contracts 25, API 101, tablet 38, admin 14 |
| `pnpm run test:integration` | **102 passed** (F-01 42, F-02 24, F-03 12, pre-issuance 24) |
| `pnpm run test:e2e` | **25 passed** (56.9 s) |
| `pnpm run build` | PASS, all five artefacts |
| `pnpm run check:tablet-size` | **147 603 B gzip** initial JS, threshold 250 000 |
| `pnpm run test:foundation` | **27 passed** |

F-02/F-03 behaviour preserved: their suites pass at the reconciled shell
(F-02 tablet 16, admin 12, integration 24, F-03 integration 12). The historical
F-02 rev-5 manifest reports 15/24 and S-01 10/11 — exactly the reconciled test
files; no historical manifest was regenerated.

## Disposable-copy fault sensitivity

| Fault | Result |
|---|---|
| Lookup location scope removed | fails: scope case |
| Inactive-master rejection removed | fails: inactive/unknown masters case |
| Other-remarks coupling removed | fails: Other case |
| 90-day lower bound made exclusive | fails: 90-day boundary case |
| Cancellation exclusion removed | fails: cancelled-records case |
| Duplicate location independence removed | fails: same-vehicle/other-location case |
| 15-minute lower bound made exclusive | fails: 15-minute boundary case |
| Stale lookup guard and timer cleanup removed | **not distinguishable by the frozen test** — recorded honestly; the guard is required by the spec and remains implemented |

After restoring, the copy reran clean: integration 24/24, entry component 14/14.
The copy was removed; the user's repository was not mutated.

## Planner test corrections surfaced by implementation (reviewer must confirm)

Seven entries refreshed in baseline revision 2: a wrong invalid-registration
example; distinct-violation enforcement in the draft contract; the integration
helper typing, one wrong expected occurrence (DEMO-GP-0009 has one prior), and
invalid synthetic registrations; entry-test fixture severities, listbox scoping,
expiry pass number and Other-case setup; the F-02 stub's master catalogues; browser
master selections, listbox scoping, font loading and contrast measurement; and an
explicit timeout for the cold clean-workspace run. No assertion was weakened,
skipped or narrowed.

## Known limitations (recorded, not hidden)

1. Multiple-driver choice and the expired-pass case are loc-dispatch-only and the
   single demo marshal is loc-main: covered by component + real-DB acceptance, not
   reachable in the browser with approved credentials.
2. The duplicate warning cannot occur within 15 minutes of a real browser run
   (fixed seeded history, no submission endpoint in this batch): covered by
   component + real-DB; the browser covers the persistent repeat notice.
3. Contractor Other is not in the synthetic fixture; exercised via an admin-created
   Other contractor in tests.
4. The stale-response guard is implemented but not distinguished by the frozen
   test (above).
5. UI-01's commit-size clause and UI-02's thumbnail-label clause remain deferred to
   I-02/I-06; this batch asserts no solid-green action exists.
6. The F-02/F-03 accepted production snapshot now reports 32/41 OK. The nine
   divergences are exactly the entries this batch intentionally extended or
   replaced: `packages/contracts/src/auth.ts` (new `invalid_draft` code),
   `packages/contracts/src/index.ts` (pre-issuance export),
   `apps/api/src/app.ts` (route registration and clock seam),
   `apps/tablet/src/App.tsx` (new shell), `apps/tablet/src/auth/api.ts`
   (authorised fetch and storage-key export), `apps/tablet/src/auth/session.tsx`
   (key import), `apps/tablet/src/routes/FoundationScreen.tsx` (deleted, replaced
   by the shell), `apps/admin/src/App.tsx` (new shell) and
   `docs/implementation-plan.md` (planning index). F-02/F-03 behaviour is preserved
   (their suites pass); the snapshot is historical and is not regenerated.
7. No physical tablet, camera/signature hardware, trusted HTTPS, backup/restore or
   deployment evidence is claimed.

## Review request

One combined independent review is requested at
`docs/review-requests/F-04-I-01-I-05-implementation.md`. Implementation boxes for
F-04/I-01/I-05 are ticked on this evidence; **every review box stays unchecked**.
Stop at batch exit; camera/signature/storage/submission remain the next milestone.
