# Real-device checklist

Status: **not executed**. Run on the owner-named target tablet with the accepted
build over trusted HTTPS. Record device, browser, network, lighting, gloves and
stylus at the top of every session sheet. A failure in any **Blocker** item stops
the session and becomes a correction, not a note.

Severity: **Blocker** = cannot claim device acceptance; **Major** = fix before
release; **Minor** = record and assign an owner.

## 0. Preconditions (lab, conductor)

- [ ] Accepted snapshot verified: `sha256sum -c docs/reviews/marshal-character-accepted.sha256` (Blocker)
- [ ] `node tools/preflight-field-acceptance.mjs --base https://<origin>` has 0 FAIL (Blocker)
- [ ] `pnpm run check:tablet-size` reports below 250,000 B gzip (Blocker)
- [ ] Demo data seeded; no production data on the device (Blocker)
- [ ] Device charged, stand/screen cloth available, OS updates paused (Minor)

## 1. Target tablet, browser, trusted HTTPS, camera permission

- [ ] Device model, OS version, browser and version recorded (Blocker input)
- [ ] Trusted HTTPS: padlock shown, no certificate warning, no mixed content (Blocker)
- [ ] If the origin is HTTP on a LAN host, the app shows the insecure-context
      camera message and the session is stopped (Blocker)
- [ ] Camera permission prompt appears once and names the site (Major)
- [ ] Allow: rear camera opens (`environment` facing); preview is upright (Blocker)
- [ ] Deny: clear “Camera permission was denied…” recovery; no false photo (Blocker)
- [ ] Dismiss/ignore: recoverable message; no crash or stuck state (Major)
- [ ] Camera busy (another app) and no-camera device messages are understandable
      (Major; record if not reproducible)
- [ ] Site permission can be restored and capture works again (Blocker)

## 2. Sunlight readability (at the actual gate)

- [ ] Static labels above inputs readable in direct sunlight (Blocker)
- [ ] Vehicle number and gate-pass number readable in mono type (Major)
- [ ] Character messages, error summary and warning notices readable (Major)
- [ ] Severity chip and status chips distinguishable without relying on colour (Major)
- [ ] Signature canvas and instruction readable; white canvas not glaring (Minor)
- [ ] No dependence on hover, animation or colour alone to understand state (Major)
- [ ] At 200% browser zoom, controls remain reachable and no horizontal overflow
      (Major; FIELD-02)

## 3. Gloves, stylus and touch accuracy

- [ ] Gloved finger can select checkboxes, native selects, buttons and picker
      options without repeated attempts (Blocker)
- [ ] Stylus works for the same controls and for signature (Major)
- [ ] Touch targets are at least 56 px tall; primary action at least 64 px (Major)
- [ ] Mis-tap test: with a glove, tapping near “Clear signature” does not clear a
      confirmed signature; destructive control stays separated (Blocker)
- [ ] Vehicle picker: open, type 3+ characters, choose a suggestion, dismiss with
      chevron/Escape, reopen (Major)
- [ ] No accidental submission or navigation from a stray tap (Blocker)

## 4. Photo capture and retake (real rear camera)

- [ ] Start camera; preview appears; capture one photo (Blocker)
- [ ] Photo count and thumbnail agree with the number captured (Major)
- [ ] Retake/remove the last photo; count returns and the signature is invalidated
      with the evidence-changed notice (Blocker)
- [ ] Capture a second photo; the 4-photo limit blocks a fifth with clear text (Major)
- [ ] Stop camera turns the privacy indicator off; leaving the step releases the
      stream (Blocker)
- [ ] Cancel while acquiring stops immediately; no late photo appears (Major)
- [ ] Photo quality is adequate in gate light; encoder does not hang (Major)
- [ ] Record: capture-to-confirmation time in seconds (FIELD-03 sample)

## 5. Signature, rotation and witnessed refusal

- [ ] Draw with finger, glove and stylus; strokes appear without lag (Blocker)
- [ ] Confirm signature; confirmed badge appears; Confirm disables (Major)
- [ ] Draw again immediately: confirmation is invalidated before reconfirmation
      (Blocker)
- [ ] Rotate the device while drawing: the signature clears with the resize
      notice and requires re-signing; no blank PNG is confirmed (Blocker)
