# F-03 implementation plan

Authority: `docs/eChallan_replacement_spec.md` v0.1 with the B-05 policy in
`docs/decisions.md`; scope and wiring are fixed in `specs/004-master-data/spec.md`.
Preserve every F-01 file, migration and baseline, and every F-02 behaviour.

1. Verify the F-03 planner manifest and the S-01/F-01/F-02 baselines; inspect the
   reviewed F-01 snapshot and the F-02 implementation record.
2. Run the focused acceptance against the current surfaces and record genuine output,
   distinguishing surface absence from behavioural RED.
3. Add the shared master contracts in `packages/contracts` (kind vocabulary, record and
   list/response shapes, per-kind create/update request schemas) and export them.
4. Implement the Admin-only master service over the existing F-01 tables: list
   (all/active-only with the gate-location rule), create, update, idempotent
   deactivate. No schema change, no migration.
5. Wire `GET /masters/:kind` (any authenticated role) and `/admin/masters/**` (Admin
   only) into the existing app, reusing one shared session guard. Enforce role and
   kind-specific field rules on the API.
6. Obtain behavioural RED for the enforcement paths (non-admin refusal, active-only
   catalogue, gate parent rule, history preservation) before completing them, then
   implement and obtain GREEN on the unchanged acceptance.
7. Run format check -> lint -> typecheck -> focused unit and real-DB suites -> root
   unit -> real-DB integration -> F-01/F-02 regressions -> browser journeys ->
   affected builds -> tablet size -> foundation clean-artifact checks.
8. Disposable-copy sensitivity: bypass in turn the Admin role check, the active-only
   catalogue filter, the gate-location rule, the kind-field validation, the
   idempotent deactivation and the history-preservation guarantee (mutate a snapshot
   column from a master mutation) and show the matching acceptance fails; restore and
   rerun cleanly. Never mutate the user's repository.
9. Record exact commands, counts, changed files, migration/seed effects and known
   limitations in `docs/handoffs/F-03.md`; tick implementation only after complete
   verification and stop for independent review.

## Focused commands

```bash
sha256sum -c docs/handoffs/F-03-tests.sha256
sha256sum -c docs/handoffs/S-01-tests.sha256
sha256sum -c docs/handoffs/F-01-tests.sha256
sha256sum -c docs/handoffs/F-01-corrections-tests.sha256
sha256sum -c docs/handoffs/F-02-tests.sha256
pnpm build:packages
pnpm db:up
pnpm --filter @echallan/api exec vitest run --project unit tests/unit/f03-master-contracts.test.ts
pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f03-master-data.test.ts
pnpm --filter @echallan/tablet run test
pnpm --filter @echallan/admin run test
pnpm run test:e2e
```

Existing regression commands: `pnpm test:foundation`, `pnpm run format:check`,
`pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run test:integration`,
`pnpm run build`, `pnpm run check:tablet-size`.

## Boundaries

Planner-owned acceptance files, the feature spec/plan, `docs/decisions.md`,
`docs/eChallan_replacement_spec*.md` and every SHA-256 manifest are read-only for the
implementer. No migration is added: the F-01 schema already carries `is_active` and the
immutable snapshots. No master delete, no reactivation, no screens, no audit writes.
Enforcement is server-side; hiding a control is not authorisation.
