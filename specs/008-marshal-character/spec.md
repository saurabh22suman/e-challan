# Feature specification: marshal character guidance (008)

Source: owner brief 2026-10-19, reviewed inclusive-UX baseline
`docs/reviews/inclusive-ux-corrections.md` and accepted hashes
`docs/reviews/inclusive-ux-accepted.sha256`.

## Objective

Use the six supplied safety-worker illustrations at meaningful moments to make
the marshal flow welcoming and easier to understand for adults with limited
reading confidence or digital experience. The character explains state; it does
not replace text, controls or the existing honest local-only status.

## Requirements (trace)

- MC-01 assets: preserve originals; ship transparent WebP derivatives at display
  resolutions; welcome keeps the full body; compact states use waist-up crops
  that preserve face, hands and the identifying prop; no stretching.
- MC-02 placement: welcome, check-details guidance, real pending processing,
  correctable validation summary, connection failure and local acknowledgement
  only. No character per field, repeated toast or routine dialog.
- MC-03 animation: whole-image entrance/transition only. Welcome fade + short
  rise; processing restrained motion with a real progress indicator; success one
  brief emphasis; calm error entrance; 150–250 ms state transitions. No shaking,
  flashing, bouncing, new animation dependency or control delay.
- MC-04 reduced motion: `prefers-reduced-motion: reduce` leaves every illustration
  static and does not hide text or actions.
- MC-05 accessibility: images are decorative (`alt=""`), never focusable and
  never the sole carrier of status. Text and a next action accompany meaningful
  states. Existing focus management and R1–R7 corrections are preserved.
- MC-06 honesty: distinguish “photo captured”, “signature confirmed locally” and
  “challan issued”. This build stops at local capture: no issued-challan
  celebration, receipt or invented submission. The connection illustration is
  used only for a rejected transport, never an HTTP service response, validation
  or camera-permission errors. Catalogue loading distinguishes transport
  rejection (network) from an HTTP 500/503 service error (honest message with
  Retry), 401/403 session refusal and malformed successful bodies. CHAR-01
  correction, revision 2.
- MC-07 performance/resilience: only the welcome illustration is initial; other
  derivatives load on demand. Explicit image dimensions reserve space. If images
  fail, text and controls remain usable. Initial tablet JS stays below 250,000 B
  gzip; image transfer is reported separately.
- MC-08 verification: Playwright covers desktop/tablet/narrow layouts, reduced
  motion, keyboard/focus, image failure, layout stability and pending/success/
  error transitions. Affected unit, e2e, build and bundle gates rerun.

## Out of scope

Final submission, issued challan, receipt, offline issuance, new runtime
dependencies, API/contract changes, representative-user or real-device
acceptance. No production field data.

## Acceptance inventory

- `apps/tablet/src/__tests__/marshal-character.test.tsx` — component mapping,
  decorative image, eager/lazy loading, failure fallback and crossfade lifetime.
- `apps/tablet/e2e/marshal-character.spec.ts` — browser acceptance for MC-01–MC-08.
- `apps/tablet/e2e/marshal-character-media.spec.ts` — synthetic-camera local
  acknowledgement wording and one-pulse success emphasis (application flow only).
- `apps/tablet/src/__tests__/catalogue-errors.test.tsx` — CHAR-01 classification:
  transport rejection, HTTP 500/503, 401/403, malformed success, no fabricated
  masters and successful retry.
- `apps/tablet/e2e/marshal-catalogue-errors.spec.ts` — CHAR-01 browser boundary:
  connection-only illustration, honest server-error copy, auth/contract
  separation and real-catalogue retry recovery.
- Existing suites must remain green, especially `inclusive-ux.spec.ts`,
  `inclusive-ux-media.spec.ts`, `foundation.spec.ts`, `camera-signature.spec.ts`
  and the tablet unit suite.