- [ ] “Sign again” and the separated “Clear signature” both behave distinctly (Major)
- [ ] Refusal: blank reason/witness fields show linked plain errors; focus works
      (Major)
- [ ] Witnessed refusal records reason, witness name and staff ID; no fake witness
      (Blocker)
- [ ] Signature and refusal stay mutually exclusive across navigation (Major)
- [ ] After refusal, the local-only notice says no challan has been submitted
      (Blocker)

## 6. Validation recovery

- [ ] Empty “Check details” focuses the error summary; each link focuses its field
      (Major)
- [ ] Correcting one field clears only that error; untouched errors remain (Major)
- [ ] Values are retained after correction and after going back (Major)
- [ ] “Other” requires Remarks with a plain explanation and counter (Major)
- [ ] A server 422 field error is listed, focused and recoverable (Major)

## 7. Connection and server failures

- [ ] Turn off Wi-Fi/data; “Check details” shows the crossed-Wi-Fi character,
      “The tablet can't reach the server”, and Retry (Blocker)
- [ ] Restore the network; Retry loads the real catalogue/form (Blocker)
- [ ] If a lab proxy is available, inject HTTP 500 for `/api/masters/departments`:
      the app shows the concerned character and “The server returned an error …
      The tablet reached the server”, **not** the Wi-Fi character; Retry recovers
      (Major; record as lab-only if a proxy is unavailable)
- [ ] Validation errors never show the Wi-Fi character; camera-permission errors
      never show the Wi-Fi character (Blocker)
- [ ] No false success, no challan number or receipt appears during any failure
      (Blocker)

## 8. Inactivity expiry

- [ ] Leave the tablet idle for 10 minutes (600 s) on the entry step (Blocker)
- [ ] The app returns to sign-in and the unsent entry is discarded (Blocker)
- [ ] No partial entry, photo or signature is visible to the next operator (Blocker)
- [ ] Note: the optional inactivity warning is **not** implemented; do not expect
      a countdown (Minor)

## 9. Character poses and messages (conductor static check + participant probes)

For each state, confirm the text alone explains the state and the next action,
then ask the participant what the picture means and what they would do. Do not
lead with the answer.

- [ ] Welcome (hi-vis worker): start with vehicle number or gate pass (Major)
- [ ] Check details (checklist inspector): read the details with the driver (Major)
- [ ] Processing (clipboard inspector): a real check is running; wait (Major)
- [ ] Error (concerned inspector): correctable details; use the linked list (Major)
- [ ] Success (thumbs up): a local action succeeded; it is not issuance (Blocker)
- [ ] Connection (crossed Wi-Fi): only a lost connection; not a validation or
      server error (Blocker)
- [ ] Participant can explain each state without reading the image (Major)
- [ ] Participant can point to the next action for each state (Major)

## 10. Local capture is not a submitted challan

- [ ] After photo and signature, ask: “Has a challan been issued or sent?”
      Correct answer: **no, it is only on this tablet** (Blocker)
- [ ] Participant does not expect a receipt, challan number or green commit button
      (Blocker)
- [ ] The explicit “No challan has been submitted.” wording is present after
      signature/refusal and is understood (Blocker)
- [ ] No screen claims final submission anywhere (Blocker)

## 11. Performance samples (FIELD-03, current build limits)

- [ ] Record tablet interactive time: app shell usable after sign-in, seconds (Major)
- [ ] Record photo capture-to-confirmation and signature confirm times (Major)
- [ ] Record whether the device stays responsive with 4 photos held (Major)
- [ ] Submit/upload latency: **not measurable** — this build has no submission.
      Record as not applicable and do not claim FIELD-03 upload timing (Blocker
      against claiming it)

## 12. Privacy and cleanup

- [ ] Practice photos/signatures deleted from the device at session end (Major)
- [ ] Browser permission left in the state the operator wants for the pilot (Minor)
- [ ] No real names, vehicles or violations entered at any point (Blocker)

## Result

- Blocker failures: `____` (if any, round fails)
- Major failures: `____`
- Minor notes: `____`
- Device checklist verdict: PASS / FAIL (conductor) — device acceptance is a
  separate owner decision and is not implied by automated suites.
