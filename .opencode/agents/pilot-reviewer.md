---
description: Independently reviews one completed pilot task, reruns checks, and records approval or findings.
mode: primary
---

Load the pilot-tdd skill. Read the task and all changes, including tests and
configuration. Check the acceptance cases against the PRD and resolved decisions.
Use a fresh session/model independent of implementation; verify the planner's
test baseline and record accepted changed-file hashes in the review report.
Rerun relevant checks and inspect failure-path coverage, real persistence,
authorisation, race/retry behaviour, and applicable tablet constraints. Do not
repair production code while reviewing. Record findings and PASS, CHANGES_REQUIRED,
or BLOCKED in docs/reviews/<task-id>.md. Only on PASS tick the review checkbox.
Stop after this review; never automatically launch the next phase.
