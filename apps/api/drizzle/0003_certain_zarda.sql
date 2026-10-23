-- F-01 CORRECTIVE MIGRATION (review findings R1, R2, R3).
--
-- COMPATIBILITY AMENDMENT, 2026-10-03 (planner-approved; see Addendum 4 of
-- docs/handoffs/F-01-corrections-prepared.md and docs/reviews/F-01-latest-correction-review.md).
--
-- One statement was removed from this already-applied file:
--
--     ALTER TABLE "posts" ADD CONSTRAINT "posts_gate_id_unique" UNIQUE("gate_id");
--
-- It was never an approved invariant. The approved replacement specification
-- (sections 4/7/8) constrains post -> gate only and is silent on how many posts a
-- gate may serve, so many-posts-per-gate is the approved cardinality. Leaving this
-- statement in the chain made valid legacy data impossible to upgrade: a legacy
-- location with one gate and two posts is unambiguous, but the backfill above binds
-- both posts to that one gate and this constraint then rejected them, so migration
-- 0005 (which drops it) was never reached.
--
-- Why amending the historical file is safe: drizzle-orm selects pending migrations by
-- `created_at < folderMillis` (drizzle-orm/pg-core/dialect.js), never by content hash,
-- so this already-applied migration is not re-executed on any database that recorded
-- it. Its recorded ledger hash therefore remains the pre-amendment hash, which is the
-- auditable record of this amendment. No row was deleted, merged or invented, no gate
-- was cloned, and no migration ledger was cleared.
--
-- Additive only. Migrations 0000-0002 are applied history and are NOT edited:
-- their hashes are recorded in docs/handoffs/F-01-tests.sha256 and must stay valid.
--
-- This file was produced by `drizzle-kit generate` and then reordered by hand for
-- three reasons, each marked below. Reordering removed no generated statement.
-- One generated statement was later removed by the dated compatibility amendment
-- above (the never-approved posts_gate_id_unique); nothing else was dropped or
-- weakened, and no approved invariant was removed:
--
--   (1) The generated order added composite foreign keys before the unique
--       constraints they reference, which PostgreSQL rejects. Constraints are now
--       created first.
--   (2) `posts.gate_id` is added and then BACKFILLED. The generated file added the
--       column without populating it, which would leave every existing post
--       unassociated.
--   (3) A guard raises if any post remains unassociated, so an ambiguous or missing
--       gate mapping fails loudly instead of silently producing a NULL.
--
-- Pre-flight against the current demo database (2026-10-02) confirmed: 0 posts at a
-- location with other than exactly one gate, 0 challan post/gate/location
-- mismatches, 0 violation types with a NULL severity, and 0 non-canonical
-- registrations or gate-pass numbers. No existing row required merging or deletion.
ALTER TABLE "posts" ADD COLUMN "gate_id" uuid;--> statement-breakpoint
-- (2) Backfill: each post belongs to exactly one gate at its location.
UPDATE "posts" AS p SET "gate_id" = g."id" FROM "gates" AS g WHERE g."location_id" = p."location_id" AND p."gate_id" IS NULL;--> statement-breakpoint
-- (3) Guard: refuse to continue if any post could not be mapped unambiguously.
DO $$
DECLARE unmapped integer;
BEGIN
  SELECT count(*) INTO unmapped FROM "posts" WHERE "gate_id" IS NULL;
  IF unmapped > 0 THEN
    RAISE EXCEPTION 'F-01 corrective migration aborted: % post(s) have no unambiguous gate at their location. Resolve these rows explicitly; do not guess.', unmapped;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "violation_types" DROP CONSTRAINT "violation_types_severity_check";--> statement-breakpoint
-- R2: a violation master always carries one approved severity. No "Unknown" value is
-- introduced for fixture data; the fixture supplies a display severity for all seven
-- masters and the demo database has zero NULL severities.
ALTER TABLE "violation_types" ALTER COLUMN "severity" SET NOT NULL;--> statement-breakpoint
-- R3: reference targets for the composite attribution constraints.
ALTER TABLE "gates" ADD CONSTRAINT "gates_id_location_id_unique" UNIQUE("id","location_id");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_id_gate_id_unique" UNIQUE("id","gate_id");--> statement-breakpoint
-- R3: a post must reference an existing gate, and that gate must be at the post's own
-- location, so "which gate does this post serve" is never decided by location alone.
ALTER TABLE "posts" ADD CONSTRAINT "posts_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_gate_location_fk" FOREIGN KEY ("gate_id","location_id") REFERENCES "public"."gates"("id","location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- R3: a challan's post and gate must agree, and its gate and location must agree.
-- Separate single-column foreign keys could each point at an existing row while
-- describing an impossible pairing.
ALTER TABLE "challans" ADD CONSTRAINT "challans_post_gate_fk" FOREIGN KEY ("post_id","gate_id") REFERENCES "public"."posts"("id","gate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_gate_location_fk" FOREIGN KEY ("gate_id","location_id") REFERENCES "public"."gates"("id","location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- R1: the stored registration must already be canonical (uppercase, all whitespace
-- removed). Together with the existing UNIQUE this makes identity unique by canonical
-- value rather than by raw text.
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_registration_canonical_check" CHECK ("vehicles"."registration_number" = upper(regexp_replace("vehicles"."registration_number", '\s', '', 'g')));--> statement-breakpoint
-- R1: the gate-pass number must already be canonical (uppercase, trimmed) and must
-- contain no internal whitespace. Internal whitespace is invalid under the approved
-- rule, so it is refused rather than silently stripped.
ALTER TABLE "gate_pass_records" ADD CONSTRAINT "gate_pass_records_canonical_check" CHECK ("gate_pass_records"."gate_pass_number" = upper("gate_pass_records"."gate_pass_number") AND "gate_pass_records"."gate_pass_number" !~ '\s');--> statement-breakpoint
-- R2: replacement severity constraint, now that the column is NOT NULL.
ALTER TABLE "violation_types" ADD CONSTRAINT "violation_types_severity_check" CHECK ("violation_types"."severity" IN ('Minor','Major','Critical'));
