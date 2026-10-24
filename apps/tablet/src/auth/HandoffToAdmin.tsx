import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SPACING } from '@echallan/theme';
import { requestHandoff } from './api';
import { replaceLocation } from './navigate';
import { useSession } from './session';

const DEV_ADMIN_ORIGIN = 'http://127.0.0.1:5174';

/**
 * The dashboard origin used when a Supervisor/Admin signs in on the tablet, or
 * when an unauthenticated tablet visit is sent to the single login page.
 *
 * Production builds receive VITE_ADMIN_ORIGIN from the deployment environment.
 * The development fallback keeps the handoff usable against the local admin Vite
 * server, but it does not auto-redirect anonymous tablet visits; that only happens
 * when the variable is explicitly configured.
 */
function configuredAdminOrigin(): string | null {
  const configured = import.meta.env['VITE_ADMIN_ORIGIN'];
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  return import.meta.env.DEV ? DEV_ADMIN_ORIGIN : null;
}

function dashboardAddress(): string | null {
  const configured = import.meta.env['VITE_ADMIN_ORIGIN'];
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  // The deployed build always supplies VITE_ADMIN_ORIGIN. Development falls back
  // to the admin Vite server so local use also has exactly one sign-in page;
  // component tests keep the tablet form as a rendering seam.
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') return DEV_ADMIN_ORIGIN;
  return null;
}

/** True when this build should send anonymous visitors to the dashboard login. */
export function hasConfiguredDashboardOrigin(): boolean {
  return dashboardAddress() !== null;
}

/** Full dashboard sign-in URL, or null when the build has no dashboard origin. */
export function dashboardLoginUrl(): string | null {
  const origin = dashboardAddress();
  return origin === null ? null : `${origin.replace(/\/+$/u, '')}/`;
}

/** Full-page redirect to the dashboard sign-in page, used in the single-page build. */
export function RedirectToDashboardLogin() {
  useEffect(() => {
    const origin = dashboardAddress();
    if (origin !== null) replaceLocation(`${origin.replace(/\/+$/u, '')}/`);
  }, []);

  return (
    <Stack sx={{ alignItems: 'center', py: SPACING.xl }} spacing={SPACING.md}>
      <CircularProgress />
      <Typography variant="body1">Opening the e-Challan sign-in page…</Typography>
    </Stack>
  );
}

/**
 * Transient screen after a Supervisor/Admin signs in on the tablet.
 *
 * It mints a one-time handoff code and sends the browser to the dashboard, which
 * exchanges the code for a session on its own origin. The session token is never
 * placed in a URL.
 */
export default function HandoffToAdmin() {
  const { token, signOut } = useSession();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (token === null || started.current) return;
    started.current = true;

    const origin = configuredAdminOrigin();
    if (origin === null) {
      setError('The dashboard address is not configured.');
      return;
    }

    void requestHandoff(token)
      .then(({ code }) => {
        const base = origin.replace(/\/+$/u, '');
        replaceLocation(`${base}/#handoff=${encodeURIComponent(code)}`);
      })
      .catch(() => {
        setError('Could not open the dashboard. Sign in again.');
      });
  }, [token]);

  return (
    <Card sx={{ width: '100%', maxWidth: 520 }}>
      <CardContent sx={{ padding: SPACING.xl }}>
        <Stack spacing={SPACING.lg}>
          <Typography component="h2" variant="h2">
            Opening the dashboard
          </Typography>
          {error === null ? (
            <Typography variant="body1" color="text.secondary">
              Taking you to the review workspace…
            </Typography>
          ) : (
            <>
              <Alert severity="error" role="alert">
                {error}
              </Alert>
              <Button variant="contained" onClick={() => void signOut()}>
                Back to sign in
              </Button>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
