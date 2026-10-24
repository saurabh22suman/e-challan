import { useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ProfileResponse } from '@echallan/contracts';
import { Notice, SPACING, StatusBadge, tokens } from '@echallan/theme';
import { getProfile, OperationsApiError } from '../../api/operations';

/**
 * Self-service profile. Read-only by design: the dashboard shows the caller's own
 * stored login and assignment details plus the current session context. Password
 * material is not representable in the shared profile contract.
 */

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" sx={{ color: tokens.muted }}>
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Stack>
  );
}

export default function ProfilePanel({ token }: { token: string }) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProfile(token)
      .then((resolved) => {
        if (!cancelled) setProfile(resolved);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(
          failure instanceof OperationsApiError
            ? failure.message
            : 'Your profile could not be loaded.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <Card>
      <CardHeader
        title={
          <Typography component="h2" variant="h2">
            Profile
          </Typography>
        }
        subheader="Your login and assignment details."
      />
      <CardContent>
        {loading && <CircularProgress aria-label="Loading profile" />}
        {error !== null && (
          <Notice severity="error" role="status">
            {error}
          </Notice>
        )}
        {profile !== null && (
          <Stack spacing={SPACING.lg}>
            <Stack
              direction="row"
              spacing={SPACING.xl}
              sx={{ flexWrap: 'wrap', rowGap: SPACING.md }}
            >
              <Field label="Username" value={profile.user.username} />
              <Field label="Display name" value={profile.user.displayName} />
              <Field label="Employee ID" value={profile.user.employeeId ?? 'Not recorded'} />
              <Field label="Role" value={profile.user.role} />
              <Stack spacing={0.25}>
                <Typography variant="caption" sx={{ color: tokens.muted }}>
                  Account status
                </Typography>
                <StatusBadge status={profile.user.isActive ? 'active' : 'deactivated'} />
              </Stack>
            </Stack>

            <Stack spacing={SPACING.sm}>
              <Typography component="h3" variant="h3">
                Assigned locations
              </Typography>
              <Typography variant="body1">
                {profile.user.locationLabels.length === 0
                  ? 'No locations assigned.'
                  : profile.user.locationLabels.join(', ')}
              </Typography>
            </Stack>

            <Divider />

            <Stack spacing={SPACING.sm}>
              <Typography component="h3" variant="h3">
                Current session
              </Typography>
              <Stack
                direction="row"
                spacing={SPACING.xl}
                sx={{ flexWrap: 'wrap', rowGap: SPACING.md }}
              >
                <Field label="Post" value={profile.session.post?.label ?? 'Not bound'} />
                <Field label="Shift" value={profile.session.shift?.label ?? 'Not bound'} />
                <Field label="Session ends" value={formatInstant(profile.session.expiresAt)} />
              </Stack>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
