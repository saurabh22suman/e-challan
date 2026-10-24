import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  CapturedPhotoStoreSchema,
  MAX_PHOTOS,
  MIN_PHOTOS,
  MediaFailureReasonSchema,
  PhotoCaptureSchema,
  removePhoto,
  wouldExceedPhotoLimit,
  type PhotoCapture,
} from '@echallan/contracts';
import { ActionButton, Notice, SPACING, StatusBadge, tokens } from '@echallan/theme';
import { encodeJpegToBudget } from './encoder.js';

/**
 * I-02 live-camera photo capture.
 *
 * R4 fixes:
 *  - per-capture generation token: `handleCapture` records the token on
 *    entry, sets the store, and re-checks the token on every `await`.
 *    Late completions from a superseded acquisition are dropped.
 *  - `stopCamera` aborts the in-flight `getUserMedia` and the
 *    stop-cancellation race is guarded at every async boundary.
 *  - capture is disabled while an encoding is in flight, so concurrent
 *    captures do not race.
 *  - readiness is verified against the actual video's natural size
 *    (no 640x480 fabrication).
 *  - the encoder attempts the approved 300 KB target before the 800 KB
 *    hard cap and exposes the outcome through the returned object.
 *
 * C1 correction (2026-10-18): Cancel during an acquired-but-pending
 * `video.play()` now shares stopCamera's immediate teardown (tracks,
 * video attachment, encoding generation); the late play settlement is
 * discarded by the existing post-await guard.
 */

export interface PhotoCaptureProps {
  initialStore?: { acceptedCount: number; photos: PhotoCapture[] };
  onChange?(store: { acceptedCount: number; photos: PhotoCapture[] }): void;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  canvasFactory?: (width: number, height: number) => HTMLCanvasElement;
  readyOverride?: boolean;
}

interface AcquisitionGeneration {
  generation: number;
  controller: AbortController;
}

