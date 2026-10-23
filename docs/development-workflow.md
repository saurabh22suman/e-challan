# Gate-pilot development workflow

## Installed tooling

- Spec Kit 1.0.13 is initialized for OpenCode: `.specify/` contains its scripts,
  templates and workflow; `.opencode/commands/speckit.*.md` contains commands.
- Reproducible CLI invocation: `uvx --from specify-cli==1.0.13 specify check`.
  Python 3.11+ and uv are required. No global Specify installation is needed.
- Initialization used `uvx --from specify-cli==1.0.13 specify init --here --force --non-interactive --integration opencode`.
  Do not rerun init casually: managed files may be overwritten.
- OpenCode loads project instructions from `opencode.json` and local agents,
  commands and skills. Quit and restart OpenCode after changing these files.
- No model is pinned. Select the implementing model in a fresh OpenCode session;
  return to a separate reviewer session/model for acceptance.
- Application test runners are not installed yet. S-01 creates the harness.
  The Markdown test catalogue is a specification, not an executed test suite.
- S-01 is the bootstrap exception: missing application runners/services that it
  is tasked to create are expected. The planner supplies smoke-check specifications;
  the implementer creates the harness, then runs them. Missing external prerequisites
  (e.g. an unavailable container runtime) remain blockers, not passing checks.
- Use project-local `pilot-tdd` for this workflow. The globally exposed
  `execute-task` skill contains incompatible project assumptions and is disabled
  in this project's skill permissions. Use existing frontend/testing skills when
  their actual tasks arise; they do not override the pilot's scope or gates.
- Treat the design doc's MUI snippet/claimed strict check as reference material,
  not a reproduced compatibility pass; S-01/F-04 must verify it against pinned versions.

## Roles and one-task loop

1. **Planner/reviewer model:** choose a ready task; verify reviewed dependencies
   and relevant decisions. Define expected behaviour and write acceptance tests.
2. **Implementer model:** run tests, record RED, implement, obtain GREEN, refactor,
   run the affected regression checks, then tick implementation and stop.
3. **Independent reviewer:** inspect the actual changes and test integrity,
   rerun checks, record findings. Approve and tick review, or return the task.
4. **User and planner:** advance only after review PASS. Phase completion requires
   every task's two boxes plus the phase's acceptance evidence.

The implementer may retry fixes within its task. After three attempts with no
new evidence/progress, document the blocker and return it; do not loop forever.
Infrastructure failures and undecided requirements cannot be fixed by modifying
expectations. No automatic commits, pushes, or deployments are implied.

## Commands in OpenCode chat

```text
/pilot.tests S-01
/pilot.implement S-01
/pilot.review S-01
```

Use a separate implementation session for the middle command. These are prompts,
not a background orchestration service: the user launches each role explicitly.
The instructions/checklists guide agents; they are not filesystem access controls.
Review the diff to ensure acceptance tests were preserved.
Run review in a fresh session/model that did not implement the task; switching
agent names within the implementation conversation is not independent review.

### Long-running prepared foundation batch

The user authorised parallel agents and a longer handoff across prepared subphases.
`/pilot.batch foundation` executes phases A–F inside S-01 using
`docs/handoffs/foundation-batch.md`. Root/shared writes and installs stay with the
coordinator; workers get disjoint ownership. This exception allows uninterrupted
internal subphase execution, not self-review or moving into blocked domain tasks.
It stops with a review request to the separate live planner session. There is no
automatic communication between terminals; the user brings the checkpoint here.

For each bounded feature, use Spec Kit's normal sequence in the planner session:

```text
/speckit.specify <bounded feature, PRD IDs and relevant task IDs>
/speckit.clarify
/speckit.plan
/speckit.tasks
/speckit.analyze
```

Use `/pilot.implement <task-id>` for execution rather than the stock
`/speckit.implement`, which processes all feature tasks. `/speckit.converge` can
identify gaps after review; new work goes back through planning and test preparation.
Keep `docs/implementation-plan.md` as the cross-feature index; feature `tasks.md`
holds the finer steps. Tick matching feature implementation tasks after verification,
but do not treat them as review approval. Spec Kit `checklists/` measure requirements
quality and are separate from implementation completion.

