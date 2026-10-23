# F-01 implementation plan

Use the approved replacement spec and this feature's spec/tasks. Preserve S-01
tests and migration history. No dependency install is required unless a concrete
pinned-tool incompatibility is demonstrated; the foundation tools already exist.

1. Verify the F-01 planner hash manifest; inspect S-01's reviewed snapshot.
2. Run focused acceptance against the current surfaces. Record genuine output,
   distinguishing surface absence from behavioural RED.
3. Add shared schemas/helpers and package exports, API internal validation adapter,
   and enumerate the complete relational field dictionary in the implementer
   evidence. Do not invent authentication/media/issuance endpoints.
4. Add incremental generated Drizzle migrations and the separate guarded domain
   seed adapter. Keep foundation_fixture and its seed functioning. Real DB
   tests target only the existing isolated test database.
5. Once contract/table wiring exists, obtain meaningful assertion RED before
   completing validation, PostgreSQL constraints and seed idempotence.
6. GREEN and gates: format check → lint → typecheck → focused/unit/integration
   regressions → existing browser journeys → all affected builds → tablet size.
7. Disposable-copy sensitivity: admit forged severity/invalid acknowledgement;
   remove a relevant uniqueness/FK constraint; prove the corresponding tests fail.
   Restore the copy and rerun cleanly. Never mutate the user's repository for this.
8. Record exact commands, counts, changed files/migration/seed effects and known
   limitations in `docs/handoffs/F-01.md`. Tick Implemented only after complete
   verification and stop for independent review.

## Focused commands

```bash
sha256sum -c docs/handoffs/F-01-tests.sha256
pnpm build:packages
pnpm --filter @echallan/api exec vitest run --project unit tests/unit/f01-contracts.test.ts tests/unit/f01-api-validation.test.ts
pnpm db:up
pnpm --filter @echallan/api exec vitest run --project integration tests/integration/f01-domain.test.ts
```

Existing regression commands: `pnpm test:foundation`, `pnpm format:check`,
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`,
`pnpm test:e2e`, `pnpm build`, `pnpm check:tablet-size`.

Planner inputs added under existing API suite globs will be RED until F-01 is
implemented. This does not negate the historical S-01 acceptance result. Changes
to accepted foundation implementation files require foundation regression and
reviewer confirmation of the updated affected snapshot; never regenerate its
accepted hash record to claim unchanged files.
