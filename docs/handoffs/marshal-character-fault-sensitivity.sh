#!/usr/bin/env bash
# Disposable-copy fault sensitivity for MC-04/MC-06.
#
# Fault: a validation error renders the connection illustration instead of the
# concerned illustration. Expected: the browser acceptance case fails. Reverting
# the fault restores GREEN. The workspace is never modified.
#
# Prerequisites: the dev API is already running on 127.0.0.1:3001 and port 5273
# is free. Run from anywhere; the script cleans up its copy and temp config.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COPY="/tmp/opencode/e-challan-fault-app"
CONFIG="$ROOT/test-results/playwright-fault.config.ts"
VITE_LOG="/tmp/e-challan-fault-vite.log"
RED_LOG="/tmp/e-challan-fault-red.log"
GREEN_LOG="/tmp/e-challan-fault-green.log"
VITE_PID=""

cleanup() {
  if [ -n "$VITE_PID" ]; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
  rm -rf "$COPY" /tmp/tsconfig.base.json "$CONFIG"
}
trap cleanup EXIT

curl -sf http://127.0.0.1:3001/health >/dev/null || {
  echo "start the workspace dev API on 127.0.0.1:3001 first" >&2
  exit 1
}
if curl -sf -o /dev/null http://127.0.0.1:5273/; then
  echo "port 5273 is already in use; stop that process first" >&2
  exit 1
fi

rm -rf "$COPY"
mkdir -p "$COPY" "$ROOT/test-results"
rsync -a --exclude node_modules --exclude dist "$ROOT/apps/tablet/" "$COPY/"
ln -s "$ROOT/apps/tablet/node_modules" "$COPY/node_modules"
cp "$ROOT/tsconfig.base.json" /tmp/tsconfig.base.json

python3 - "$COPY/src/routes/EntryFlow.tsx" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
expected = """      : errorItems.length > 0
        ? 'error'
        : 'welcome';"""
fault = """      : errorItems.length > 0
        ? 'connection'
        : 'welcome';"""
if expected not in source:
    raise SystemExit("fault anchor not found")
path.write_text(source.replace(expected, fault, 1))
PY
echo "fault injected"

(cd "$COPY" && node_modules/.bin/vite --port 5273 --strictPort >"$VITE_LOG" 2>&1 & echo $! >/tmp/e-challan-fault-vite.pid)
VITE_PID="$(cat /tmp/e-challan-fault-vite.pid)"

VITE_READY=false
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null http://127.0.0.1:5273/; then
    VITE_READY=true
    break
  fi
  sleep 0.5
done
if [ "$VITE_READY" != true ]; then
  echo "fault Vite did not start; see $VITE_LOG" >&2
  exit 1
fi

cat >"$CONFIG" <<'TS'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../apps/tablet/e2e',
  outputDir: './fault-run',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  projects: [
    {
      name: 'fault-tablet',
      testDir: '../apps/tablet/e2e',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5273' },
    },
  ],
});
TS

cd "$ROOT"
if pnpm exec playwright test -c "$CONFIG" -g "validation errors use the concerned" >"$RED_LOG" 2>&1; then
  echo "UNEXPECTED: the faulted build passed the acceptance case" >&2
  exit 1
fi
grep -q "getByTestId('marshal-error')" "$RED_LOG" || {
  echo "RED failed for an unexpected reason; see $RED_LOG" >&2
  exit 1
}
echo "fault RED confirmed: marshal-error not rendered (see $RED_LOG)"

python3 - "$COPY/src/routes/EntryFlow.tsx" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
fault = """      : errorItems.length > 0
        ? 'connection'
        : 'welcome';"""
expected = """      : errorItems.length > 0
        ? 'error'
        : 'welcome';"""
if fault not in source:
    raise SystemExit("fault marker missing")
path.write_text(source.replace(fault, expected, 1))
PY
echo "fault reverted"

sleep 1
pnpm exec playwright test -c "$CONFIG" -g "validation errors use the concerned" >"$GREEN_LOG" 2>&1
grep -q "1 passed" "$GREEN_LOG" || {
  echo "reverted run did not pass; see $GREEN_LOG" >&2
  exit 1
}
echo "reverted GREEN confirmed (see $GREEN_LOG)"
