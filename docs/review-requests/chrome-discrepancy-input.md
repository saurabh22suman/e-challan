# Independent review of the Chrome follow-up

25 October 2026

**Verdict: CHANGES REQUIRED.** Phone summary composition is improved, but the requested Chrome loading acceptance still fails in the reviewer's connected Chrome session.

## P1 — Marshal still fails after normal sign-in in Chrome

Independent steps:

1. Opened a fresh Chrome tab at `http://127.0.0.1:5174/`.
2. Entered the existing synthetic Marshal account through the normal sign-in UI.
3. Observed “Opening the marshal tablet”, followed by navigation to port 5173.
4. The app remained empty, automatically reloaded twice, then displayed **“The app did not load”**.
5. Clicked its Reload control; the application still did not mount during the observed retry. A separate direct port-5173 visit also started empty.

Chrome logs still show Vite WebSocket failures on port 5173. That is not proof of the underlying cause. The handoff's claimed successful real-Chrome check is not reproducible through this connected Chrome environment. Distinguish an environment-specific failure from a general app defect by capturing failed module requests and their responses in this same scenario; do not equate warm-up plus a diagnostic with successful recovery.

Evidence: `final-chrome-marshal-load-failure.png` captures the new diagnostic. No credentials or handoff code are visible in the image.

## P2 — The purported dev-only watchdog is shipped in production HTML

Locations: `apps/tablet/index.html:11`, `apps/admin/index.html:11`.

The retry script is an ordinary inline script guarded only by hostname (`localhost` / `127.0.0.1`). It appears unchanged in both `apps/tablet/dist/index.html` and `apps/admin/dist/index.html`. Thus the handoff claim “production is untouched” is inaccurate: production builds served locally execute it, including local preview/acceptance use. It reloads when the root is empty at 2.5 seconds, regardless of whether legitimate loading or an auth handoff is still in progress.

Fix: inject the diagnostic/retry only in actual development mode, and avoid blindly reloading a one-time handoff while its boot/exchange is pending. Make the intended retry mechanism deterministic and testable. Remote production hostnames currently skip it; this finding does not claim that every remote deployment reloads.

## P2 — Warm-up does not prove graph readiness and has no request deadline

Location: `apps/admin/src/auth/HandoffToTablet.tsx:37`.

The loop returns after two identical `/src/main.tsx` bodies, but unchanged entry-module text does not establish that imported dependencies are ready or executable. Each fetch and response-body read also has no timeout, so the “20 attempts” limit is not a total time limit: a stalled response can leave the user indefinitely on “Opening the marshal tablet” without a recovery action.

Fix: bound the whole development warm-up operation and keep login recoverable; verify readiness against the actual failure, rather than comparing two entry-file strings. This is a source-level risk; the observed Chrome run did navigate to the tablet rather than hanging in warm-up.

## Phone summary improvement

The revised component order and submitted 390x844 screenshot now place driver, vehicle, violation and severity before secondary metadata, with the repeat notice moved below. The focused test now checks top and bottom bounds of all three critical values. This addresses the prior composition finding in code and visual evidence. Live Chrome verification of the summary remains blocked by the loading failure above.

## Independent checks and limitations

- Admin component tests: 56 passed.
- Tablet component tests: 92 passed.
- `git diff --check`: pass.
- Tablet production-asset size: 179,148 bytes gzip / 250,000 limit.
- Inspected changed HTML, handoff warm-up, Vite configs and mobile regression assertions.
- The broader full browser/integration/build results in the implementer's handoff were not independently rerun in this pass.
- No source edits, database/credential/permission changes, commits or deployment performed by this reviewer.

Approval remains pending until Marshal sign-in and entry/summary/media flow render in the requested Chrome session and the development-only recovery logic is properly scoped.


Latest observation: a NEW navigation to admin5174 used an authenticated Marshal session to mint a NEW handoff, then tablet5173 still showed The app did not load. Direct5173 also fails in connected persistent Chrome. Do not treat this as just reuse of the old code. The diagnostic page is new dev injected HTML; root is otherwise empty; no tablet ReactDevTools console message. Admin WS connects; tablet WS fails. Chrome internal service-worker diagnostic URL is blocked by browser tool policy; do not request a workaround. Compare isolated Playwright Chrome vs connected persistent Chrome without clearing data/disabling extensions/protections. All required reports are reproduced in this in-project input; external outputs paths need not be read.

HUMAN CONFIRMATION: The owner manually signed in as Marshal in their normal Chrome window at http://127.0.0.1:5174/. It redirected to handoff on5173 and showed The app did not load. This is not restricted to Codex connected Chrome.
