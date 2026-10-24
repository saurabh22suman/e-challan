import { Suspense, lazy } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import {
  ActionButton,
  AppThemeProvider,
  PwaInstallPrompt,
  SPACING,
  ToastProvider,
  tokens,
} from '@echallan/theme';
import LoginScreen from './routes/LoginScreen';
import HandoffToTablet from './auth/HandoffToTablet';
import { SessionProvider, useSession } from './auth/session';

const DashboardScreen = lazy(() => import('./routes/DashboardScreen'));

/**
 * Dashboard shell (F-04, restyled under B-09): real sign-in, the role-routed
 * dashboard and shared theme chrome. The dashboard owns reporting, review,
 * evidence, user and master-data screens.
 */
export default function App() {
  return (
    <AppThemeProvider surface="admin">
      <ToastProvider>
        <BrowserRouter>
          <SessionProvider>
            <SessionGate />
          </SessionProvider>
        </BrowserRouter>
      </ToastProvider>
    </AppThemeProvider>
  );
}

function SessionGate() {
  const { status, identity } = useSession();

  if (status === 'authenticated') {
    // The dashboard is the single sign-in page. A Marshal does not stay here;
    // HandoffToTablet moves the authenticated session to the tablet origin.
    if (identity?.user.role === 'Marshal') return <HandoffToTablet />;
    return <DashboardShell />;
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

function DashboardShell() {
  const { identity, signOut } = useSession();

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h1" component="p" sx={{ margin: 0 }}>
            e-Challan dashboard
          </Typography>
          <Stack
            direction="row"
            spacing={SPACING.md}
            sx={{ marginLeft: 'auto', alignItems: 'center' }}
          >
            {identity !== null && (
              <Stack
                sx={{ alignItems: 'flex-end', display: { xs: 'none', sm: 'flex' } }}
                spacing={0}
              >
                <Typography variant="body2" sx={{ color: tokens.onNavy.strong }}>
                  {identity.user.username}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.onNavy.muted }}>
                  {identity.user.role}
                </Typography>
              </Stack>
            )}
            <ActionButton
              tone="secondary"
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

      <Container component="main" maxWidth="lg" sx={{ py: SPACING.xl }}>
        <PwaInstallPrompt />
        <Suspense fallback={<Typography variant="body1">Loading the dashboard…</Typography>}>
          <DashboardScreen />
        </Suspense>
      </Container>
    </>
  );
}