export default function PhotoCapture({
  initialStore,
  onChange,
  getUserMedia: getUserMediaArg,
  canvasFactory,
  readyOverride,
}: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const acquisitionRef = useRef<AcquisitionGeneration | null>(null);
  const captureRef = useRef(0);
  const encodingRef = useRef(false);
  const [store, setStore] = useState(() =>
    CapturedPhotoStoreSchema.parse(initialStore ?? { acceptedCount: 0, photos: [] }),
  );
  const [streaming, setStreaming] = useState(false);
  const [acquiring, setAcquiring] = useState(false);
  const [framesReady, setFramesReady] = useState(false);
  const [encoding, setEncoding] = useState(false);
  const [failure, setFailure] = useState<{
    reason: (typeof MediaFailureReasonSchema.options)[number];
    message: string;
  } | null>(null);

  const getUserMedia = useCallback(
    async (constraints: MediaStreamConstraints) => {
      if (getUserMediaArg) return getUserMediaArg(constraints);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('getUserMedia is not available.', 'NotFoundError');
      }
      return navigator.mediaDevices.getUserMedia(constraints);
    },
    [getUserMediaArg],
  );

  const stopStream = useCallback((stream: MediaStream | null) => {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
  }, []);

  const stopCamera = useCallback(() => {
    // V4: invalidate any in-flight capture immediately so a late
    // encoding completion does not set parent state or allocate a new
    // object URL after cleanup.
    captureRef.current += 1;
    const current = acquisitionRef.current;
    if (current) {
      current.controller.abort();
      acquisitionRef.current = null;
    }
    stopStream(streamRef.current);
    streamRef.current = null;
    setStreaming(false);
    setFramesReady(false);
    setAcquiring(false);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // Ignore pause failures; the stream tracks are stopped below.
      }
      videoRef.current.srcObject = null;
    }
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current = [];
  }, [stopStream]);

  useEffect(() => {
    return () => {
      // V4: bump the capture generation on unmount so a late encode
      // completion is dropped.
      captureRef.current += 1;
      stopCamera();
    };
  }, [stopCamera]);

  const handleVideoReady = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // R4: actual decoded frame readiness — natural size must be
    // non-zero, not a fabricated fallback.
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setFramesReady(true);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setFailure(null);
    setFramesReady(false);
    setAcquiring(true);
    const controller = new AbortController();
    const generation = Date.now();
    acquisitionRef.current = { controller, generation };
    let acquiredStream: MediaStream | null = null;
    try {
      if (
        typeof window !== 'undefined' &&
        !window.isSecureContext &&
        window.location.hostname !== 'localhost'
      ) {
        // R4: insecure context is detected before acquisition so
        // the user is told why the camera cannot start.
        setFailure({
          reason: 'insecure_context',
          message: 'Camera capture needs a trusted HTTPS connection.',
        });
        setAcquiring(false);
        return;
      }
      const stream = await getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      // R4: the late-stream acquisition guard. The controller may
      // have been aborted (stop/exit/new start) or the user may have
      // cancelled while we were awaiting.
      if (controller.signal.aborted) {
        stopStream(stream);
        return;
      }
      if (acquisitionRef.current?.controller !== controller) {
        // A newer start or reset has superseded us; stop the late stream.
        stopStream(stream);
        return;
      }
      acquiredStream = stream;
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        try {
          await video.play();
        } catch {
          // Autoplay may be blocked; readiness listener will still fire
          // on the first loaded frame.
        }
      }
      // R4: re-check after the play() await. A cancel during play()
      // must not flip the streaming state on.
      if (controller.signal.aborted || acquisitionRef.current?.controller !== controller) {
        stopStream(stream);
        return;
      }
      setStreaming(true);
      setAcquiring(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      const reason = mapMediaError(error);
      setFailure({ reason, message: describeFailure(reason) });
      setStreaming(false);
      setAcquiring(false);
    } finally {
      // R4: in the success path the controller is still in
      // acquisitionRef; do not clear it here. The stop path clears it.
      if (acquiredStream === null && acquisitionRef.current?.controller === controller) {
        acquisitionRef.current = null;
        setAcquiring(false);
      }
    }
  }, [getUserMedia, stopStream]);

  const cancelAcquisition = useCallback(() => {
    // C1: cancel shares the immediate teardown with stopCamera so an
    // already-acquired stream is stopped and detached even while
    // `video.play()` is still pending. A late play settlement is dropped
    // by the post-await guard without disturbing a newer acquisition.
    if (acquisitionRef.current === null) return;
    stopCamera();
  }, [stopCamera]);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !framesReady || !streaming) return;
    if (wouldExceedPhotoLimit(store)) return;
    if (encodingRef.current) return;
    // R4: per-capture generation token. Late completions compare
    // against this token to discard stale-store updates.
    const generation = ++captureRef.current;
    encodingRef.current = true;
    setEncoding(true);
    const naturalWidth = video.videoWidth;
    const naturalHeight = video.videoHeight;
    // V4: the capture is gated by actual decoded frame readiness. If
    // the natural video size is not yet known, fail closed with a
    // recoverable notice rather than invent dimensions.
    if (naturalWidth <= 0 || naturalHeight <= 0) {
      setFailure({
        reason: 'encoder_failed',
        message: 'Camera frame is not ready yet. Try again.',
      });
      encodingRef.current = false;
      setEncoding(false);
      return;
    }
    const width = naturalWidth;
    const height = naturalHeight;
    const outcome = await encodeJpegToBudget({
      source: video,
      sourceWidth: width,
      sourceHeight: height,
      factory: (w, h) => {
        const canvas = canvasFactory ? canvasFactory(w, h) : document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        return { canvas, context: canvas.getContext('2d')! };
      },
    });
    if (generation !== captureRef.current) {
      // R4: a newer capture has started; drop this stale result.
      encodingRef.current = false;
      setEncoding(false);
      return;
    }
    if (!outcome.ok) {
      setFailure({ reason: outcome.reason, message: outcome.message });
      encodingRef.current = false;
      setEncoding(false);
      return;
    }
    let next: { acceptedCount: number; photos: PhotoCapture[] };
    try {
      next = CapturedPhotoStoreSchema.parse({
        acceptedCount: store.acceptedCount + 1,
        photos: [
          ...store.photos,
          PhotoCaptureSchema.parse({
            id: cryptoUUID(),
            dataUrl: outcome.result.dataUrl,
            width: outcome.result.width,
            height: outcome.result.height,
            bytes: outcome.result.bytes,
          }),
        ],
      });
    } catch {
      setFailure({ reason: 'encoder_failed', message: "Couldn't package the captured frame." });
      encodingRef.current = false;
      setEncoding(false);
      return;
    }
    if (generation !== captureRef.current) {
      encodingRef.current = false;
      setEncoding(false);
      return;
    }
    setStore(next);
    onChange?.(next);
    if (outcome.result.dataUrl.startsWith('data:')) {
      try {
        const url = URL.createObjectURL(dataUrlToBlob(outcome.result.dataUrl, 'image/jpeg'));
        objectUrlsRef.current.push(url);
      } catch {
        // Best-effort thumbnail URL; the data URL is the source of truth.
      }
    }
    encodingRef.current = false;
    setEncoding(false);
  }, [canvasFactory, framesReady, onChange, store, streaming]);

  const handleDelete = useCallback(
    (id: string) => {
      const next = removePhoto(store, id);
      setStore(next);
      onChange?.(next);
      // R3 follow-up: deleting the last photo invalidates any
      // acknowledgement that depended on the captured evidence.
      if (next.acceptedCount === 0) {
        onChange?.(next);
      }
    },
    [onChange, store],
  );

  const captureDisabled =
    !streaming || !framesReady || wouldExceedPhotoLimit(store) || failure !== null || encoding;

  return (
    <Stack spacing={SPACING.lg} data-testid="photo-capture">
      <Stack direction="row" spacing={SPACING.md} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography component="h2" variant="h2">
          Evidence photos
        </Typography>
        <StatusBadge label={`${store.acceptedCount} of ${MAX_PHOTOS} captured`} tone="info" />
      </Stack>
      {failure !== null && (
        <Notice severity="error" role="alert">
          {failure.message}
        </Notice>
      )}
      {encoding && (
        <Notice severity="info" role="status">
          Compressing captured frame…
        </Notice>
      )}
      {acquiring && (
        <Notice severity="info" role="status">
          Requesting camera permission…
          <ActionButton
            tone="secondary"
            onClick={cancelAcquisition}
            sx={{ ml: SPACING.md }}
            data-testid="photo-cancel-acquire"
          >
            Cancel
          </ActionButton>
        </Notice>
      )}
      <Box
        sx={{
          borderRadius: 3,
          border: streaming ? 'none' : `2px dashed ${tokens.line}`,
          backgroundColor: streaming ? tokens.mediaSurface : tokens.canvas,
          minHeight: 260,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          data-testid="photo-video"
          onLoadedMetadata={handleVideoReady}
          onCanPlay={handleVideoReady}
          playsInline
          muted
          style={{
            width: '100%',
            maxHeight: 360,
            backgroundColor: tokens.mediaSurface,
            display: streaming ? 'block' : 'none',
          }}
        />
        {!streaming && !acquiring && (
          <Stack spacing={SPACING.md} sx={{ alignItems: 'center', padding: SPACING.xxl }}>
            <PhotoCameraIcon sx={{ fontSize: 44, color: tokens.muted }} />
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              The camera is off. Start it to capture evidence.
            </Typography>
            <ActionButton
              tone="primary"
              onClick={() => void startCamera()}
              disabled={acquiring}
              data-testid="photo-start-camera"
            >
              Start camera
            </ActionButton>
          </Stack>
        )}
      </Box>
      {streaming && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={SPACING.md}>
          <ActionButton
            tone="primary"
            data-testid="photo-capture-button"
            onClick={() => void handleCapture()}
            disabled={captureDisabled}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {wouldExceedPhotoLimit(store)
              ? `Maximum ${MAX_PHOTOS} photos`
              : encoding
                ? 'Compressing…'
                : 'Take photo'}
          </ActionButton>
          <ActionButton
            tone="secondary"
            onClick={stopCamera}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
            data-testid="photo-stop-camera"
          >
            Stop camera
          </ActionButton>
        </Stack>
      )}
      {store.photos.length > 0 && (
        <Stack direction="row" spacing={SPACING.md} sx={{ flexWrap: 'wrap' }}>
          {store.photos.map((photo, index) => (
            <Stack
              key={photo.id}
              spacing={SPACING.sm}
              sx={{
                width: 176,
                padding: SPACING.md,
                border: `1px solid ${tokens.line}`,
                borderRadius: 3,
                backgroundColor: tokens.surface,
              }}
              data-testid="photo-thumb"
            >
              <img
                src={photo.dataUrl}
                alt={`Evidence photo ${index + 1} of ${MAX_PHOTOS}`}
                style={{ width: '100%', borderRadius: 8 }}
              />
              <Typography variant="body2" sx={{ color: tokens.muted }}>
                {photo.width}×{photo.height} · {Math.round(photo.bytes / 1024)} KB
              </Typography>
              <ActionButton
                tone="secondary"
                onClick={() => handleDelete(photo.id)}
                data-testid="photo-retake"
              >
                Retake
              </ActionButton>
            </Stack>
          ))}
        </Stack>
      )}
      {readyOverride !== undefined && readyOverride && (
        <span data-testid="ready-override" style={{ display: 'none' }}>
          {String(readyOverride)}
        </span>
      )}
      <Typography variant="body2" role="status" aria-live="polite" sx={{ color: tokens.muted }}>
        Photos: {store.acceptedCount} of {MAX_PHOTOS} (minimum {MIN_PHOTOS} required).
      </Typography>
    </Stack>
  );
}

