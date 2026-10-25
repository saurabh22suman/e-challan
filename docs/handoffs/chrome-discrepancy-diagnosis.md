# Chrome discrepancy diagnosis — Marshal handoff / direct tablet load

Date: 2026-10-25. Read-only diagnostic collaboration. No source edits, browser
data clearing, extension/permission changes, deployment or operational-data
mutations were made for this diagnosis. The reviewer's connected Chrome is
treated as a different browser profile from the isolated test browser.

## Bottom line

The discrepancy is **not yet explained by a proven application-code root cause**.
I can reproduce the current app successfully in isolated real Chrome, and I can
reproduce a separate Vite dependency-optimizer race in isolated Chrome, but I
cannot reproduce the reviewer's exact persistent-Chrome failure. The new human
observation (fresh handoff and direct `127.0.0.1:5173` both fail while
`127.0.0.1:5174` works) narrows the problem to the tablet origin/browser state or
the tablet dev-server/WebSocket path, not the handoff code alone. The tablet
origin-scoped persistent browser state remains the leading hypothesis, but it is
**unproven** and was not inspected using blocked browser-internal tooling.

## Exact successful launch/profile and script

Successful final check:

```js
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',          // installed Google Chrome, not Playwright Chromium
});
const page = await browser.newPage({
  viewport: { width: 1024, height: 768 },
});
// no userDataDir, no persistent profile, no extensions, no proxy,
// no service-worker pre-seeding, no addInitScript token
```

Flow: open `http://127.0.0.1:5174/`, fill the synthetic Marshal account, click
Sign in, wait for navigation to `5173`, wait for `#vehicle-registration`.

Observed on the successful run after Vite cache clear + restart:

- `GET /__echallan_ready` → **200**
- `GET /` → **200**
- `GET /src/main.tsx` → **200**
- `GET /@vite/client`, React deps and app modules → **200**
- zero `pageerror`, zero `requestfailed`, zero console errors
- `#root` rendered (26,544 characters); Marshal entry visible
- end-to-end sign-in → handoff → entry: approximately **1.4 s**

A separate **fresh persistent** Chrome profile (`launchPersistentContext` on a new
temporary directory, real Chrome channel) also rendered successfully with no
failed requests. This shows persistence alone is not the differentiator; the
reviewer profile may contain additional state.

The Playwright E2E suite uses bundled Chromium with fresh contexts, not the real
Chrome channel. Its passing handoff tests are supporting evidence, not a substitute
for the connected Chrome session.

## Isolated failure that is reproducible (separate from the reviewer case)

Clearing the tablet Vite dependency cache and starting the server, then performing
an immediate handoff, produced:

- module requests aborted with `net::ERR_NETWORK_CHANGED`
- `#root` empty
- no React DevTools message
- after the Vite dependency optimizer settled, the same handoff and all module
  requests completed with **200**

This is a real dev-server/optimizer race. The working tree now has a dev-only
readiness handshake and bounded handoff timeout intended to prevent it. It does
**not** explain why the reviewer's persistent Chrome still fails after the optimizer
is idle, nor why direct `5173` fails.

## Reviewer/human observations (accepted as evidence)

- Normal Chrome profile, fresh sign-in at `5174`, new handoff → `5173`: root
  remains empty; after 8 s the dev diagnostic appears.
- A direct fresh tab at `http://127.0.0.1:5173/` also fails.
- `http://127.0.0.1:5174/` renders and its Vite WebSocket connects.
- Tablet `5173` Vite WebSocket fails; no tablet React DevTools log.
- The old supplied handoff URL returning `401` is consistent with an expired or
  consumed one-time code and is not evidence about the new handoff.

## Proven versus unproven

| Statement | Status |
| --- | --- |
| Admin origin (`5174`) and API/sign-in work in the same persistent Chrome | Proven by reviewer/human |
| Tablet origin (`5173`) and direct tablet boot fail in that Chrome | Proven by reviewer/human |
| Handoff exchange/auth alone is the cause | **Disproven as sole cause**: direct `5173` fails without a handoff |
| Tablet Vite WebSocket fails while admin WebSocket connects | Proven from console report; not proven causal |
| Isolated real Chrome with a fresh profile loads the tablet | Proven by isolated run |
| A separate Vite dependency-optimizer race can blank the first handoff | Proven in isolated Chrome; current readiness handshake addresses that path |
| Reviewer Chrome failure is caused by application code | **Unproven** |
| Reviewer Chrome failure is caused by origin-scoped persistent browser state (cache/service worker/extension/proxy) | **Leading hypothesis; unproven** |
| Main/module requests fail before the auth exchange in the reviewer session | **Unproven**; requires Network evidence. The code imports the app/theme before `consumeHandoff`, so a module-evaluation failure prevents the exchange. Direct `5173` failure already proves exchange is not required for the failure. |

