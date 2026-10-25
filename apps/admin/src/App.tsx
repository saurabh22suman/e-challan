import { Suspense, lazy } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import {
  ActionButton,
  AppThemeProvider,
  PAGE_GUTTER,
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
 * Dashboard shell (F-04, B-09 professional redesign):
 * one quiet navy chrome, one public sign-in surface, and a dashboard that owns
 * its own navigation rail. The shell never repeats a generic page header inside
 * each destination.
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

function BrandMark() {
  return (
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
        letterSpacing: '0.08em',
        flexShrink: 0,
      }}
    >
      EC
    </Box>
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
        minHeight: '100dvh',
        backgroundColor: tokens.canvas,
        display: 'grid',
        placeItems: 'center',
        padding: { xs: PAGE_GUTTER.compact, md: PAGE_GUTTER.regular },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1120,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.05fr) minmax(380px, 0.95fr)' },
          border: `1px solid ${tokens.line}`,
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: tokens.surface,
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: SPACING.xxl,
            backgroundColor: tokens.navy,
            color: tokens.surface,
            padding: '48px',
            minHeight: 620,
          }}
        >
          <Stack spacing={SPACING.xl}>
            <Stack direction="row" spacing={SPACING.md} sx={{ alignItems: 'center' }}>
              <BrandMark />
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: tokens.onNavy.subtitle, letterSpacing: '0.14em' }}
                >
                  DMD SECURITY
                </Typography>
                <Typography sx={{ color: tokens.surface, fontWeight: 600, lineHeight: 1.2 }}>
                  e-Challan operations
                </Typography>
              </Box>
            </Stack>
            <Box>
              <Typography
                component="p"
                sx={{
                  margin: 0,
                  fontSize: 34,
                  lineHeight: 1.16,
                  fontWeight: 600,
                  letterSpacing: '-0.035em',
                  maxWidth: 430,
                }}
              >
                Gatehouse safety records, without the paperwork.
              </Typography>
              <Typography
                sx={{
                  color: tokens.onNavy.subtitle,
                  fontSize: 16,
                  lineHeight: 1.6,
                  marginTop: SPACING.lg,
                  maxWidth: 390,
                }}
              >
                Record a violation, capture evidence and keep the review trail in one place.
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={SPACING.lg}>
            {[
              ['01', 'Record at the gate', 'Identify the vehicle, driver and violation.'],
              ['02', 'Capture and sign', 'Photograph the scene and record the driver response.'],
              ['03', 'Review and close', 'Track the action taken and keep the history.'],
            ].map(([number, title, body]) => (
              <Box
                key={number}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr',
                  columnGap: SPACING.md,
                  paddingTop: SPACING.lg,
                  borderTop: `1px solid ${tokens.onNavy.hover}`,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: tokens.onNavy.muted, fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {number}
                </Typography>
                <Box>
                  <Typography sx={{ color: tokens.surface, fontWeight: 600 }}>{title}</Typography>
                  <Typography variant="body2" sx={{ color: tokens.onNavy.subtitle, marginTop: 2 }}>
                    {body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: { xs: SPACING.xl, sm: '40px', md: '48px' },
            backgroundColor: tokens.surface,
          }}
        >
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              gap: SPACING.md,
              mb: SPACING.xxl,
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 34,
                height: 34,
                display: 'grid',
                placeItems: 'center',
                backgroundColor: tokens.navy,
                borderRadius: '8px',
                color: tokens.surface,
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              EC
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: tokens.muted, letterSpacing: '0.12em' }}>
                DMD SECURITY
              </Typography>
              <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                e-Challan operations
              </Typography>
            </Box>
          </Box>
          <LoginScreen />
        </Box>
      </Box>
    </Box>
  );
}

function DashboardShell() {
  const { identity, signOut } = useSession();

  return (
    <>
      <AppBar position="sticky">
        <Toolbar sx={{ minHeight: 64, gap: SPACING.md }}>
          <Stack direction="row" spacing={SPACING.md} sx={{ alignItems: 'center', minWidth: 0 }}>
            <BrandMark />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{ color: tokens.onNavy.subtitle, letterSpacing: '0.12em', display: 'block' }}
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
                e-Challan operations
              </Typography>
            </Box>
          </Stack>
          <Stack
            direction="row"
            spacing={SPACING.md}
            sx={{ marginLeft: 'auto', alignItems: 'center', minWidth: 0 }}
          >
            {identity !== null && (
              <Stack
                sx={{ alignItems: 'flex-end', display: { xs: 'none', sm: 'flex' }, minWidth: 0 }}
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

      <Box
        component="main"
        sx={{
          width: '100%',
          maxWidth: 1440,
          margin: '0 auto',
          padding: { xs: PAGE_GUTTER.compact, md: PAGE_GUTTER.regular },
        }}
      >
        <PwaInstallPrompt />
        <Suspense fallback={<Typography variant="body1">Loading the dashboard…</Typography>}>
          <DashboardScreen />
        </Suspense>
      </Box>
    </>
  );
}