Feature state lives in `.specify/feature.json`; no Git extension is installed.
To inspect an explicit feature without changing state:

```bash
SPECIFY_FEATURE_DIRECTORY=specs/001-foundation SPECIFY_FEATURE_NO_PERSIST=1 bash .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

The S-01 feature's spec.md/plan.md/tasks.md now exist; its prerequisite check passes.
This is artifact readiness, not an application-test pass.

## Test ownership and verification

- Planner-owned cases map to PRD IDs. Write actual tests task by task after the
  harness exists; do not create dozens of placeholder/skipped tests.
- Before handoff, record the approved test/fixture/config/acceptance-document paths
  and SHA-256 hashes in `docs/handoffs/<task-id>-tests.sha256`, plus the spec and
  preparation session reference. `sha256sum -c docs/handoffs/<task-id>-tests.sha256`
  verifies that baseline at implementation start and review. Planner-owned
  preparation goes in `<task-id>-prepared.md`; implementer evidence goes in
  `<task-id>.md`, without replacing preparation. A revised baseline requires a
  documented planner correction and reviewer confirmation, not implementer edits.
- Review reports record hashes of all accepted changed files and the test baseline.
  Any later change to reviewed code, tests or requirements invalidates the affected
  review box; rerun checks and obtain a new review. Hash records aid comparison,
  not adversarial tamper-proofing. S-01 bootstrap records its smoke specification
  baseline; executable harness files are reviewed once created.
- Proposed harness: Vitest for contracts/domain/component tests, React Testing
  Library for components, Fastify inject plus isolated PostgreSQL for API
  integration tests, Playwright for browser journeys. S-01 verifies compatibility
  and installs/pins the actual versions.
- API rules, audit and transactions require real database tests; mock storage
  failures deliberately, but test the real local adapter separately.
- The planner records exact focused commands and test counts in each handoff.
  S-01 establishes root lint, format-check, typecheck, test and build scripts;
  later tasks use those verified scripts, not guessed commands.
- Gate order after GREEN: format check -> lint -> typecheck -> relevant unit and
  integration tests -> relevant browser tests -> affected production builds.
  A shared-contract change verifies both client consumers and the API.
- Prove key tests are meaningful: in an isolated disposable copy, introduce a
  relevant fault (e.g. bypass evidence validation) and show the acceptance test
  fails. Remove the fault and rerun. Do not mutate user work for this check.
- Document skipped/not-run/manual checks explicitly. Mocked camera input proves
  application flow, not rear-camera hardware or signature feel.

## Implementer handoff: docs/handoffs/<task-id>.md

Create a record containing:

- Task ID, feature path, scope, PRD/case IDs and reviewed dependencies.
- Resolved decision references and outstanding blockers.
- Files changed; migration/storage effects if relevant.
- RED command, failing assertion and reason; GREEN command, counts and output.
- Format/lint/typecheck/regression/build commands and actual results.
- Failure-sensitivity check and clean rerun results, when required.
- Manual/device checks performed and those still pending.
- Known issues, test changes with planner approval, and review request.

## Reviewer report: docs/reviews/<task-id>.md

Record task, inspected baseline/files, commands actually rerun, and findings with
severity and file/line references. State PASS, CHANGES_REQUIRED, or BLOCKED.
Include acceptance-case coverage and any missing device evidence. On changes
required, uncheck implementation if its acceptance conditions no longer hold;
leave review unchecked and return actionable findings. No self-review approval.
Test defects or weak assertions go to the planner first, production fixes to the
implementer. Weak tests alone cannot justify implementation acceptance: uncheck
implementation when the claimed verification no longer proves the task.

## Phase exits

The foundation, issuance, review/reporting and deployment each get a review
checkpoint. Staff use begins only after all P0 cases, real-device acceptance and
backup/restore evidence pass. Deployment is a separate task, not an automatic
side effect of green tests. The PRD's M1 demo can be used as an internal milestone,
but this backlog targets M2/M3 gate usage.
