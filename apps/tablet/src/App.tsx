import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { ActionButton, AppThemeProvider, PwaInstallPrompt, SPACING, tokens } from '@echallan/theme';
import LoginScreen from './routes/LoginScreen';
import HandoffToAdmin, {
  RedirectToDashboardLogin,
  hasConfiguredDashboardOrigin,
} from './auth/HandoffToAdmin';
import { IdleLogoutGuard, SessionProvider, useSession } from './auth/session';
import ProfileDialog from './profile/ProfileDialog';
import SyncStatusBar from './features/sync/SyncStatusBar';
import type { DriverLanguage } from './features/issuance/driverCopy';

const EntryFlow = lazy(() => import('./routes/EntryFlow'));

/**
 * Marshal tablet shell (F-04): real sign-in, the approved full-width entry flow,
 * logout and the 10-minute idle logout. Protected screens render only for a session
 * the API confirmed, so nothing protected exists in the DOM before authentication.
 *
 * B-09 restyle: deep navy chrome with a blue baseline, a session context block in
 * the toolbar and a lighter page canvas. The h1 and Log out control keep their
 * accessible names.
 */
const HIGH_CONTRAST_KEY = 'echallan.tablet.high-contrast';
const DRIVER_LANGUAGE_KEY = 'echallan.tablet.driver-language';
const ROUTER_BASE = import.meta.env.BASE_URL.replace(/\/$/u, '');

function readHighContrast(): boolean {
  try {
    return window.localStorage.getItem(HIGH_CONTRAST_KEY) === 'true';
  } catch {
    return false;
  }
}

function readDriverLanguage(): DriverLanguage {
  try {
    const value = window.localStorage.getItem(DRIVER_LANGUAGE_KEY);
    return value === 'hi' || value === 'gu' ? value : 'en';
  } catch {
    return 'en';
  }
}

export default function App() {
  const [highContrast, setHighContrast] = useState(readHighContrast);
  const [language, setLanguage] = useState<DriverLanguage>(readDriverLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(HIGH_CONTRAST_KEY, String(highContrast));
      window.localStorage.setItem(DRIVER_LANGUAGE_KEY, language);
    } catch {
      /* preferences simply do not persist */
    }
  }, [highContrast, language]);

  return (
    <AppThemeProvider surface="tablet" highContrast={highContrast}>
      <BrowserRouter basename={ROUTER_BASE}>
        <SessionProvider>
          <SessionGate
            highContrast={highContrast}
            onHighContrastChange={setHighContrast}
            language={language}
            onLanguageChange={setLanguage}
          />
        </SessionProvider>
      </BrowserRouter>
    </AppThemeProvider>
  );
}

function SessionGate({
  highContrast,
  onHighContrastChange,
  language,
  onLanguageChange,
}: {
  highContrast: boolean;
  onHighContrastChange: (value: boolean) => void;
  language: DriverLanguage;
  onLanguageChange: (value: DriverLanguage) => void;
}) {
  const { status, identity, restoring } = useSession();
  const dashboardConfigured = hasConfiguredDashboardOrigin();

  // In the deployed single-login build, wait for a stored token to finish
  // validating before deciding to redirect. Without this, a handoff or reload
  // would briefly look anonymous and bounce back to the dashboard.
  if (restoring && dashboardConfigured) {
    return (
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACING.md,
          backgroundColor: tokens.canvas,
          px: SPACING.lg,
        }}
      >
        <CircularProgress />
        <Typography variant="body1">Restoring your session…</Typography>
      </Box>
    );
  }

  if (status === 'authenticated') {
    // The dashboard is the single sign-in page. A Supervisor/Admin who signed in
    // here is handed back to it instead of entering the field workspace.
    if (identity?.user.role !== 'Marshal') return <HandoffToAdmin />;
    return (
      <TabletShell
        highContrast={highContrast}
        onHighContrastChange={onHighContrastChange}
        language={language}
        onLanguageChange={onLanguageChange}
      />
    );
  }

  // The tablet has no user-facing login form: anonymous visitors always go to
  // the one dashboard sign-in page. Component tests keep the form as a rendering
  // seam, and a misconfigured production build fails visibly instead of silently
  // showing a second login surface.
  if (dashboardConfigured) {
    return (
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.canvas,
          px: SPACING.lg,
        }}
      >
        <RedirectToDashboardLogin />
      </Box>
    );
  }

  if (import.meta.env.MODE !== 'test') {
    return (
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.canvas,
          px: SPACING.lg,
        }}
      >
        <Stack spacing={SPACING.sm} sx={{ maxWidth: 520 }}>
          <Typography component="h1" variant="h2">
            Sign-in page unavailable
          </Typography>
          <Typography variant="body1" sx={{ color: tokens.muted }}>
            The dashboard sign-in address is not configured for this tablet build.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.canvas,
        px: SPACING.lg,
      }}
    >
      <LoginScreen />
    </Box>
  );
}

