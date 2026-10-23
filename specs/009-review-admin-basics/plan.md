# Implementation plan — review and user administration slice

Authority: `specs/009-review-admin-basics/spec.md`; D3; replacement specification
v0.1; PRD E1.4/E1.5/E3/E4.1. Owner authorised this bounded slice on 2026-10-21.
Preserve every existing reviewed behavior. New production work is additive.

## Phase 1 — Contracts and acceptance preparation

1. Add `packages/contracts/src/operations.ts` and export it from the package root.
   Add `invalid_transition` to the approved error codes.
2. Add planner-owned acceptance:
   - `packages/contracts/test/operations.test.ts`;
   - `apps/api/tests/unit/password.test.ts`;
   - `apps/api/tests/integration/challan-review.test.ts`;
   - `apps/admin/src/__tests__/operations.test.tsx`;
   - `apps/admin/e2e/review-admin.spec.ts`.
3. Reconcile the F-04 foundation surfaces that asserted the old empty state:
   component and browser assertions move to the real list/empty/failure surface.
   No historical accepted baseline is regenerated.
4. Record the test manifest and hashes in
   `docs/handoffs/009-review-admin-basics-tests.sha256`.

## Phase 2 — API and storage

5. Add nullable `users.password_hash`. Generate one additive Drizzle migration;
   do not edit historical migrations.
6. Add `apps/api/src/auth/password.ts` using pinned `@node-rs/argon2` with the
   Argon2id algorithm. Hash/verify must never log or return plaintext.
7. Extend login: a stored hash takes precedence; a null hash keeps the existing
   env-backed path and role guard. Keep fail-closed behaviour when no credentials
   are configured. Use a dummy verify to reduce the obvious user-existence timing
   difference.
8. Refactor the existing `GET /challans/:id` into
   `apps/api/src/challans/routes.ts`, preserving its responses and error codes.
   Add `GET /challans` and `POST /challans/:id/review` with:
   - Supervisor/Admin role checks and location scope;
   - status filter validation;
   - append-only action history and detail assembly;
   - transactional status guard, action row and audit row;
   - `409 invalid_transition` for illegal order, Cancelled and out-of-scope
     current-state requests.
9. Add `apps/api/src/admin/routes.ts`:
   - Admin-only user list without password material;
   - Admin-only reset with Argon2id, session revocation and audit.
10. Add `GET /challans`/detail/list contract validation with `parseContract`.

## Phase 3 — Admin dashboard

11. Extend the session context with the current token so authenticated API calls
    can be made without a second storage read.
12. Add `apps/admin/src/api/operations.ts` (contract-parsed browser client).
13. Replace the dashboard empty state with the review workspace:
    - role-aware tabs;
    - list + status filter + loading/empty/failure/retry;
    - detail + history + review action forms;
    - Admin user list and reset dialog;
    - success/failure notices; sign out after a self-reset.
14. Keep exact-path MUI imports; no new UI framework, chart, data grid or date
    library. Admin bundle constraints are not the tablet budget, but imports stay
    exact-path for consistency.

## Phase 4 — Verification

Run in this order:

```bash
sha256sum -c docs/handoffs/009-review-admin-basics-tests.sha256
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm --filter @echallan/contracts run test
pnpm --filter @echallan/api run test
pnpm --filter @echallan/api run test:integration
pnpm --filter @echallan/admin run test
pnpm --filter @echallan/admin run build
pnpm run build
pnpm run test:e2e
```

Then prove failure sensitivity in a disposable `/tmp` copy (never mutate the
workspace): remove location scoping and show the cross-location test fails;
remove the mandatory-remarks check and show the resolve test fails; remove hash
verification and show the reset-login test fails. Restore and rerun clean.

Record actual counts, RED/GREEN, CLI evidence, deviations and the review request
in `docs/handoffs/009-review-admin-basics.md`. Leave every review box unchecked.
