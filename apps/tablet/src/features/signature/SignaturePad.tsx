import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  SIGNATURE_BYTES_HARD_MAX,
  SignaturePadSchema,
  type SignaturePad as SignatureCapture,
} from '@echallan/contracts';
import { Notice, SPACING, StatusBadge, TOUCH_TARGET_MIN, tokens } from '@echallan/theme';
import SignaturePadLib from 'signature_pad';

/**
 * I-03 signature pad.
 *
 * F1 fix: the SignaturePadLib instance is created exactly once at mount
 * and is NOT recreated when the local `capture` state changes.
 * `handleEndStroke` writes the capture to a ref-backed "drawGeneration"
 * and the parent-visible "provisional stroke" notification. The pad's
 * data is preserved across stroke updates.
 *
 * F2 fix: rehydration from `initialCapture` decodes under a generation
 * token. A Clear, resize, summary change or unmount invalidates the
 * current generation; any in-flight decode that completes against a
 * superseded generation is dropped (the canvas is not touched and the
 * capture is not set). Confirm is only enabled after a successful
 * decode actually renders the image, so the canvas cannot be confirmed
 * blank during async restoration.
 *
 * F3 / F5 follow-up: confirmed acknowledgement is reported through
 * `handleConfirm` only; the parent passes the capture back through
 * `initialCapture` and a current `summaryRevision` so the parent
 * remains the authoritative binder.
 *
 * C2 correction (2026-10-18): a drawing that starts or changes
 * immediately invalidates a previously confirmed capture (parent
 * `onChange(null)`), drops outstanding image hydration and starts a new
 * provisional state, without clearing visible strokes or recreating the
 * pad.
 */

export interface SignatureCaptureProps {
  summaryRevision: string;
  onChange?(capture: SignatureCapture | null): void;
  onInvalidate?(reason: string): void;
  initialCapture?: SignatureCapture | null;
}

interface ResizeSignal {
  generation: number;
}

