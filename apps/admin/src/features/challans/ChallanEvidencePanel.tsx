import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ChallanEvidenceResponse } from '@echallan/contracts';
import { ActionButton, Notice, SPACING, tokens } from '@echallan/theme';
import {
  fetchEvidenceBlob,
  fetchSignatureBlob,
  getChallanEvidence,
  OperationsApiError,
} from '../../api/operations';

/**
 * Authenticated evidence viewer (E3.2). Metadata is read first; binaries are
 * fetched separately with the bearer token and displayed through short-lived
 * object URLs. No evidence path is public.
 */
export default function ChallanEvidencePanel({
  token,
  challanId,
}: {
  token: string;
  challanId: string;
}) {
  const [evidence, setEvidence] = useState<ChallanEvidenceResponse | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string; alt: string } | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setLoading(true);
    setError(null);
    setEvidence(null);
    setPhotoUrls({});
    setSignatureUrl(null);

    getChallanEvidence(token, challanId)
      .then(async (metadata) => {
        if (cancelled) return;
        const photos = await Promise.all(
          metadata.photos.map(async (photo) => {
            const blob = await fetchEvidenceBlob(token, challanId, photo.id);
            const url = URL.createObjectURL(blob);
            urls.push(url);
            return [photo.id, url] as const;
          }),
        );
        let signature: string | null = null;
        if (metadata.signature !== null) {
          const blob = await fetchSignatureBlob(token, challanId);
          signature = URL.createObjectURL(blob);
          urls.push(signature);
        }
        if (cancelled) return;
        setEvidence(metadata);
        setPhotoUrls(Object.fromEntries(photos));
        setSignatureUrl(signature);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(
          failure instanceof OperationsApiError
            ? failure.message
            : 'The evidence could not be loaded.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [token, challanId]);

  return (
    <Stack spacing={SPACING.md} data-testid="challan-evidence">
      <Typography component="h3" variant="h3">
        Evidence
      </Typography>
      {loading && <CircularProgress aria-label="Loading evidence" />}
      {error !== null && (
        <Notice severity="error" role="status">
          {error}
        </Notice>
      )}
      {!loading && error === null && evidence !== null && (
        <>
          {evidence.photos.length === 0 && evidence.signature === null && (
            <Notice severity="info" role="status">
              No photos or signature are recorded for this synthetic history record.
            </Notice>
          )}
          {evidence.photos.length > 0 && (
            <Stack direction="row" spacing={SPACING.md} sx={{ flexWrap: 'wrap' }}>
              {evidence.photos.map((photo) => (
                <Stack key={photo.id} spacing={SPACING.xs} sx={{ width: 220 }}>
                  <Box
                    component="button"
                    type="button"
                    aria-label={`View evidence photo ${photo.ordinal} full size`}
                    onClick={() => {
                      setZoom(1);
                      setPreview({
                        url: photoUrls[photo.id] ?? '',
                        title: `Evidence photo ${photo.ordinal}`,
                        alt: `Evidence photo ${photo.ordinal} of ${evidence.photos.length}`,
                      });
                    }}
                    sx={{
                      padding: 0,
                      border: `1px solid ${tokens.line}`,
                      borderRadius: 2,
                      overflow: 'hidden',
                      background: 'transparent',
                      cursor: 'zoom-in',
                    }}
                  >
                    <Box
                      component="img"
                      src={photoUrls[photo.id]}
                      alt={`Evidence photo ${photo.ordinal} of ${evidence.photos.length}`}
                      sx={{
                        display: 'block',
                        width: '100%',
                        aspectRatio: '4 / 3',
                        objectFit: 'cover',
                        backgroundColor: tokens.canvas,
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: tokens.muted }}>
                    Photo {photo.ordinal}
                    {photo.byteSize === null ? '' : ` · ${Math.round(photo.byteSize / 1024)} KB`}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {evidence.signature !== null && signatureUrl !== null && (
            <Stack spacing={SPACING.xs}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Driver signature
              </Typography>
              <Box
                component="button"
                type="button"
                aria-label="View driver signature full size"
                onClick={() => {
                  setZoom(1);
                  setPreview({
                    url: signatureUrl,
                    title: 'Driver signature',
                    alt: 'Driver signature',
                  });
                }}
                sx={{
                  padding: 0,
                  width: '100%',
                  maxWidth: 520,
                  border: `1px solid ${tokens.line}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  background: tokens.surface,
                  cursor: 'zoom-in',
                }}
              >
                <Box
                  component="img"
                  src={signatureUrl}
                  alt="Driver signature"
                  sx={{ display: 'block', width: '100%', backgroundColor: tokens.surface }}
                />
              </Box>
            </Stack>
          )}
          {evidence.refusal !== null && (
            <Notice severity="warning" role="status">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Driver refused to sign
              </Typography>
              <Typography variant="body1">{evidence.refusal.reason}</Typography>
              <Typography variant="body2">
                Witness: {evidence.refusal.witnessName} ({evidence.refusal.witnessStaffId})
              </Typography>
            </Notice>
          )}
          <Divider />
        </>
      )}

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        fullWidth
        maxWidth="lg"
        aria-labelledby="evidence-preview-title"
      >
        <DialogTitle id="evidence-preview-title" component="h2">
          {preview?.title ?? 'Evidence'}
        </DialogTitle>
        <DialogContent dividers sx={{ backgroundColor: tokens.canvas, overflow: 'auto' }}>
          {preview !== null && (
            <Box sx={{ maxHeight: '68vh', overflow: 'auto', textAlign: 'center' }}>
              <Box
                component="img"
                src={preview.url}
                alt={preview.alt}
                sx={{
                  display: 'block',
                  maxWidth: zoom === 1 ? '100%' : 'none',
                  mx: 'auto',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 120ms ease',
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <ActionButton
            tone="ghost"
            size="sm"
            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
            disabled={zoom <= 1}
          >
            Zoom out
          </ActionButton>
          <ActionButton tone="ghost" size="sm" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </ActionButton>
          <ActionButton
            tone="ghost"
            size="sm"
            onClick={() => setZoom((value) => Math.min(4, value + 0.25))}
            disabled={zoom >= 4}
          >
            Zoom in
          </ActionButton>
          <ActionButton tone="ghost" size="sm" onClick={() => setPreview(null)}>
            Close
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