## Why the discrepancy is real, not “just tooling”

`5174` and `5173` are different origins. A browser profile can have origin-scoped
state for `127.0.0.1:5173` without affecting `5174`. Admin WebSocket success and
tablet WebSocket failure are consistent with an origin-specific difference. The
human reproduced the failure in normal Chrome, so Codex automation is not required
to explain it. The remaining question is which origin-specific state or network
condition is responsible.

No claim is made that a service worker, cache, extension or proxy is the cause.
Those are hypotheses only; browser-internal debugging URLs were blocked and no
profile-copy or alternate internal inspection should be used.

## Smallest safe next diagnostic (ordinary DevTools only)

Run in the reviewer's normal Chrome, without clearing data or changing settings:

1. Open DevTools → Network, enable **Preserve log**, disable throttling.
2. Open a new tab to `http://127.0.0.1:5173/`; hard reload once.
3. Record for **Document, Script, Fetch/XHR**:
   - status (`200`, `4xx`, `5xx`, `(failed)`, `(canceled)`)
   - failure reason
   - Size column: `(ServiceWorker)`, `(disk cache)`, `(memory cache)` or network
   - whether `/src/main.tsx`, `/@vite/client`, a React dep, `App.tsx` and the
     theme package were requested and their statuses
   - whether `/api/auth/handoff/exchange` appears at all
4. Copy visible Console errors (especially `pageerror`/module errors; the Vite
   WebSocket warning is secondary).
5. Repeat once at `http://localhost:5173/` (same server, **different origin**).
   A new origin cannot be controlled by `127.0.0.1` origin-scoped state:
   - if `localhost` renders but `127.0.0.1` does not, origin-scoped state is
     strongly implicated;
   - if both fail, the difference is profile-wide or network/extension-related.
6. Optional console checks using normal page APIs only:
   ```js
   location.href
   document.querySelector('#root')?.innerHTML.length
   performance.getEntriesByType('resource')
     .filter(e => /\/src\/|@vite|\.vite\/deps/.test(e.name))
     .map(e => ({ name: e.name, start: e.startTime, duration: e.duration,
                  transferSize: e.transferSize, workerStart: e.workerStart }))
   fetch('/src/main.tsx', { cache: 'no-store' }).then(r => ({ status: r.status }))
   ```

Do not open browser-internal diagnostic URLs or clear data for this diagnostic.

## What result would confirm each path

- **Module requests fail/block before `handoff/exchange` and `main.tsx` is not
  executed** → tablet boot/module loading issue; inspect the failed response.
- **`/src/main.tsx` and deps are 200 but no React/log** → execution/import error or
  browser-served stale module; need response bodies/HTTPS? No secret data in these
  public dev modules.
- **`localhost:5173` works while `127.0.0.1:5173` fails** → origin-specific
  persistent browser state/network; exact cause still needs confirmation without
  internal inspection.
- **Both origins fail** → profile-wide extension/proxy/network or server-side
  behavior; compare admin 5174 and a fresh browser profile.
- **`handoff/exchange` appears with 401/expired** → new code was consumed before
  the observed retry; capture the new handoff flow once with Preserve log.

## Current source/log observations (read-only)

- Vite tablet/admin servers are running and return 200 for `/`, `/src/main.tsx` and
  `/__echallan_ready`.
- Current Vite tablet log shows successful starts and HMR config restarts, with no
  transform-error response logged during the review window.
- Tablet `main.tsx` imports `App`, theme and auth helpers before `consumeHandoff`;
  a module import/evaluation failure prevents the auth exchange from running.
- The existing service worker is production-only in `main.tsx`, but an already
  registered worker from a prior session could outlive a server restart. This is a
  hypothesis, not a proven cause, and must not be tested by clearing browser data.

## Unanswered questions

1. In the connected Chrome session, what are the exact Network statuses/failure
   reasons for `/src/main.tsx`, `/@vite/client`, React deps and `App.tsx`?
2. Does the new handoff produce an `/api/auth/handoff/exchange` request? If yes,
   what status?
3. Does `http://localhost:5173/` load in that same profile while
   `http://127.0.0.1:5173/` fails?
4. Which Chrome profile is the reviewer using? The human's normal Chrome vs the
   Codex automation profile may differ even on one laptop.
5. Do the failed module entries show `(ServiceWorker)` / `(disk cache)` in the Size
   column? This is ordinary Network evidence, not an internal diagnostic URL.

## Proposed next step (not implemented)

Use the Network evidence above to choose the smallest fix. If the failure is
origin-scoped persistent state, a narrow owner-approved reset of **only** the
`127.0.0.1:5173` origin's worker/cache (or acceptance on a new origin) can confirm
it without touching other Chrome data. If module requests fail with HTTP errors,
fix the dev server/module graph instead. No source or browser state was changed in
this diagnostic; independent approval remains pending.
