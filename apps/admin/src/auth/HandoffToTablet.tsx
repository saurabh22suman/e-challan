import { useEffect, useRef, useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ActionButton, Notice, SPACING } from '@echallan/theme';
import { requestHandoff } from './api';
import { replaceLocation } from './navigate';
import { useSession } from './session';

const DEV_TABLET_ORIGIN = 'http://127.0.0.1:5173';

/**
 * The tablet origin used by a Marshal handoff.
 *
 * Production builds receive VITE_TABLET_ORIGIN from the deployment environment.
 * The local development default is the tablet Vite server. A missing value in a
 * production build is a configuration error, not a silent localhost redirect.
 */
function configuredTabletOrigin(): string | null {
  const configured = import.meta.env['VITE_TABLET_ORIGIN'];
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  return import.meta.env.DEV ? DEV_TABLET_ORIGIN : null;
}

/**
 * Transient screen shown after a Marshal signs in at the dashboard.
 *
 * It asks the API for a one-time handoff code, then navigates to the tablet with
 * the code in the fragment. The session token itself is never placed in a URL.
 */
export default function HandoffToTablet() {
  const { token, signOut } = useSession();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (token === null || started.current) return;
    started.current = true;

    const origin = configuredTabletOrigin();
    if (origin === null) {
      setError('The marshal tablet address is not configured.');
      return;
    }

    void requestHandoff(token)
      .then(({ code }) => {
        const base = origin.replace(/\/+$/u, '');
        replaceLocation(`${base}/#handoff=${encodeURIComponent(code)}`);
      })
      .catch(() => {
        setError('Could not open the marshal tablet. Sign in again.');
      });
  }, [token]);

  return (
    <Card sx={{ width: '100%', maxWidth: 460 }}>
      <CardContent sx={{ padding: SPACING.xl }}>
        <Stack spacing={SPACING.lg}>
          <Typography component="h2" variant="h2">
            Opening the marshal tablet
          </Typography>
          {error === null ? (
            <Typography variant="body1" color="text.secondary">
              Taking you to the field workspace…
            </Typography>
          ) : (
            <>
              <Notice tone="danger" role="alert">
                {error}
              </Notice>
              <ActionButton tone="primary" onClick={() => void signOut()}>
                Back to sign in
              </ActionButton>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
