import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ProfileResponse } from '@echallan/contracts';
import { DetailGrid, DetailItem, Notice, PageHeader, SPACING, StatusBadge } from '@echallan/theme';
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
    <Stack spacing={SPACING.xl}>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        titleComponent="h2"
        description="Your account, assigned locations and current session."
      />
      <Card>
        <CardContent>
          {loading && <CircularProgress aria-label="Loading profile" />}
          {error !== null && (
            <Notice severity="error" role="status">
              {error}
            </Notice>
          )}
          {profile !== null && (
            <Stack spacing={SPACING.xl}>
              <DetailGrid columns={3}>
                <DetailItem label="Username" value={profile.user.username} mono />
                <DetailItem label="Display name" value={profile.user.displayName} />
                <DetailItem
                  label="Employee ID"
                  value={profile.user.employeeId ?? 'Not recorded'}
                  mono
                />
                <DetailItem label="Role" value={profile.user.role} />
                <DetailItem
                  label="Account status"
                  value={<StatusBadge status={profile.user.isActive ? 'active' : 'deactivated'} />}
                />
              </DetailGrid>

              <Divider />

              <Box>
                <Typography component="h3" variant="h3" sx={{ marginBottom: SPACING.md }}>
                  Assigned locations
                </Typography>
                <Typography variant="body1">
                  {profile.user.locationLabels.length === 0
                    ? 'No locations assigned.'
                    : profile.user.locationLabels.join(', ')}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography component="h3" variant="h3" sx={{ marginBottom: SPACING.md }}>
                  Current session
                </Typography>
                <DetailGrid columns={3}>
                  <DetailItem
                    label="Post"
                    value={profile.session.post?.label ?? 'No active post'}
                  />
                  <DetailItem
                    label="Shift"
                    value={profile.session.shift?.label ?? 'No active shift'}
                  />
                  <DetailItem
                    label="Session ends"
                    value={formatInstant(profile.session.expiresAt)}
                  />
                </DetailGrid>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
