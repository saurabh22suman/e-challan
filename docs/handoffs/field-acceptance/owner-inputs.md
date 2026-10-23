# Missing owner inputs

Status: **open**. The sessions cannot be scheduled or their results interpreted
until these are answered. Do not invent values or ship machine-translated
safety/legal terms. Each item names the safe default if the owner defers.

| # | Input needed | Why it blocks or limits | Safe default while unanswered |
| --- | --- | --- | --- |
| O-1 | Target tablet: model, OS version, browser/version, orientation policy, stand/case | B-03; device acceptance cannot be named or reproduced | No device claim; run browser-only checks on a lab device and mark device gates BLOCKED |
| O-2 | Gloves/stylus policy and samples actually used at the gate | FIELD-01 touch and signature feel | Record whatever is available; mark glove/stylus sign-off pending |
| O-3 | Plant network details (Wi-Fi/4G, coverage at the gate) and any proxy | FIELD-03/04 network and latency samples | Lab network only; no field-network claim |
| O-4 | Trusted HTTPS deployment available for the session (V-01) and its operator | Camera needs a secure context; sessions need the accepted build | Local HTTPS or localhost lab only; device sessions BLOCKED |
| O-5 | Preferred reading language(s) and literacy comfort of the participants | UXA-31/32; comprehension results are only valid for the tested language | Test in English and record the language limitation explicitly |
| O-6 | Approved terminology/translations and a fluent reviewer if non-English is required | Do not ship unchecked machine translation | Defer UXA-32 as “decision pending”; do not claim non-English readiness |
| O-7 | Help/support route to show (supervisor, phone, notice) | Current copy only says to ask a supervisor; no real contact exists | Keep generic supervisor wording; record requests |
| O-8 | Who recruits the 5–8 participants, consent process and incentives | Sessions cannot start without a responsible recruiter and consent | Conductor recruits only with owner approval; no incentive invented |
| O-9 | Session site, gate access, time of day for sunlight testing | Sunlight/glare check must be at the real gate | Test at the brightest available outdoor location and label it lab |
| O-10 | Whether audio/video/photos of sessions may be recorded, storage and deletion | Consent and privacy | Record nothing; written notes with participant codes only |
| O-11 | Release target confirmation for the ≥80% unassisted formative threshold | Pass/fail interpretation | Report results without a final pass/fail; owner decides |
| O-12 | Consenting driver role-player for signature/refusal | S7/S8 need a role-play driver | Skip S7/S8 or use a staff volunteer; mark the gap |
| O-13 | Whether the optional inactivity warning is in scope | The build has no countdown; users may wait for one | Do not expect or claim a warning; 10-minute expiry still checked |
| O-14 | Alternate consent for a driver unable to draw but not refusing | Business policy; refusal must not be misused | Do not offer a typed-name substitute; record as an open decision |
| O-15 | Whether admin/dashboard representative checks are in scope | This pack is tablet-only | Tablet-only round; dashboard remains code/browser reviewed |
| O-16 | Who seeds/resets the synthetic demo data and confirms no production data | Session hygiene | Conductor resets from `docs/demo-data.json` seed on an isolated demo DB |
| O-17 | Device cleanup policy for practice photos/signatures | Privacy | Delete local practice media at session end |
| O-18 | Time budget, number of sessions per day and who observes | Practical scheduling | One participant per 60-minute slot; facilitator + note-taker |

## Known limits that no owner input can remove

- The current build has no final submission, receipt or challan number. Scenarios
  must not expect one, and FIELD-03 upload/submit timing cannot be measured.
- Playwright, fake camera streams, screenshots and reduced-motion probes are
  code/browser evidence only; they cannot substitute for a real camera, gloves,
  sunlight, rotation hardware or human comprehension.
- A participant who cannot read the interface language is a language finding;
  a different sample cannot be presented as the same population's result.
