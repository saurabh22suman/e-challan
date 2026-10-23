# Tablet camera and signature implementation approach

Status: recommended engineering design; E-02/E-03 in `decisions.md` still need
agreement and target-device validation. Relevant PRD: E2.8–E2.15.

## Photos

1. Marshal taps **Take photo** on the evidence step.
2. Request `navigator.mediaDevices.getUserMedia` with video, rear-camera preference
   (`facingMode: { ideal: 'environment' }`) and `audio: false`.
3. Render the live stream in a `playsInline` video preview; enable capture only
   after frames are ready. A preference is not a guarantee: test/select the actual
   camera on the chosen tablet.
4. Capture the current frame to canvas, resize and encode as JPEG targeting
   approximately 300 KB. Final dimension/quality/maximum limits need real evidence
   samples so compression does not destroy legibility.
5. Show thumbnail with retake/delete; allow one through four accepted photos.
6. Upload blobs via authenticated API; server validates content/limits/ownership.
   Store files through local disk adapter and object keys in DB. Finalise binding
   with the challan; authorised reads are audited.
7. Stop camera tracks on exit/logout and release preview URLs. Handle denied or
   unanswered permission, missing/busy camera and encoding/upload failures without
   claiming capture or submission succeeded.

Use trusted HTTPS on the tablet. A developer laptop's localhost exception does
not make `http://<LAN-IP>` secure on a tablet. Internal plant hosting needs the
certificate/domain arrangement agreed with IT, not assumed automatic public TLS.

Do not use a generic file picker as the primary capture path: HTML `capture`
behaviour varies by device and can expose gallery choices. Live capture avoids
offering gallery uploads in the normal UI; it does not prove physical authenticity
against a modified client or virtual camera.

## Signature

1. Show a plain-language driver summary before asking for acknowledgement.
2. Show a full-width canvas backed by `signature_pad`, accepting finger or a
   compatible stylus. No external signing device is required.
3. Limit gesture suppression (`touch-action: none`) to the drawing surface so the
   page does not scroll while signing; keep other controls accessible.
4. Provide Clear and Confirm, separated to avoid accidental clearing. Empty canvas
   is not a signature. This is captured handwriting, not a certificate-based
   cryptographic digital signature or automatic identity verification.
5. Scale canvas backing pixels for devicePixelRatio. Resizing canvas clears its
   pixels; preserve/re-render point groups with suitable coordinate scaling, or
   explicitly ask for re-signing. Never silently keep a signed flag over blank data.
6. Export PNG blob; upload through the same protected evidence service and bind it
   to the final challan data. Changing the driver-summary data after signing should
   invalidate acknowledgement under proposed E-03.
7. **Driver refuses to sign** opens the alternative form: reason, witness supervisor
   name and ID, all required. At least one photo is still required.

Finger/stylus support depends on the actual touchscreen; normal gloves may not
register. Test at the gate and supply a compatible stylus if needed.

## Verification

Automated tests: photo counts, preview/cleanup, mocked permission states,
compression output, signature drawing/clear/resize, refusal validation, server
evidence checks and retry behaviour. Actual-device tests: correct camera, trusted
HTTPS, sunlight, finger/stylus feel, portrait/landscape and plant connectivity.

References checked during setup:
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- https://github.com/szimek/signature_pad (README: high DPI and canvas resizing)
