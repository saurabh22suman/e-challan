import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
import { AmbiguousContextError, GENERIC_SIGN_IN_FAILURE, type ContextOption } from '../auth/api';
import { useSession } from '../auth/session';

/**
 * Component-test seam only.
 *
 * The tablet never renders this screen in development or production: the app
 * redirects anonymous visitors to the single dashboard sign-in page. The form is
 * retained here so the tablet's session and form tests can exercise the original
 * layout without a cross-origin navigation.
 *
 * Full-screen field sign-in: a single branded card, statically labelled fields,
 * tablet-sized touch targets and visible error feedback. The action is the navy
 * primary, **not** the reserved green, because signing in does not commit a
 * challan.
 *
 * When the API refuses an omitted context as `ambiguous_context`, the screen
 * renders labelled native `Post`/`Shift` selects containing **exactly** the stored
 * candidates the API returned, plus an empty placeholder. Nothing is pre-selected
 * or invented, the entered credentials are preserved, and the retry submits the
 * chosen ids.
 */
/** Outlined field treatment matching the theme's text inputs. */
const CONTEXT_SELECT_STYLE: CSSProperties = {
  minHeight: TOUCH_TARGET_MIN.tabletInput,
  width: '100%',
  padding: '0 12px',
  border: `1px solid ${tokens.fieldLine}`,
  borderRadius: 10,
  backgroundColor: tokens.surface,
  color: tokens.ink,
  fontSize: 17,
  fontFamily: 'inherit',
};

export default function LoginScreen() {
  const { signIn, notice } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [postId, setPostId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [postOptions, setPostOptions] = useState<ContextOption[]>([]);
  const [shiftOptions, setShiftOptions] = useState<ContextOption[]>([]);
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
      await signIn(username, password, {
        ...(postId === '' ? {} : { postId }),
        ...(shiftId === '' ? {} : { shiftId }),
      });
      // The password is dropped the moment it is no longer needed and is never stored.
      setPassword('');
    } catch (cause) {
      if (cause instanceof AmbiguousContextError) {
        // Ambiguity is not a credential failure: keep what the operator typed and
        // offer exactly the stored candidates. A selection the new step no longer
        // offers is cleared rather than silently kept.
        setPostOptions(cause.postOptions);
        setShiftOptions(cause.shiftOptions);
        if (!cause.postOptions.some((option) => option.id === postId)) setPostId('');
        if (!cause.shiftOptions.some((option) => option.id === shiftId)) setShiftId('');
        setError(cause.message);
      } else {
        setPassword('');
        setError(
          cause instanceof Error && cause.message !== '' ? cause.message : GENERIC_SIGN_IN_FAILURE,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const feedback = error ?? notice;

  return (
    <Card sx={{ width: '100%', maxWidth: 520 }}>
      <Box
        sx={{
          backgroundColor: tokens.navy,
          borderBottom: `3px solid ${tokens.blue}`,
          padding: `${SPACING.xl} ${SPACING.xl} ${SPACING.lg}`,
        }}
      >
        <Typography
          variant="overline"
          sx={{ color: tokens.onNavy.strong, fontWeight: 700, letterSpacing: '0.12em' }}
        >
          E-Challan · Marshal Tablet
        </Typography>
        <Typography component="h1" variant="h1" sx={{ color: tokens.surface }}>
          Tablet sign-in
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.onNavy.subtitle, mt: SPACING.xs }}>
          Marshal access. A Supervisor or Admin can sign in here and will be taken to the dashboard.
        </Typography>
      </Box>
      <CardContent sx={{ padding: SPACING.xl }}>
        <form noValidate onSubmit={(event) => void submit(event)}>
          <Stack spacing={SPACING.lg}>
            <TextField
              id="username"
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              fullWidth
              margin="dense"
            />

            <TextField
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              fullWidth
              margin="dense"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((previous) => !previous)}
                        edge="end"
                        sx={{
                          minWidth: TOUCH_TARGET_MIN.tabletIconButton,
                          minHeight: TOUCH_TARGET_MIN.tabletIconButton,
                        }}
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {postOptions.length > 0 && (
              <div>
                <InputLabel htmlFor="login-post">Post</InputLabel>
                <select
                  id="login-post"
                  value={postId}
                  onChange={(event) => setPostId(event.target.value)}
                  style={CONTEXT_SELECT_STYLE}
                >
                  <option value="" />
                  {postOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {shiftOptions.length > 0 && (
              <div>
                <InputLabel htmlFor="login-shift">Shift</InputLabel>
                <select
                  id="login-shift"
                  value={shiftId}
                  onChange={(event) => setShiftId(event.target.value)}
                  style={CONTEXT_SELECT_STYLE}
                >
                  <option value="" />
                  {shiftOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {feedback !== null && (
              <Notice tone="danger" role="alert">
                {feedback}
              </Notice>
            )}

            <ActionButton type="submit" tone="primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </ActionButton>

            <Typography variant="caption" color="text.secondary">
              Marshal sessions end after {IDLE_TIMEOUT_SECONDS.Marshal / 60} minutes without
              activity and unsent entries are discarded. Other roles continue to the dashboard.
            </Typography>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
