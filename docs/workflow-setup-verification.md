# Workflow setup verification — 2026-10-01

This records tooling/document setup, not acceptance of application code.

## Checks performed

- `uvx --from specify-cli==1.0.13 specify check`: passed; uv/Python and OpenCode
  available. Initialization with the OpenCode integration completed.
- Installed metadata: `.specify/integration.json` identifies Spec Kit 1.0.13 and
  OpenCode with dot-separated command invocation; no Git extension installed.
- `opencode --pure debug agent pilot-implementer`: loaded the local primary agent
  and confirmed project skill permission denying incompatible `execute-task`.
  Planner and reviewer configurations also loaded through the same debug command.
- Local `pilot-tdd` passed the skill-creator `quick_validate.py` structural check.
- `opencode.json` passed validation against the published OpenCode JSON schema.
- Structural catalogue check found **21 unique tasks**, each with two unchecked
  gates, and **75 unique acceptance cases**, all referenced by task mappings.
  Pilot command frontmatter routes to the intended local agents.

Schema/routing/catalogue validation used a temporary Python checker in
`/tmp/opencode/validate-pilot-workflow.py`; it is session verification tooling,
not part of the application or its future CI suite.

## Independent reader check

A separate reader inspected the workflow against the PRD/design and dry-ran
bootstrap, undecided escalation, self-review/early advancement and weak-test
scenarios. Findings led to:

- An explicit S-01 bootstrap exception.
- Component versus integrated submission acceptance ownership.
- Explicit repeat-number/action display and per-field Other cases.
- Planner-owned test hashes and separate prepared/implementation records.
- Fresh-session independent review and invalidation after accepted files change.
- Issuance timing and expanded accessibility acceptance coverage.
- Blocking the conflicting globally available task skill.

The reader's follow-up found a remaining signature-refusal scope ambiguity;
SIG-04 now owns Unit/UI checks and SUB-01/SUB-02 own actual commit acceptance.

## Not yet verified

No application exists; no application unit/API/browser tests, migrations, builds,
camera/signature hardware checks, deployment or restore drills have run. No
implementation/review task checkbox has been ticked. Spec Kit feature artifacts
and executable acceptance tests are prepared task by task, starting with S-01.
Business/hosting/device decisions remain open in `decisions.md`.
