import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { AppThemeProvider, SPACING, TOUCH_TARGET_MIN, tokens } from '@echallan/theme';
import LoginScreen from './routes/LoginScreen';
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
      <BrowserRouter>
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
  const { status } = useSession();

  if (status === 'authenticated')
    return (
      <TabletShell
        highContrast={highContrast}
        onHighContrastChange={onHighContrastChange}
        language={language}
        onLanguageChange={onLanguageChange}
      />
    );
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
      <AppBar position="static">
        <Toolbar sx={{ flexWrap: 'wrap', rowGap: SPACING.sm, py: SPACING.sm }}>
          <Typography variant="h1" component="h1" sx={{ whiteSpace: 'normal' }}>
            Create new safety violation
          </Typography>
          <Stack
            direction="row"
            spacing={SPACING.md}
            sx={{
              marginLeft: 'auto',
              alignItems: 'center',
              flexWrap: 'wrap',
              rowGap: SPACING.sm,
            }}
          >
            {identity !== null && (
              <Stack
                sx={{ alignItems: 'flex-end', display: { xs: 'none', sm: 'flex' } }}
                spacing={0}
              >
                <Typography variant="body2" sx={{ color: tokens.onNavy.strong }}>
                  {identity.post?.label ?? identity.user.username}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.onNavy.muted }}>
                  {identity.user.username} · {identity.user.role}
                </Typography>
              </Stack>
            )}
            <Button
              color="inherit"
              variant="outlined"
              onClick={() => setProfileOpen(true)}
              disabled={token === null}
              sx={{
                minHeight: TOUCH_TARGET_MIN.tabletSecondaryAction,
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
            </Button>
            <Button
              color="inherit"
              variant="outlined"
              onClick={() => void signOut()}
              sx={{
                minHeight: TOUCH_TARGET_MIN.tabletSecondaryAction,
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
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <SyncStatusBar />

      <Container component="main" maxWidth={false} sx={{ py: 0, px: 0 }}>
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
