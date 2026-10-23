# Admin user management implementation plan

Authority: `specs/010-user-management/spec.md`, PRD E1.4/E5.3, owner
authorisation 2026-10-21. Additive to the reviewed-pending 009 slice.

## Phase 1 — Contracts and acceptance

1. Add `CreateUserRequestSchema`, `AdminUserResponseSchema` and the `conflict`
   error code; export from the package root.
2. Add planner-owned tests:
   - `packages/contracts/test/user-management.test.ts`;
   - `apps/api/tests/integration/admin-user-management.test.ts`;
   - `apps/admin/src/__tests__/user-management.test.tsx`;
   - `apps/admin/e2e/user-management.spec.ts`.
3. Record `docs/handoffs/010-user-management-tests.sha256`.

## Phase 2 — API

4. Extend `apps/api/src/admin/routes.ts`:
   - create with role/location validation and duplicate conflict;
   - deactivate with self guard, session revocation and audit;
   - reactivate with audit.
5. Reuse `hashPassword`, the admin session guard and `user_locations`; no
   migration is required (existing columns and unique username constraint).
6. Return only the public AdminUser shape and never password material.

## Phase 3 — Dashboard

7. Add operations-client calls: create user, deactivate, reactivate, list active
   locations.
8. Add the Create-user dialog, row Deactivate/Reactivate actions and confirmation.
9. Keep 009 reset/list/detail behavior, labels, heading and responsive container.

## Phase 4 — Verification

```bash
sha256sum -c docs/handoffs/010-user-management-tests.sha256
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

Failure sensitivity in a disposable copy: remove the self-deactivation guard and
show the self test fails; remove session revocation and show the old-session test
fails; remove the location-role check and show the missing-location test fails.
Restore, rerun, remove the copy. Record evidence in
`docs/handoffs/010-user-management.md`; leave all review boxes unchecked.
