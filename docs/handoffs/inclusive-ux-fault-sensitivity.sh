#!/usr/bin/env bash
# Disposable-copy fault sensitivity for the inclusive-UX revamp acceptance.
# Injects one fault into the copy (/tmp/opencode/echallan-faults, refreshed from
# the workspace), runs the matching browser acceptance test against the copy's
# own dev server on port 5273 (the real API on 3001 is shared and unchanged),
# restores the file and reruns. The copy's playwright.config.ts is overridden to
# baseURL 5273 for this check only; the workspace config is untouched.
set -u
cd "$(dirname "$0")"
REPO="/tmp/opencode/echallan-faults"
LOG="$REPO/ux-fault-sensitivity.log"
: > "$LOG"

run_e2e() { # $1=grep
  (cd "$REPO" && pnpm exec playwright test apps/tablet/e2e/inclusive-ux.spec.ts --project=tablet -g "$1" --reporter=line 2>&1 | grep -E "^\s+[0-9]+ (passed|failed)" | tail -1)
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

# --- Fault A: error-summary focus removed (client-error branch) ---
F="$REPO/apps/tablet/src/routes/EntryFlow.tsx"
fault_replace "error-summary focus removed" "$F" \
  $'      setErrors(found);\n      // UXA-04: focus the linked summary on every failed check.\n      setErrorFocusNonce((previous) => previous + 1);\n      return;' \
  $'      setErrors(found);\n      return;'
echo "--- with fault ---" >> "$LOG"
run_e2e "UXA-04" >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_e2e "UXA-04" >> "$LOG" 2>&1

# --- Fault B: picker arrow-key navigation removed ---
F="$REPO/apps/tablet/src/features/issuance/VehiclePicker.tsx"
fault_replace "picker arrow-key navigation removed" "$F" \
  "      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {" \
  "      if (false) {"
echo "--- with fault ---" >> "$LOG"
run_e2e "UXA-09" >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_e2e "UXA-09" >> "$LOG" 2>&1

# --- Fault C: carried-details disclosure removed ---
F="$REPO/apps/tablet/src/features/issuance/VehiclePicker.tsx"
fault_replace "carried-details disclosure removed" "$F" \
  $'          {carriedDetails && <> Existing details kept. Check them before continuing.</>}' \
  ''
echo "--- with fault ---" >> "$LOG"
run_e2e "UXA-12" >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_e2e "UXA-12" >> "$LOG" 2>&1

echo "=== DONE ===" >> "$LOG"
