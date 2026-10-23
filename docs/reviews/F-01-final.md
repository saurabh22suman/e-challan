# F-01 final independent review

**Result: PASS — 2026-10-03.** Task F-01, feature `specs/002-demo-domain`,
acceptance DOM-01–DOM-03. This session did not implement the reviewed domain
source or migrations. User-authorised same-session preparation/implementation
and the original contract-RED deviation are disclosed in the handoff; neither is
misrepresented as test ownership or independent review. This report supplies the
separate implementation review and supersedes earlier CHANGES_REQUIRED outcomes.

## Findings closed

- **R1:** PostgreSQL canonical-form checks plus uniqueness reject normalised
  vehicle/pass duplicates. The approved vehicle and gate-pass rules remain distinct.
- **R2:** master severity is NOT NULL and constrained to Minor/Major/Critical.
  Fixture default actions remain separately nullable as planned.
- **R3:** authoritative post/gate/location mapping is persisted, mandatory and
  reference-consistent. Shared gates can serve multiple posts. Tests isolate
  location integrity with an unclaimed gate and correctly treat redundant FKs.
- **Ambiguous upgrade:** the supported migration entrypoint refuses legacy posts
  that cannot resolve exactly one gate, before the historical UPDATE can guess.
- **Shared-gate upgrade:** removing the obsolete intermediate UNIQUE creation
  and guarding its later drop permits one legacy gate serving two posts, retaining
  both identities and data. The final schema and full upgrade path now agree.
- **Preparation defects:** lookup queries are genuinely column-specific/bound;
  diagnostics are self-contained and rolled back; wrong SQLSTATEs do not satisfy
  rejection checks. The superseded evidence is explicitly corrected.
- **Documentation:** audit is described as storage shape, not enforced append-only
  history; UUIDs are custom deterministic mappings; seed is insert-if-absent;
  structural validation does not claim contextual authorisation/media enforcement.

## Historical migration compatibility exception

Reviewer confirms the documented Addendum 4 strategy for this **pre-release,
synthetic-data demo**: the two previously applied files 0003/0005 may retain their
documented compatibility amendments. No fresh baseline or database reset is needed.
This is a narrow exception, not a general migration-edit policy or a claim that
it is the only possible repair strategy.

Verified directly in pinned drizzle-orm 0.45.3:

- `pg-core/dialect.js:56–69` executes pending migrations by comparing recorded
  `created_at` with journal `folderMillis`; it does not reapply changed contents
  merely because their hash changed.
- `migrator.js:15–23` computes SHA-256 of SQL contents for new ledger entries.
- The existing demo has the six original applied ledger hashes, including old
  0003 `90de4cd…` and old 0005 `0e39b80…`. The current files have their explicitly
  recorded amended hashes. These variants are intentionally different and the
  difference is documented in the preparation, amendment headers and baselines.
- An independent real-demo probe reran the supported `runMigrations`. All six
  ledger rows remained **byte-for-byte equivalent in queried values**, and counts
  remained **14 challans, 2 posts, 1 foundation row**. No recorded hash or data was
  rewritten and no migration reran. Original 0000–0002 and 0004 SQL remain intact.

The preflight is accepted for the demo's single maintenance operation before
seeding; its documented non-locking concurrency limitation is not production
migration acceptance. Raw Drizzle migration calls bypassing the supported runner
are not the documented application upgrade interface.

## Commands actually rerun

| Command | Actual result |
|---|---|
| `sha256sum -c docs/handoffs/F-01-tests.sha256` | 14/14 OK at start and after verification |
| `sha256sum -c docs/handoffs/F-01-corrections-tests.sha256` | 10/10 OK at start and after verification |
| `pnpm format:check` | Passed |
| `pnpm lint` | Passed; boundary gate scans 61 files |
| `pnpm typecheck` | Shared-package builds and all five package/e2e checks pass |
| `pnpm test` | 74 passed: API 58 in 7 files, contracts 8, admin 4, tablet 4 |
| `pnpm db:up` | Both PostgreSQL containers healthy |
| `pnpm test:integration` | 42 passed in 6 files, real PostgreSQL |
| `pnpm test:e2e` | 7 passed against review-started API and both clients |
| `pnpm build` | All five workspace artifacts built |
| `pnpm check:tablet-size` | 139722 B gzip initial JS, below 250000 B |
| `pnpm test:foundation` | 27 passed in 103.832 seconds, including clean-artifact gates |

