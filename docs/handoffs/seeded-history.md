# Seeded historical challan history

Date: 2026-10-25. Local synthetic demo data only; no operational records,
credentials, permissions or deployment settings were changed.

## Change

`docs/deployment-data.json` now contains **100 historical challans** across
June–October 2026, with the existing 5 staff accounts, 2 posts, 2 shifts and 10
gate-pass records. New rows are deterministic, unique and insert-if-absent.

Status distribution in the deployment fixture:

| Status | Count |
| --- | ---: |
| Issued | 47 |
| Resolved | 34 |
| Under Review | 10 |
| Cancelled | 9 |
| **Total** | **100** |

The test fixture `docs/demo-data.json` is intentionally unchanged at 14 challans
so deterministic integration/component expectations remain stable.

## Verification

Command run against the local `echallan_demo` database:

```bash
pnpm --filter @echallan/api run db:seed:deploy
```

Result:

- seeded 100 challan records from `docs/deployment-data.json`;
- local DB now has 101 challans because one synthetic E2E-created record
  (`HZL/EC/2026/10/0007`) already existed and was retained;
- local counts: 19 users (including E2E accounts), 2 posts, 2 shifts;
- Admin Challans reports 101 records; a 90-day trend query returns
  **99 issued / 33 resolved / 9 cancelled**;
- the existing missing-evidence/history rules remain unchanged: new records carry
  no fabricated photo or signature blobs.

Evidence screenshots:

- `docs/ui-redesign-evidence/final-admin-challans-history-1440.png`
- `docs/ui-redesign-evidence/final-admin-trend-90-history-1440.png`

## Deployment note

The deployment fixture is only applied when `SEED_DEMO_DATA=true` or when the
deployment seed command is run explicitly. Existing databases use insert-if-absent
semantics, so new historical rows will be added without overwriting existing rows.
