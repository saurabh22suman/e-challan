# Long-running foundation batch

User authorisation: 2026-10-01. Planner/reviewer stays in one live session;
implementer runs in another and may delegate parallel agents. Batch scope is
the six implementation phases **inside S-01**, not unresolved domain phases.

## Start

In a fresh OpenCode process at the repo root, select the implementing model and
invoke `/pilot.batch foundation`, or paste the prompt below. Restart is required
to discover the added command/worker. No model/provider is pinned.

## Copy-paste prompt

```text
You are the long-running implementation coordinator for the e-Challan webapp.
The planner/reviewer remains in a separate live session. Complete the prepared
foundation batch (S-01, phases A–F) and stop at the independent-review checkpoint.

First read AGENTS.md, docs/development-workflow.md, docs/decisions.md,
docs/handoffs/S-01-prepared.md and specs/001-foundation/spec.md, plan.md,
research.md and tasks.md. Load the project-local pilot-tdd skill. Verify
sha256sum -c docs/handoffs/S-01-tests.sha256, then run the supplied workspace
acceptance checks and record their expected setup RED.

Implement all six prepared phases: workspace/dependencies, database/API plumbing,
shared contracts and frontend shells, guardrails/browser tests, CI/documentation,
then consolidated verification. Node22, pnpm and Docker are already available.
Keep all work infrastructure-only with synthetic fixtures. Preserve the existing
Indian demo data and linked gate-pass records for the future validated seed adapter.

You may spawn parallel pilot-worker subagents after establishing the root
workspace/interfaces. Give each explicit disjoint file ownership and acceptance
criteria. Backend owns apps/api and assigned DB files; frontend owns apps/tablet,
apps/admin and packages/theme; contracts/testing owns packages/contracts and
additional application tests. You own root config/scripts/lockfile/CI/Compose,
dependency installation, integration and evidence. Serialize overlapping writes;
workers request dependencies from you instead of independently installing.

Do not change planner-owned tests/foundation files, prepared specs or test hashes
to get green. Report any genuine test/contract defect back to the planner. Run
meaningful test-first checks for new harness samples; propagate failures and
verify real PostgreSQL, frontend browser journeys, boundary rejection and initial
JS gzip budget. Execute every command in specs/001-foundation/plan.md, record test
counts and failure sensitivity, and rerun after fixes/refactoring. Keep working
through ordinary errors; return a blocker after repeated no-progress attempts.

On success, tick completed feature implementation subtasks and S-01 Implemented
only. Write docs/handoffs/S-01.md with changed files, actual RED/GREEN output,
full checks/counts, environment and known limitations. Write
docs/review-requests/S-01.md pointing to that evidence. Leave Reviewed unchecked
and stop. Your internal worker checks are not the independent review.

No F/I/R/V task, business-rule decision, Git commit/push or VPS deployment is
authorised in this batch. The next batch is prepared after independent review.
Tell the user: 'S-01 ready for independent review', or list precise blockers.
```

## Communication between sessions

There is no automatic LLM message bus between terminals. Shared files hold state,
but a review request file does not summon the reviewer. At the checkpoint, the
user tells the planner session **Review S-01**. Reviewer writes
`docs/reviews/S-01.md`; findings go back to the implementer session for fixes.
Only the reviewer ticks Reviewed. Do not busy-poll waiting for a review or create
self-approved reviewer reports. Preparation for later batches happens here.

## Why this batch stops at foundation

This batch supplies enough independent work for parallel implementation and a
complete build/test harness. Domain contracts, shift identity, escalation and
Resolved behaviour are still undecided. Those later phases need their own
planner-owned executable tests and cannot responsibly be included as guessed work.
