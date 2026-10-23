-- COMPATIBILITY AMENDMENT 2026-10-03 (planner-approved, same record as 0003):
-- 0003 no longer creates posts_gate_id_unique, so on a fresh database there is
-- nothing to drop. IF EXISTS keeps this migration correct for both cases: fresh
-- databases no-op, and a database that applied the ORIGINAL 0003 still has the
-- constraint removed. Without IF EXISTS the fresh path would fail here instead.
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_gate_id_unique";