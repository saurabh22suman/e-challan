import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ProfileResponse } from '@echallan/contracts';
import { ActionButton, DetailGrid, DetailItem, Notice, SPACING, tokens } from '@echallan/theme';
import { DRIVER_LANGUAGES, type DriverLanguage } from '../features/issuance/driverCopy';
import { fetchProfile, ProfileApiError } from './api';

/**
 * Marshal self-service profile dialog. Fetched only when opened, so the entry
 * screen's initial bundle/network path is unchanged. No password material is
 * representable in the profile contract.
 */

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export default function ProfileDialog({
  token,
  open,
  onClose,
  highContrast,
  onHighContrastChange,
  language,
  onLanguageChange,
}: {
  token: string;
  open: boolean;
  onClose: () => void;
  highContrast: boolean;
  onHighContrastChange: (value: boolean) => void;
  language: DriverLanguage;
  onLanguageChange: (value: DriverLanguage) => void;
}) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProfile(token)
      .then((resolved) => {
        if (!cancelled) setProfile(resolved);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(
          failure instanceof ProfileApiError
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
  }, [open, token]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="profile-title">
      <DialogTitle id="profile-title" component="h2">
        Profile
      </DialogTitle>
      <DialogContent dividers>
        {loading && <CircularProgress aria-label="Loading profile" />}
        {error !== null && (
          <Notice severity="error" role="status">
            {error}
          </Notice>
        )}
        {profile !== null && (
          <Stack spacing={SPACING.lg}>
            <DetailGrid columns={2}>
              <DetailItem label="Display name" value={profile.user.displayName} />
              <DetailItem label="Username" value={profile.user.username} mono />
              <DetailItem
                label="Employee ID"
                value={profile.user.employeeId ?? 'Not recorded'}
                mono
              />
              <DetailItem label="Role" value={profile.user.role} />
              <DetailItem
                label="Account status"
                value={profile.user.isActive ? 'Active' : 'Inactive'}
              />
            </DetailGrid>
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
            <Box
              sx={{
                border: `1px solid ${tokens.line}`,
                borderRadius: '10px',
                padding: `${SPACING.xs} ${SPACING.md}`,
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={highContrast}
                    onChange={(event) => onHighContrastChange(event.target.checked)}
                  />
                }
                label="High-contrast outdoor mode"
              />
            </Box>
            <div>
              <InputLabel htmlFor="driver-language">Driver copy language</InputLabel>
              <Select
                id="driver-language"
                value={language}
                onChange={(event) => onLanguageChange(event.target.value as DriverLanguage)}
                fullWidth
              >
                {DRIVER_LANGUAGES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </div>
            <Divider />
            <Stack spacing={SPACING.sm}>
              <Typography component="h3" variant="h3">
                Current session
              </Typography>
              <DetailGrid columns={3}>
                <DetailItem label="Post" value={profile.session.post?.label ?? 'No active post'} />
                <DetailItem
                  label="Shift"
                  value={profile.session.shift?.label ?? 'No active shift'}
                />
                <DetailItem label="Session ends" value={formatInstant(profile.session.expiresAt)} />
              </DetailGrid>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <ActionButton tone="ghost" onClick={onClose}>
          Close
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}
