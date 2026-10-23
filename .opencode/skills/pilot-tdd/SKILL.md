---
name: pilot-tdd
description: Use for e-Challan pilot task preparation, test-first implementation, independent review, pilot.batch foundation, or checklist updates. Enforces prepared scope and separate implementation/review gates.
---

# Pilot task handoff

1. Read `docs/development-workflow.md`, the requested task in
   `docs/implementation-plan.md`, its acceptance cases in `docs/test-cases.md`,
   and its blockers in `docs/decisions.md`. Read the PRD/design sections cited.
2. Determine the role: planner, implementer, or reviewer. Keep that role for the
   task. If the requested ID or scope is missing, ask rather than select a phase.
3. Dependencies need both implementation and review checkboxes. Report BLOCKED
   when prerequisites, approved rules, services, or tools are missing.
   Exception: S-01 creates absent application runners/services from the planner's
   smoke specification; external prerequisites must still be available.
4. Planner: prepare `specs/<feature>/` and executable acceptance tests, with
   deterministic fixtures and RED evidence. Setup tasks get smoke checks.
   Missing-module failures only prove wiring, not business assertions.
5. Implementer: run the supplied tests, implement the smallest complete change,
   rerun affected checks after refactoring, and record evidence in
   `docs/handoffs/<task-id>.md`. Do not weaken or skip tests to obtain green.
   Tick implementation only after success. Stop at this task.
   Verify planner-recorded SHA-256 test baselines; do not overwrite preparation.
   The authorised foundation batch spans S-01 internal phases A–F with disjoint
   workers; read docs/handoffs/foundation-batch.md. Stop for parent review afterward.
6. Reviewer: inspect changed source, test quality, config and migrations; rerun
   checks. Cover failure paths, permissions and applicable tablet behaviour.
   Record PASS / CHANGES_REQUIRED / BLOCKED in `docs/reviews/<task-id>.md`.
   Tick review only on PASS, in a fresh session/model independent of implementation.
   Return test defects to the planner and production fixes to the implementer
   rather than applying them while reviewing. Record accepted file hashes and
   invalidate approval if those files/requirements change later.

No command logs means no claimed test pass. No real-device evidence means no
claimed hardware acceptance. A runnable suite passing zero relevant tests is
not verification. After repeated non-progress, return a precise blocker rather
than retrying indefinitely. Templates in `docs/development-workflow.md` define
the required handoff and review records.
