#!/usr/bin/env bash
# Disposable-copy fault sensitivity for the entry-media acceptance.
# Each fault is injected into ONE copy, the matching acceptance test is run
# (expected to FAIL for the injected fault), the file is restored from the
# backup, and the test is rerun (expected to PASS).
set -u
cd "$(dirname "$0")"
REPO="/tmp/opencode/echallan-faults"
LOG="$REPO/fault-sensitivity.log"
: > "$LOG"

run_unit() { # $1=app-filter $2=test-path
  (cd "$REPO" && pnpm --filter "$1" exec vitest run "$2" 2>&1 | grep -E "Tests +[0-9]+ (failed|passed)" | tail -1)
}
run_e2e() { # $1=spec $2=grep
  (cd "$REPO" && pnpm exec playwright test "$1" --project tablet -g "$2" --reporter=line 2>&1 | grep -E "^\s+[0-9]+ (passed|failed)" | tail -1)
}

fault() { # $1=name $2=file $3=node-replace-expr
  local name="$1"; local file="$2"; local expr="$3"
  cp "$file" "$file.orig"
  node -e "$expr" "$file"
  echo "=== FAULT: $name ===" >> "$LOG"
  echo "--- with fault ---" >> "$LOG"
}
restore() { # $1=file
  mv "$1.orig" "$1"
}

# --- Fault 1: lookup abort removed ---
F="$REPO/apps/tablet/src/features/issuance/useLookupController.ts"
fault "lookup abort removed" "$F" "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');s=s.replace('      abortCurrent();\n      generationRef.current += 1;','      generationRef.current += 1;');fs.writeFileSync(p,s);"
run_unit @echallan/tablet src/__tests__/corrections.test.tsx >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_unit @echallan/tablet src/__tests__/corrections.test.tsx >> "$LOG" 2>&1

# --- Fault 2: server error mapping removed ---
F="$REPO/apps/tablet/src/features/issuance/serverErrors.ts"
fault "server error mapping removed" "$F" "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');s=s.replace('  if (OTHER_FIELD_TO_FORM_FIELD[issue.field] !== undefined) {','  if (false) {');fs.writeFileSync(p,s);"
run_unit @echallan/tablet src/__tests__/corrections.test.tsx >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_unit @echallan/tablet src/__tests__/corrections.test.tsx >> "$LOG" 2>&1

# --- Fault 3: summary revision drops remarks ---
F="$REPO/packages/contracts/src/issuance.ts"
fault "summary revision drops remarks" "$F" "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');s=s.replace('    input.draft.remarks.trim(),\n','');fs.writeFileSync(p,s);"
(cd "$REPO" && pnpm run build:packages >/dev/null 2>&1)
run_unit @echallan/contracts test/issuance.test.ts >> "$LOG" 2>&1
restore "$F"
(cd "$REPO" && pnpm run build:packages >/dev/null 2>&1)
echo "--- restored ---" >> "$LOG"
run_unit @echallan/contracts test/issuance.test.ts >> "$LOG" 2>&1

# --- Fault 4: V1 parent revision effect removed ---
F="$REPO/apps/tablet/src/routes/EntryFlow.tsx"
fault "V1 parent revision effect removed" "$F" "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');s=s.replace('  useEffect(() => {\n    setSignature(null);\n    setRefusal(null);\n  }, [revision]);','  // fault: revision effect removed');fs.writeFileSync(p,s);"
run_e2e apps/tablet/e2e/preview-binding.spec.ts "changed server preview invalidates parent signature" >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_e2e apps/tablet/e2e/preview-binding.spec.ts "changed server preview invalidates parent signature" >> "$LOG" 2>&1

# --- Fault 5: V2 acknowledgement gate loses full-change check ---
fault "V2 full preview-change gate removed" "$F" "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');s=s.replace('      if (!acknowledgedAtStart || previewChangedFull) {','      if (!acknowledgedAtStart) {');fs.writeFileSync(p,s);"
run_e2e apps/tablet/e2e/preview-binding.spec.ts "changed occurrence renews duplicate acknowledgement" >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_e2e apps/tablet/e2e/preview-binding.spec.ts "changed occurrence renews duplicate acknowledgement" >> "$LOG" 2>&1

# --- Fault 6: encoder hard-max check loosened ---
F="$REPO/apps/tablet/src/features/photos/encoder.ts"
fault "encoder hard-max check loosened" "$F" "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');s=s.replace('    if (bytes <= PHOTO_BYTES_TARGET) {','    if (bytes <= PHOTO_BYTES_HARD_MAX * 10) {');fs.writeFileSync(p,s);"
run_unit @echallan/tablet src/__tests__/camera-capture.test.tsx >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_unit @echallan/tablet src/__tests__/camera-capture.test.tsx >> "$LOG" 2>&1

# --- Fault 7: signature resize always writes backing dimensions ---
F="$REPO/apps/tablet/src/features/signature/SignaturePad.tsx"
fault "signature resize always writes backing dimensions" "$F" "const fs=require('fs');const p=process.argv[1];let s=fs.readFileSync(p,'utf8');s=s.replace('      if (stateChanged) {\n        canvas.width = widthPx;','      if (true) {\n        canvas.width = widthPx;');fs.writeFileSync(p,s);"
run_e2e apps/tablet/e2e/signature-probe.spec.ts "same-size resize preserves ink" >> "$LOG" 2>&1
restore "$F"
echo "--- restored ---" >> "$LOG"
run_e2e apps/tablet/e2e/signature-probe.spec.ts "same-size resize preserves ink" >> "$LOG" 2>&1

echo "=== DONE ===" >> "$LOG"