export default function SignaturePadControl({
  summaryRevision,
  onChange,
  onInvalidate,
  initialCapture,
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const captureRef = useRef<SignatureCapture | null>(initialCapture ?? null);
  const confirmedRef = useRef<SignatureCapture | null>(null);
  // C2: the parent's acknowledged capture, present from mount until a
  // stroke supersedes it — including while a remount decode is pending.
  const parentCaptureRef = useRef<SignatureCapture | null>(null);
  const [captureState, setCaptureState] = useState<SignatureCapture | null>(initialCapture ?? null);
  const [confirmable, setConfirmable] = useState<SignatureCapture | null>(null);
  const [confirmedLocal, setConfirmedLocal] = useState(false);
  const [resizeSignal, setResizeSignal] = useState<ResizeSignal>({ generation: 0 });
  const [invalidated, setInvalidated] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const lastRevisionRef = useRef<string>(summaryRevision);
  const lastDprRef = useRef<number>(-1);
  const lastWidthRef = useRef<number>(0);
  const lastHeightRef = useRef<number>(0);
  const hydrationGenerationRef = useRef<number>(0);
  const onChangeRef = useRef<SignatureCaptureProps['onChange']>(onChange);
  const onInvalidateRef = useRef<SignatureCaptureProps['onInvalidate']>(onInvalidate);
  const captureStateRef = useRef<SignatureCapture | null>(captureState);
  const confirmableRef = useRef<SignatureCapture | null>(confirmable);

  onChangeRef.current = onChange;
  onInvalidateRef.current = onInvalidate;
  captureStateRef.current = captureState;
  confirmableRef.current = confirmable;

  const invalidate = useCallback((reason: string) => {
    captureRef.current = null;
    confirmedRef.current = null;
    parentCaptureRef.current = null;
    setCaptureState(null);
    setConfirmable(null);
    setConfirmedLocal(false);
    setInvalidated(reason);
    setResizeSignal((previous) => ({ generation: previous.generation + 1 }));
    // Bump hydration generation so any in-flight decode is dropped.
    hydrationGenerationRef.current += 1;
    onChangeRef.current?.(null);
    onInvalidateRef.current?.(reason);
  }, []);

  /**
   * C2: a drawing that starts or changes supersedes any previously
   * confirmed capture. Clear the local confirmation, notify the parent
   * that the confirmed capture is obsolete, and drop outstanding image
   * hydration — without clearing the visible strokes or recreating the
   * pad. `parentCaptureRef` covers the remounted-pad case, where the
   * confirmation lives only in the parent's `initialCapture` until a
   * decode restores it. No invalidation notice is shown: drawing again
   * is the new provisional state, not an error.
   */
  const invalidateConfirmed = useCallback(() => {
    hydrationGenerationRef.current += 1;
    setConfirmedLocal(false);
    // Drawing again is the correction; the old invalidation notice is no
    // longer actionable.
    setInvalidated(null);
    if (confirmedRef.current !== null || parentCaptureRef.current !== null) {
      confirmedRef.current = null;
      parentCaptureRef.current = null;
      onChangeRef.current?.(null);
    }
  }, []);

  const resizeCanvas = useCallback(
    (canvas: HTMLCanvasElement, pad: SignaturePadLib | null): boolean => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const widthPx = Math.max(1, Math.round(canvas.getBoundingClientRect().width * dpr));
      const heightPx = Math.max(1, Math.round(canvas.getBoundingClientRect().height * dpr));
      const previousWidth = canvas.width;
      const previousHeight = canvas.height;
      const previousDpr = lastDprRef.current;
      const previousOrientation = previousWidth >= previousHeight && previousWidth > 0;
      const dprChanged = previousDpr > 0 && Math.abs(previousDpr - dpr) > 0.01;
      const dimensionsChanged = previousWidth !== widthPx || previousHeight !== heightPx;
      const orientedLandscape = widthPx >= heightPx;
      const rotated = previousOrientation !== orientedLandscape;
      const stateChanged = dprChanged || dimensionsChanged || rotated;
      // F1: do not assign canvas.width / canvas.height when nothing has
      // changed. Assigning to either property resets the canvas pixels.
      if (stateChanged) {
        canvas.width = widthPx;
        canvas.height = heightPx;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = tokens.surface;
          ctx.fillRect(0, 0, widthPx / dpr, heightPx / dpr);
        }
        if (pad) pad.clear();
      }
      lastWidthRef.current = widthPx;
      lastHeightRef.current = heightPx;
      lastDprRef.current = dpr;
      return stateChanged;
    },
    [],
  );

  const handleBeginStroke = useCallback(() => {
    // C2: invalidate as soon as the drawing starts; endStroke applies the
    // new provisional capture once the stroke is complete.
    invalidateConfirmed();
  }, [invalidateConfirmed]);

  const handleEndStroke = useCallback(() => {
    const pad = padRef.current;
    if (!pad) return;
    // C2: a stroke that ends without a begin event (or after invalidation
    // already ran) must not leave a stale confirmation acknowledged.
    invalidateConfirmed();
    if (pad.isEmpty()) {
      captureRef.current = null;
      setCaptureState(null);
      setConfirmable(null);
      return;
    }
    const dataUrl = pad.toDataURL('image/png');
    const bytes = dataUrlByteLength(dataUrl);
    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 1;
    const height = canvas ? canvas.height : 1;
    if (bytes > SIGNATURE_BYTES_HARD_MAX) {
      setExportError(
        `Signature is ${Math.round(bytes / 1024)} KB; the agreed limit is ${Math.round(SIGNATURE_BYTES_HARD_MAX / 1024)} KB. Clear and try again.`,
      );
      invalidate('oversize');
      return;
    }
    try {
      const parsed = SignaturePadSchema.parse({ dataUrl, width, height, bytes });
      setExportError(null);
      // F1: write the parsed capture to a ref and a UI state that does
      // NOT cause the pad's mount effect to re-run. Confirm is enabled
      // through the same state.
      captureRef.current = parsed;
      setCaptureState(parsed);
      setConfirmable(parsed);
    } catch {
      setExportError("Couldn't package the signature. Clear and try again.");
      invalidate('encoder');
    }
  }, [invalidate, invalidateConfirmed]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // F1: do not depend on `capture` in this callback's closure. Use
    // captureRef so updates to the local capture state do not change
    // this callback's identity.
    const triggered = resizeCanvas(canvas, padRef.current);
    if (triggered) {
      if (captureRef.current !== null) invalidate('resize');
    }
  }, [invalidate, resizeCanvas]);

  // F1: the mount effect depends ONLY on stable initializers. It runs
  // exactly once and does not re-create the pad when the local capture
  // state changes. `handleEndStroke` and `handleResize` are read
  // through the ref guard so their identity changes never trigger the
  // effect to re-run.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    resizeCanvas(canvas, null);
    const pad = new SignaturePadLib(canvas, {
      penColor: tokens.ink,
      minWidth: 1,
      maxWidth: 3,
    });
    padRef.current = pad;
    const beginStroke = () => handleBeginStrokeRef.current();
    pad.addEventListener?.('beginStroke', beginStroke);
    const endStroke = () => handleEndStrokeRef.current();
    pad.addEventListener?.('endStroke', endStroke);
    if (!pad.addEventListener) {
      (pad as unknown as { on?: () => void }).on?.();
    }
    const onResize = () => handleResizeRef.current();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      pad.off?.();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Stable refs that the mount effect's stable listener functions call.
  // This breaks the capture -> handleResize -> useEffect dep cycle.
  const handleBeginStrokeRef = useRef<() => void>(() => undefined);
  const handleEndStrokeRef = useRef<() => void>(() => undefined);
  const handleResizeRef = useRef<() => void>(() => undefined);
  handleBeginStrokeRef.current = handleBeginStroke;
  handleEndStrokeRef.current = handleEndStroke;
  handleResizeRef.current = handleResize;

  // F2 / V5: rehydration from `initialCapture` decodes under a
  // generation token. Clear, resize, summary change, unmount or a
  // newly drawn stroke invalidates the current generation so any
  // in-flight decode that completes against a superseded generation
  // is dropped. The manual draw is the only authoritative visible
  // ink restoration; the library's fromDataURL callback is not
  // awaited and is therefore not relied on.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // C2: the parent only ever passes a confirmed capture back through
    // `initialCapture`, so track it as acknowledged until a stroke or
    // another invalidation supersedes it (even before the decode lands).
    const previousParent = parentCaptureRef.current;
    parentCaptureRef.current = initialCapture ?? null;
    if (initialCapture === undefined || initialCapture === null) {
      // R2: the parent retracted an acknowledged capture while the pad is
      // mounted (e.g. the last photo was removed). Reconcile the child UI to
      // the invalidated state instead of keeping a stale confirmation.
      if (previousParent !== null) {
        const pad = padRef.current;
        if (pad) pad.clear();
        captureRef.current = null;
        confirmedRef.current = null;
        setCaptureState(null);
        setConfirmable(null);
        setConfirmedLocal(false);
        setInvalidated('evidence_removed');
      }
      return;
    }
    const generation = ++hydrationGenerationRef.current;
    const image = new Image();
    image.onload = () => {
      if (hydrationGenerationRef.current !== generation) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw at backing-pixel dimensions; the image's natural
        // width / height match the canvas backing pixels for a full
        // visible restore under any DPR.
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      captureRef.current = initialCapture;
      setCaptureState(initialCapture);
      setConfirmable(initialCapture);
      // R2: `initialCapture` is the parent's acknowledged capture, so a
      // successful restore is the confirmed presentation — not a fresh
      // stroke awaiting confirmation.
      setConfirmedLocal(true);
    };
    image.onerror = () => {
      if (hydrationGenerationRef.current !== generation) return;
      captureRef.current = null;
      parentCaptureRef.current = null;
      setCaptureState(null);
      setConfirmable(null);
      setConfirmedLocal(false);
      setInvalidated('rehydrate_failed');
      onChangeRef.current?.(null);
    };
    image.src = initialCapture.dataUrl;
    return () => {
      // V5: invalidate the generation on effect cleanup so an
      // in-flight decode cannot restore superseded evidence after
      // unmount.
      hydrationGenerationRef.current += 1;
    };
  }, [initialCapture]);

  useEffect(() => {
    if (summaryRevision !== lastRevisionRef.current) {
      lastRevisionRef.current = summaryRevision;
      const pad = padRef.current;
      // F2 / V5: bump the hydration generation so any in-flight decode
      // against the prior revision is dropped.
      hydrationGenerationRef.current += 1;
      if (pad) pad.clear();
      captureRef.current = null;
      confirmedRef.current = null;
      parentCaptureRef.current = null;
      setCaptureState(null);
      setConfirmable(null);
      setConfirmedLocal(false);
      setInvalidated('summary_changed');
      onChangeRef.current?.(null);
      onInvalidateRef.current?.('summary_changed');
    }
  }, [summaryRevision]);

  const handleClear = useCallback(() => {
    const pad = padRef.current;
    if (pad) pad.clear();
    captureRef.current = null;
    confirmedRef.current = null;
    parentCaptureRef.current = null;
    setCaptureState(null);
    setConfirmable(null);
    setConfirmedLocal(false);
    setInvalidated(null);
    setExportError(null);
    // F2: bump hydration generation so an in-flight decode cannot
    // restore cleared evidence.
    hydrationGenerationRef.current += 1;
    onChangeRef.current?.(null);
  }, []);

  const handleConfirm = useCallback(() => {
    // F3 / F5: confirmed acknowledgement is reported through this
    // callback only. The parent binds the capture to the current
    // canonical summary revision. Confirm is only enabled when
    // `confirmable` is set, which requires either a fresh stroke or a
    // successful decode.
    const capture = confirmableRef.current;
    if (capture === null) return;
    confirmedRef.current = capture;
    setConfirmedLocal(true);
    setInvalidated(null);
    onChangeRef.current?.(capture);
  }, []);

  return (
    <Stack spacing={SPACING.lg} data-testid="signature-pad">
      <Stack direction="row" spacing={SPACING.md} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography component="h2" variant="h2" id="signature-heading">
          Driver signature
        </Typography>
        {confirmedLocal ? (
          <StatusBadge label="Signature confirmed" tone="success" />
        ) : (
          confirmable !== null && (
            <StatusBadge label="Stroke captured — confirm to apply" tone="info" />
          )
        )}
      </Stack>
      <Typography variant="body2" id="signature-instructions" sx={{ color: tokens.muted }}>
        Ask the driver to sign inside the box using a finger or stylus.
      </Typography>
      {invalidated !== null && (
        <Notice severity="warning" role="alert">
          {invalidatedReason(invalidated)} Sign again.
        </Notice>
      )}
      {exportError !== null && (
        <Notice severity="error" role="alert">
          {exportError}
        </Notice>
      )}
      <div
        role="group"
        aria-labelledby="signature-heading"
        style={{
          touchAction: 'none',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="signature-canvas"
          aria-label="Signature drawing area"
          aria-describedby="signature-instructions"
          style={{
            width: '100%',
            height: 250,
            background: tokens.surface,
            border: `2px dashed ${tokens.muted}`,
            borderRadius: 12,
            touchAction: 'none',
            display: 'block',
          }}
        />
      </div>
      <Stack spacing={SPACING.md}>
        <Stack direction="row" spacing={SPACING.md} sx={{ flexWrap: 'wrap', rowGap: SPACING.md }}>
          <Button
            variant="contained"
            data-testid="signature-confirm"
            disabled={confirmable === null || confirmedLocal}
            sx={{ minHeight: TOUCH_TARGET_MIN.tabletPrimaryAction }}
            onClick={handleConfirm}
          >
            Confirm signature
          </Button>
          {confirmedLocal && (
            <Button
              variant="outlined"
              onClick={handleClear}
              sx={{ minHeight: TOUCH_TARGET_MIN.tabletSecondaryAction }}
              data-testid="signature-sign-again"
            >
              Sign again
            </Button>
          )}
        </Stack>
        <Divider />
        <Stack direction="row" spacing={SPACING.md}>
          <Button
            variant="outlined"
            onClick={handleClear}
            sx={{ minHeight: TOUCH_TARGET_MIN.tabletSecondaryAction }}
            data-testid="signature-clear"
          >
            Clear signature
          </Button>
        </Stack>
      </Stack>
      {confirmedLocal && (
        <Notice severity="info" role="status">
          Signature captured on this device. No challan has been submitted.
        </Notice>
      )}
      <span style={{ display: 'none' }}>
        Bound to summary revision <code>{summaryRevision.slice(0, 10)}</code>.
      </span>
      <span data-testid="resize-signal" style={{ display: 'none' }}>
        {resizeSignal.generation}
      </span>
    </Stack>
  );
}

function dataUrlByteLength(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return dataUrl.length;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function invalidatedReason(reason: string): string {
  switch (reason) {
    case 'resize':
      return 'Signature cleared because the canvas was resized.';
    case 'summary_changed':
      return 'Signature cleared because the driver summary changed.';
    case 'oversize':
      return 'Signature cleared because it exceeded the agreed size.';
    case 'encoder':
      return 'Signature cleared because the encoded image was rejected.';
    case 'rehydrate_failed':
      return 'Signature cleared because the saved image could not be restored.';
    case 'evidence_removed':
      return 'Signature cleared because the evidence photos changed.';
    default:
      return 'Signature cleared. Sign again.';
  }
}
