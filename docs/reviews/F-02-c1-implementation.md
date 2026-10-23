# F-02 C1 independent implementation re-review

Date: 2026-10-05. **C1 production fix: verified and closed. Overall F-02:
CHANGES_REQUIRED for B1 browser acceptance setup.**

This reviewer did not implement F-02/F-03 or change production/frozen acceptance.
The owner's disclosed F-03 dependency override is acknowledged; it supplies no
review approval. Both F-02 parent boxes remain unchecked pending B1's planner
correction and independent confirmation. No new C1 production fix is requested.

## Combined gates independently rerun

The workspace now includes F-03. These results also support `docs/reviews/F-03.md`.

| Command | Actual result |
|---|---|
| `sha256sum -c docs/handoffs/F-02-tests.sha256` | 24/24 OK |
| `sha256sum -c docs/handoffs/F-03-tests.sha256` | 9/9 OK |
| `sha256sum -c docs/handoffs/S-01-tests.sha256` | 11/11 OK |
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK |
| `pnpm db:up` | Both PostgreSQL containers healthy |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS; boundary gate scans 85 files |
| `pnpm run typecheck` | PASS |
| `pnpm run test` | 136 passed: contracts 8, API 90, tablet 21, admin 17 |
| `pnpm run test:integration` | 78 passed: F-01 42, F-02 24, F-03 12 |
| `pnpm run test:e2e` | 17 passed in 27.2 s, review-started services after integration |
| `pnpm run build` | All five artifacts built |
| `pnpm run check:tablet-size` | 145046 B gzip initial JS, below 250000 B |
| `pnpm run test:foundation` | 27 passed in 64.980 s |

## C1 verified independently

Both helpers catch body reading/decoding failure; both providers attach defensive
cleanup guarded by transition identity/effect cancellation. F-03's shared
`auth/guard.ts` preserves the previous session enforcement; F-02 DB regressions
pass. Inspected the changed helpers/providers and extracted guard/auth routes.

Browser reproduction rerun:
`python3 /tmp/opencode/f02-review-browser-launch.py /tmp/opencode/f02-restoration-body-review.py`.
For **both clients**, invalid JSON and decoded-invalid-schema controls now yield
no page errors, token removed and login visible.

Independent disposable-copy sensitivity:
`python3 /tmp/opencode/f02-c1-independent-sensitivity.py`:

| Behaviour / fault | Tablet C1 | Admin C1 |
|---|---|---|
| Clean control | 4 passed | 4 passed |
| Remove helper catch and provider rejection handling | 2 failed / 2 passed | 2 failed / 2 passed |
| Swallow failure but retain stored token | 2 failed / 2 passed | 2 failed / 2 passed |
| Remove stale-transition cleanup guard | 1 failed / 3 passed | 1 failed / 3 passed |
| Restore original bytes | 4 passed | 4 passed |

The `C1:` filter non-selects 12 unrelated tablet and 8 admin cases per run.
Copies exclude secrets/generated artifacts; dependencies are used read-only.
Mutations stay outside the repository; temporary copy removed. This is focused
sensitivity evidence, not a whole-suite mutation pass.

## B1 — Medium: restored-role test setup races with anonymous restoration

References: `apps/tablet/e2e/f02-auth.spec.ts:139–151`;
`apps/admin/e2e/f02-auth.spec.ts:111–123`.

Tests navigate anonymously, write a token with `page.evaluate`, then reload.
Anonymous navigation starts `/auth/session` requests. A pending refusal can
clear the externally seeded token before reload, invalidating the intended
authenticated-restoration precondition. The implementer returned intermittent
failures; the current serial suite passes but does not correct that setup.

Independent deterministic probe:
`python3 /tmp/opencode/f02-review-browser-launch.py /tmp/opencode/f02-restored-test-setup-review.py`.
It holds real initial anonymous responses, seeds a real wrong-role token as the
tests do, then releases those responses. Both clients show:

- storage write immediately readable: **true**;
- initial session responses: **401, 401**;
- seeded token retained after initial lookup: **false**.

This demonstrates application cleanup overwriting externally seeded storage,
not a Chromium propagation failure. The handoff's propagation explanation is
not established. No flake rate is independently claimed. Source is untouched
and helper-started servers are stopped afterward.

Planner: seed via `page.addInitScript` before the first navigation or equivalent
isolated storage state. Preserve real API tokens, role-refusal, protected-content
absence and server revocation assertions. Archive the current manifest, document
a numbered F-02 baseline revision, and correct the causal handoff description
in an addendum. Do not add arbitrary sleeps or retry away failures. No runtime
change is indicated; obtain independent confirmation before task approval.

## Inspected snapshot and limits

F-02 manifest hash:
`58794d8f905cee66b9514ebc3d8efd7d05120145c7cd71640c15e4f24510032e`.

```text
beb461e7bb003f06bbd8e576ba9bda479905bcc238f7fae30602840651ae7503  apps/tablet/src/auth/api.ts
7d27e57954dd815a0886f3acc8fdf646712e93b09feb0f3ff1b55d153ddfaaff  apps/admin/src/auth/api.ts
cb14a7746900b0268d8a3800db6bd03e5d9d020a7cec2019df6afd743a62eb2d  apps/tablet/src/auth/session.tsx
89410660cbc45f7d0067611ce6cbe3f2e028f715b7121dd034af3465e55df901  apps/admin/src/auth/session.tsx
```

Inspected hashes are not an accepted snapshot. Scoped AUTH-01–AUTH-05 passes
the automated suite; B1 concerns acceptance integrity, not an observed runtime
permission bypass. AUTH-06, production credentials, hardware, HTTPS, deployment,
restore and hosted CI remain outside review. F-04 remains blocked on both reviews.
