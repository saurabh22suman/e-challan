import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
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
import { Notice, SPACING, tokens } from '@echallan/theme';
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
            <Stack
              direction="row"
              spacing={SPACING.xl}
              sx={{ flexWrap: 'wrap', rowGap: SPACING.md }}
            >
              <Field label="Display name" value={profile.user.displayName} />
              <Field label="Username" value={profile.user.username} />
              <Field label="Employee ID" value={profile.user.employeeId ?? 'Not recorded'} />
              <Field label="Role" value={profile.user.role} />
              <Field label="Account status" value={profile.user.isActive ? 'Active' : 'Inactive'} />
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
            <FormControlLabel
              control={
                <Switch
                  checked={highContrast}
                  onChange={(event) => onHighContrastChange(event.target.checked)}
                />
              }
              label="High-contrast outdoor mode"
            />
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