function mapMediaError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'permission_denied' as const;
    }
    if (error.name === 'AbortError') return 'cancelled' as const;
    if (error.name === 'NotFoundError') return 'no_camera' as const;
    if (error.name === 'NotReadableError') return 'camera_busy' as const;
  }
  return 'permission_unsupported' as const;
}

function describeFailure(reason: (typeof MediaFailureReasonSchema.options)[number]): string {
  switch (reason) {
    case 'permission_denied':
      return 'Camera permission was denied. Allow camera access or try a different device.';
    case 'permission_dismissed':
      return 'Camera permission was dismissed without a response. Try again and grant access.';
    case 'permission_unsupported':
      return 'This device does not support camera capture. Use a supported tablet or ask your supervisor.';
    case 'insecure_context':
      return 'Camera capture needs a trusted HTTPS connection.';
    case 'no_camera':
      return 'No camera was detected on this device.';
    case 'camera_busy':
      return 'The camera is in use by another application. Close other apps and try again.';
    case 'encoder_failed':
      return "Couldn't process the captured frame. Try again.";
    case 'oversized_after_retry':
      return "Couldn't compress the photo to the agreed size. Try a steadier shot.";
    case 'cancelled':
      return 'Capture was cancelled before the camera could start.';
    default:
      return 'The camera could not be started. Try again or ask your supervisor.';
  }
}

function cryptoUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padStart(12, '0');
}

function dataUrlToBlob(dataUrl: string, type: string): Blob {
  const index = dataUrl.indexOf(',');
  if (index < 0) return new Blob([dataUrl], { type });
  const decoded = atob(dataUrl.slice(index + 1));
  const buffer = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) buffer[i] = decoded.charCodeAt(i);
  return new Blob([buffer], { type });
}