function TabletShell({
  highContrast,
  onHighContrastChange,
  language,
  onLanguageChange,
}: {
  highContrast: boolean;
  onHighContrastChange: (value: boolean) => void;
  language: DriverLanguage;
  onLanguageChange: (value: DriverLanguage) => void;
}) {
  const { identity, signOut, token } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <IdleLogoutGuard onIdle={() => void signOut()} />
      <AppBar position="sticky">
        <Toolbar sx={{ minHeight: 64, gap: SPACING.md, py: SPACING.sm }}>
          <Stack direction="row" spacing={SPACING.md} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 34,
                height: 34,
                display: 'grid',
                placeItems: 'center',
                border: `1px solid ${tokens.onNavy.border}`,
                borderRadius: '8px',
                color: tokens.surface,
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              EC
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  color: tokens.onNavy.subtitle,
                  letterSpacing: '0.12em',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                DMD SECURITY
              </Typography>
              <Typography
                component="p"
                sx={{
                  margin: 0,
                  color: tokens.surface,
                  fontSize: 16,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                e-Challan
              </Typography>
            </Box>
          </Stack>
          <Stack
            direction="row"
            spacing={SPACING.sm}
            sx={{
              marginLeft: 'auto',
              alignItems: 'center',
              flexWrap: 'nowrap',
            }}
          >
            {identity !== null && (
              <Stack
                sx={{ alignItems: 'flex-end', display: { xs: 'none', md: 'flex' } }}
                spacing={0}
              >
                <Typography variant="body2" sx={{ color: tokens.surface, fontWeight: 600 }}>
                  {identity.user.username}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.onNavy.subtitle }}>
                  {identity.user.role}
                </Typography>
              </Stack>
            )}
            <ActionButton
              tone="secondary"
              size="sm"
              onClick={() => setProfileOpen(true)}
              disabled={token === null}
              sx={{
                color: tokens.surface,
                borderColor: tokens.onNavy.border,
                '&:hover': {
                  borderColor: tokens.surface,
                  backgroundColor: tokens.onNavy.hover,
                },
                '&:focus-visible': {
                  outline: `3px solid ${tokens.surface}`,
                  outlineOffset: 2,
                },
              }}
            >
              Profile
            </ActionButton>
            <ActionButton
              tone="secondary"
              size="sm"
              onClick={() => void signOut()}
              sx={{
                color: tokens.surface,
                borderColor: tokens.onNavy.border,
                '&:hover': {
                  borderColor: tokens.surface,
                  backgroundColor: tokens.onNavy.hover,
                },
                '&:focus-visible': {
                  outline: `3px solid ${tokens.surface}`,
                  outlineOffset: 2,
                },
              }}
            >
              Log out
            </ActionButton>
          </Stack>
        </Toolbar>
      </AppBar>
      <SyncStatusBar />
      <PwaInstallPrompt />

      <Container component="main" maxWidth={false} sx={{ py: 0, px: 0 }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 1200,
            margin: '0 auto',
            padding: { xs: `${SPACING.lg} ${SPACING.lg} 0`, md: `${SPACING.xl} ${SPACING.lg} 0` },
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: tokens.muted, fontWeight: 600, letterSpacing: '0.12em' }}
          >
            Field entry
          </Typography>
          <Typography
            component="h1"
            variant="h1"
            sx={{ margin: 0, marginTop: SPACING.xs, color: tokens.ink }}
          >
            Create new safety violation
          </Typography>
          {identity !== null && (
            <Stack
              direction="row"
              spacing={SPACING.sm}
              sx={{ marginTop: SPACING.sm, flexWrap: 'wrap', color: tokens.muted }}
            >
              <Typography variant="body2" sx={{ color: 'inherit' }}>
                {identity.post?.label ?? 'No post'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'inherit' }} aria-hidden="true">
                ·
              </Typography>
              <Typography variant="body2" sx={{ color: 'inherit' }}>
                {identity.shift?.label ?? 'No shift'}
              </Typography>
            </Stack>
          )}
        </Box>

        <Suspense
          fallback={
            <Container maxWidth={false} sx={{ py: SPACING.xl, px: SPACING.lg }}>
              <Stack sx={{ alignItems: 'center', py: SPACING.xxxl }} spacing={SPACING.md}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ color: tokens.muted }}>
                  Loading the entry form…
                </Typography>
              </Stack>
            </Container>
          }
        >
          <Routes>
            <Route
              path="/"
              element={<EntryFlow language={language} onLanguageChange={onLanguageChange} />}
            />
            <Route
              path="/entry"
              element={<EntryFlow language={language} onLanguageChange={onLanguageChange} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Container>
      {token !== null && (
        <ProfileDialog
          token={token}
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          highContrast={highContrast}
          onHighContrastChange={onHighContrastChange}
          language={language}
          onLanguageChange={onLanguageChange}
        />
      )}
    </>
  );
}
