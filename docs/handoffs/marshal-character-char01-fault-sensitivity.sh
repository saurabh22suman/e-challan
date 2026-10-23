#!/usr/bin/env bash
# Disposable-copy fault sensitivity for CHAR-01 catalogue classification.
#
# Fault: an HTTP 500 response is classified as a lost network connection (the
# pre-correction behaviour). Expected: the new component acceptance fails.
# Reverting restores GREEN. The workspace is never modified.
#
# No server is needed: this runs the component suite in a disposable copy of
# apps/tablet with a symlinked node_modules.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COPY="/tmp/opencode/e-challan-char01-fault-app"
RED_LOG="/tmp/e-challan-char01-fault-red.log"
GREEN_LOG="/tmp/e-challan-char01-fault-green.log"

cleanup() {
  rm -rf "$COPY" /tmp/tsconfig.base.json
}
trap cleanup EXIT

rm -rf "$COPY"
mkdir -p "$COPY"
rsync -a --exclude node_modules --exclude dist "$ROOT/apps/tablet/" "$COPY/"
ln -s "$ROOT/apps/tablet/node_modules" "$COPY/node_modules"
cp "$ROOT/tsconfig.base.json" /tmp/tsconfig.base.json

python3 - "$COPY/src/features/issuance/useCatalogues.ts" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
expected = "if (!response.ok) return { kind: 'service_error', status: response.status };"
fault = "if (!response.ok) return { kind: 'network' };"
if expected not in source:
    raise SystemExit("fault anchor not found")
path.write_text(source.replace(expected, fault, 1))
PY
echo "fault injected: HTTP failures classified as network"

if (cd "$COPY" && node_modules/.bin/vitest run src/__tests__/catalogue-errors.test.tsx -t "HTTP 500") >"$RED_LOG" 2>&1; then
  echo "UNEXPECTED: the faulted classification passed the acceptance case" >&2
  exit 1
fi
grep -q "to be 'service_error'" "$RED_LOG" || {
  echo "RED failed for an unexpected reason; see $RED_LOG" >&2
  exit 1
}
echo "fault RED confirmed: HTTP 500 classified as network (see $RED_LOG)"

python3 - "$COPY/src/features/issuance/useCatalogues.ts" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
fault = "if (!response.ok) return { kind: 'network' };"
expected = "if (!response.ok) return { kind: 'service_error', status: response.status };"
if fault not in source:
    raise SystemExit("fault marker missing")
path.write_text(source.replace(fault, expected, 1))
PY
echo "fault reverted"

(cd "$COPY" && node_modules/.bin/vitest run src/__tests__/catalogue-errors.test.tsx -t "HTTP 500") >"$GREEN_LOG" 2>&1
grep -q "1 passed" "$GREEN_LOG" || {
  echo "reverted run did not pass; see $GREEN_LOG" >&2
  exit 1
}
echo "reverted GREEN confirmed (see $GREEN_LOG)"
