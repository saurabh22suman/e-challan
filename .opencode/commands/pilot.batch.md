---
description: Execute the prepared multi-phase foundation batch with optional disjoint parallel workers, then stop for review.
agent: pilot-implementer
---

Execute the prepared batch $ARGUMENTS. Currently only `foundation` is authorised.
Read docs/handoffs/foundation-batch.md, docs/handoffs/S-01-prepared.md and
specs/001-foundation/{spec,plan,research,tasks}.md. Verify the baseline hashes.
Complete phases A–F of S-01; delegate disjoint slices to pilot-worker subagents
as useful, following file ownership. Preserve planner-owned acceptance inputs.
Coordinate dependency installation and root/shared files centrally. Keep working
through verified subphases without asking for approval after routine steps.
On full success tick S-01 Implemented only, write the required handoff and review
request, and stop. The user brings the review request to the separate live
planner/reviewer session. No other implementation-plan task is authorised.
Return precise blockers rather than inventing business rules or weakening tests.