`/tmp/opencode/f01-ambiguous-upgrade-probe.mts` was independently rerun against
actual legacy 0000–0002 migrations: two matching gates are refused with named
conflicts before any association is guessed. With `--shared-gate`, one gate and
two legacy posts upgrade successfully and both original IDs reference the same
gate. Both probes target only guarded TEST_DATABASE_URL and restore it to current
migrations afterward. They were run after the shared-DB regression suite, not
concurrently with another database reset.

`/tmp/opencode/f01-demo-ledger-review.mts` checked the real demo ledger and counts
before/after the supported migration call. It did not reset or reseed that DB.

## Independently repeated sensitivity

`/tmp/opencode/f01-final-mutations.py` copied the workspace without generated
artifacts/local `.env`, installed pinned dependencies and built shared packages.
All mutations were confined to that disposable copy:

- Clean legacy suite before faults: **3 passed**.
- **N:** reinstating the obsolete UNIQUE inside 0003 fails the shared-gate upgrade
  with `posts_gate_id_unique`.
- **O:** removing `IF EXISTS` from 0005 fails the fresh migration path with the
  missing-constraint error.
- **L:** disabling the ambiguity preflight fails the unchanged requirement that
  an ambiguous legacy post/gate mapping be refused.
- All affected source bytes restored: clean legacy suite **3 passed** again.
  Temporary copy removed. Repository source and planner tests were never mutated.

Earlier reviewer-side transaction probes already demonstrated the isolated
location invariant and the whole gate-reference enforcement path; current source
and full original/correction acceptance retain those checks. The reported earlier
R1/R2 and contract faults are not reclassified as proof of every unrelated
assertion. Full counts are honest; no tests were skipped or narrowed for GREEN.

## Coverage and accepted snapshot

- **DOM-01:** strict approved request/action/status/role/severity contracts,
  canonical values, forged-authority rejection, required acknowledgement structure,
  approved pure severity/recommendation helpers and shared/API parse agreement.
- **DOM-02:** empty migration, actual S-01/legacy-domain upgrades, ambiguous refusal,
  valid shared-gate upgrade, retained rows, repeat migrations and deterministic
  nonduplicating synthetic seeds. No fixture metadata is claimed to be real media.
- **DOM-03:** real SQL FK/unique/canonical/required-value checks, reference and
  location consistency, snapshot retention and transaction rollback.

Accepted changed implementation/config/test-harness/preparation/evidence hashes
are recorded in `docs/reviews/F-01-accepted.sha256`. Original read-only approval,
source fixture and acceptance artifacts remain covered by the original 14-entry
manifest and additive revision 5. The historic S-01 accepted record is retained
unchanged; affected foundation source files are superseded by the reviewed F-01
hashes and the successful foundation regressions, not falsely reported unchanged.
No installed dependencies, generated build output or local secret file is included.

## Scope and next step

F-01 implementation and independent review are complete; all feature implementation
tasks remain checked. No auth, live issuance, media flow, review API, exports or
deployment has been implemented or accepted by this result. Actual append-only
enforcement, hardware, camera/signature, trusted HTTPS, backup/restore and hosted
CI remain their documented later gates.

The next bounded larger feature is **F-02 demo authentication**, using the owner
decision `docs/handoffs/demo-env-login-decision.md`: three API env-backed role
accounts, stable synthetic actor attribution, API sessions/role/location checks,
actual frontend login/route protection, post/shift context, logout and 10-minute
tablet idle expiry. Planner must first reconcile the amendment through a versioned
addendum and scoped acceptance, accurately separating deferred database credential
management/production AUTH requirements. Preserve the now-accepted F-01 baseline
history. Prepare executable tests and a frozen handoff before implementation;
finish the whole internal feature batch, then stop for independent review.
