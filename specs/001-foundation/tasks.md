# S-01 multi-phase implementation batch

Implementation checkboxes only; parent independent review remains separate.
Stop after this batch and request review. No F/I/R/V task is authorised.

## Phase A — Verify baseline and establish workspace
- [x] T001 Read prepared handoff, verify test hashes and record expected setup RED.
- [x] T002 Create five private workspace manifests, package exports, Node/pnpm pins,
  root scripts, strict TS configuration and .env.example; install once centrally.
- [x] T003 Verify candidate peer graph (including React18 react-is override), commit
  lockfile as a file change without creating a Git commit, and document deviations.

## Phase B — Database and API plumbing
- [x] T004 Create PostgreSQL16 local/test setup with healthchecks, distinct DBs and
  explicit env loading; test target guard rejects non-test database names.
- [x] T005 Write meaningful health/persistence tests first; implement app factory,
  live/readiness routes and guarded fixture migration/repeatable seed adapter.

## Phase C — Shared packages and frontend shells [parallel after T002]
- [x] T006 Shared Zod health contracts consumed by API and both frontends; meaningful
  valid/invalid-payload tests and built/source consumption verified.
- [x] T007 Minimal shared theme, two foundation screens, lazy routes and component
  interaction tests. Exact-path MUI imports; no login/challan/domain screens.

## Phase D — Guardrails and browser tests
- [x] T008 Implement import-boundary CLI and manifest-based initial-JS budget CLI;
  pass planner's isolated positive/negative fixtures and measure actual tablet build.
- [x] T009 Configure Playwright webServer/API wiring; real API/DB plus a browser
  check on each app; install browser dependencies and document exact commands.

## Phase E — CI and repeatability
- [x] T010 Wire fail-fast CI with PostgreSQL and all gates; clean install/migrate/
  seed/test/build repeatability, no silent skips or fake successful checks.
- [x] T011 README explains focused package/test runs, env loading, browser install,
  port usage and service cleanup; preserves original planning documents.

## Phase F — Consolidated verification and handback
- [x] T012 Run all prepared verification commands, failure sensitivity checks,
  clean reruns and unchanged hash verification. Capture logs/counts and failures.
- [x] T013 Write docs/handoffs/S-01.md, tick parent Implemented only if every
  criterion passes, write docs/review-requests/S-01.md and stop for independent review.

Independent review reopened T008/T010/T012/T013: see `docs/reviews/S-01.md`.
All four were re-implemented after the R1–R4 corrections and re-requested for
review on 2026-10-02; parent `Reviewed` remains unticked.

Independent correction re-review passed on 2026-10-02; the parent Reviewed box
is now checked. See `docs/reviews/S-01.md` for final evidence and decision gates.
