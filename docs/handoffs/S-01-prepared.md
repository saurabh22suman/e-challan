# S-01 prepared implementation handoff

Prepared by planner session, 2026-10-01. Parent checklist: S-01; cases:
SET-01–SET-04. Feature state: specs/001-foundation. No prerequisites; bootstrap
exception permits creating the application tooling that is currently absent.

## Inputs

- Feature spec, plan, research and 13 implementation subtasks in tasks.md.
- Planner-owned Python workspace/guard acceptance tests and Node API smoke probe.
- Synthetic Indian fixture: docs/demo-data.json, including linked gate passes.
- Baseline: docs/handoffs/S-01-tests.sha256; verify before and after implementation.
  Excludes mutable implementation checklists and the hash manifest itself.
  Includes this prepared handoff; implementer results go in S-01.md instead.
  Do not regenerate or modify the baseline as implementer.

## Environment checked

- Node22.23.2; pnpm11.22.0; Python3.12.3; uv available.
- Docker29.7.2 client **and running daemon** accessible in this workspace.
- No application manifests/services or installed browser binaries verified yet.
- Candidate versions/peers verified through npm metadata/official documentation;
  actual installation/build graph still needs implementing-agent verification.

## RED evidence

Command executed by planner:

```bash
python3 -m unittest discover -s tests/foundation -p 'test_workspace.py' -v
```

Result: **4 tests executed, 4 expected failures**, reporting missing root/app
manifests, root env example and CI workflows. No import-error substitute, no
application business tests claimed. Re-run the final baseline version at handoff.

Guard suite has 12 additional tests with positive/negative temporary fixtures;
it is runnable once root scripts exist. It checks allowed imports, cross-app
directions, MUI barrels, admin widgets, gzip rather than raw size, static import
recursion/deduplication, lazy exclusion and malformed/missing assets. Do not claim
these pass before implementation. The API probe requires live API/DB services.

Spec Kit prerequisite check already passed with spec/plan/tasks present:

```bash
SPECIFY_FEATURE_DIRECTORY=specs/001-foundation SPECIFY_FEATURE_NO_PERSIST=1 bash .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
```

Node syntax check passed for tests/foundation/probe-api.mjs. This is not a live
API verification. Full check commands and required counts are in feature plan.md.

## Boundaries

This handoff authorises infrastructure, foundation screens and demo-fixture storage
only. F-01 and later business tasks are not authorised. Production decisions stay
open. No API credential/login, issued challan schema, penalty/escalation rule,
camera/signature implementation or VPS deployment is included in S-01.

Run all feature phases, optionally delegate disjoint workers, then request review
via docs/review-requests/S-01.md. Parent Reviewed remains unchecked.

## Review expectations

Reviewer checks test integrity/hashes, real tool execution and absence of placeholder
scripts; TS/package consumption; DB environment/test isolation and repeatability;
guard failure sensitivity; browser runs and exact commands; actual tablet gzip
measurement; CI wiring; and scoped changes. Worker self-reviews do not substitute
for review by the separate live planner/reviewer session.
