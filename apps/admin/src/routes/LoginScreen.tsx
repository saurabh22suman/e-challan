import { useEffect, useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { IDLE_TIMEOUT_SECONDS } from '@echallan/contracts';
import { ActionButton, Notice, SPACING, TOUCH_TARGET_MIN, tokens } from '@echallan/theme';
import { GENERIC_SIGN_IN_FAILURE } from '../auth/api';
import { useSession } from '../auth/session';

/**
 * Single sign-in screen for every role (restyled under B-09).
 *
 * The API resolves the account from the username. Supervisor/Admin identities
 * continue to the dashboard; a Marshal is handed off to the tablet by the app
 * shell. Statically labelled fields and visible error feedback. The action is the
 * navy primary rather than the reserved green, because signing in does not commit
 * a challan.
 */
export default function LoginScreen() {
  const { signIn, notice } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('handoff') === 'failed'
      ? 'That sign-in link expired. Sign in again.'
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // The one-time handoff failure is a one-shot notice, not a permanent query
  // parameter on the sign-in page.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('handoff') !== 'failed') return;
    url.searchParams.delete('handoff');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (username.trim() === '' || password.trim() === '') {
      setError('Enter your username and password.');
      if (username.trim() === '') document.getElementById('username')?.focus();
      else document.getElementById('password')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await signIn(username, password);
      // The password leaves component state as soon as it is no longer needed and
      // is never stored anywhere.
      setPassword('');
    } catch (cause) {
      setPassword('');
      setError(
        cause instanceof Error && cause.message !== '' ? cause.message : GENERIC_SIGN_IN_FAILURE,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 420 }}>
      <Box sx={{ mb: SPACING.xxl }}>
        <Typography
          variant="overline"
          sx={{ color: tokens.muted, fontWeight: 600, letterSpacing: '0.12em' }}
        >
          Authorised access
        </Typography>
        <Typography component="h1" variant="h1" sx={{ color: tokens.ink, mt: SPACING.sm }}>
          Sign in
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.muted, mt: SPACING.sm }}>
          Use your assigned account. Marshals continue to the tablet; Supervisors and Admins
          continue to the dashboard.
        </Typography>
      </Box>
      <form noValidate onSubmit={(event) => void submit(event)}>
        <Stack spacing={SPACING.lg}>
          <Box>
            <InputLabel htmlFor="username">Username</InputLabel>
            <TextField
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              fullWidth
            />
          </Box>

          <Box>
            <InputLabel htmlFor="password">Password</InputLabel>
            <TextField
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((previous) => !previous)}
                        edge="end"
                        sx={{
                          minWidth: TOUCH_TARGET_MIN.desktopAction,
                          minHeight: TOUCH_TARGET_MIN.desktopAction,
                        }}
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          {(error ?? notice) !== null && (
            <Notice tone="danger" role="alert">
              {error ?? notice}
            </Notice>
          )}

          <ActionButton type="submit" tone="primary" disabled={submitting} fullWidth>
            {submitting ? 'Signing in…' : 'Sign in'}
          </ActionButton>

          <Typography variant="caption" sx={{ color: tokens.muted, lineHeight: 1.55 }}>
            Marshal sessions end after {IDLE_TIMEOUT_SECONDS.Marshal / 60} minutes without activity;
            Supervisor and Admin sessions end after {IDLE_TIMEOUT_SECONDS.Supervisor / 60} minutes.
          </Typography>
        </Stack>
      </form>
    </Box>
  );
}
