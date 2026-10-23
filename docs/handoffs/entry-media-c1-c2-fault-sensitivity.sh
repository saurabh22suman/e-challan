#!/usr/bin/env bash
# Disposable-copy fault sensitivity for the entry-media C1/C2 correction.
# Each fault is injected into ONE copy, the matching acceptance test is run
# (expected to FAIL for the injected fault), the file is restored from the
# backup, and the test is rerun (expected to PASS). The copy is
# /tmp/opencode/echallan-faults, refreshed from the workspace before the run.
#
# Browser-level failure sensitivity for C2a is the recorded rev-1 RED run of
# apps/tablet/e2e/entry-media-invalidation.spec.ts against the unfixed build
# (fault class: no parent invalidation), which failed at the acknowledgement
# assertion and passes after the fix; the copy runs here cover the unit guards.
set -u
cd "$(dirname "$0")"
REPO="/tmp/opencode/echallan-faults"
LOG="$REPO/c1c2-fault-sensitivity.log"
: > "$LOG"

run_unit() { # $1=test-path
  (cd "$REPO" && pnpm --filter @echallan/tablet exec vitest run "$1" 2>&1 | grep -E "Tests +[0-9]+ (failed|passed)" | tail -1)
}

fault_replace() { # $1=name $2=file $3=search $4=replacement
  local name="$1" file="$2" search="$3" repl="$4"
  cp "$file" "$file.orig"
  if ! node -e "
    const fs = require('fs');
    const [p, search, repl] = process.argv.slice(1);
    const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(search)) {
      console.error('SEARCH NOT FOUND: ' + p);
      process.exit(2);
    }
    fs.writeFileSync(p, s.split(search).join(repl));
  " "$file" "$search" "$repl"; then
    echo "=== FAULT FAILED TO APPLY: $name ===" >> "$LOG"
    return 1
  fi
  echo "=== FAULT: $name ===" >> "$LOG"
}

restore() { # $1=file
  mv "$1.orig" "$1"
}

# --- Fault 1: C1 immediate cancel teardown removed (pre-fix body restored) ---
F="$REPO/apps/tablet/src/features/photos/PhotoCapture.tsx"
fault_replace "C1 immediate cancel teardown removed" "$F" \
  $'    if (acquisitionRef.current === null) return;\n    stopCamera();' \
  $'    const current = acquisitionRef.current;\n    if (current) {\n      current.controller.abort();\n      acquisitionRef.current = null;\n    }\n    setAcquiring(false);'
echo "--- with fault ---" >> "$LOG"
run_unit src/__tests__/photo-cancel-play.test.tsx >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_unit src/__tests__/photo-cancel-play.test.tsx >> "$LOG" 2>&1

# --- Fault 2: C2 parent notification removed ---
F="$REPO/apps/tablet/src/features/signature/SignaturePad.tsx"
fault_replace "C2 parent notification removed" "$F" \
  '    if (confirmedRef.current !== null || parentCaptureRef.current !== null) {' \
  '    if (false) {'
echo "--- with fault ---" >> "$LOG"
run_unit src/__tests__/signature-invalidation.test.tsx >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_unit src/__tests__/signature-invalidation.test.tsx >> "$LOG" 2>&1

# --- Fault 3: C2 hydration-generation bump removed from stroke invalidation ---
F="$REPO/apps/tablet/src/features/signature/SignaturePad.tsx"
fault_replace "C2 stroke hydration invalidation removed" "$F" \
  $'  const invalidateConfirmed = useCallback(() => {\n    hydrationGenerationRef.current += 1;\n' \
  $'  const invalidateConfirmed = useCallback(() => {\n'
echo "--- with fault ---" >> "$LOG"
run_unit src/__tests__/signature-invalidation.test.tsx >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_unit src/__tests__/signature-invalidation.test.tsx >> "$LOG" 2>&1

echo "=== DONE ===" >> "$LOG"
