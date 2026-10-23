import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { AdminUser, Role } from '@echallan/contracts';
import { ErrorSummary, Notice, SPACING } from '@echallan/theme';
import { createUser, type LocationOption, OperationsApiError } from '../../api/operations';

const MIN_PASSWORD_LENGTH = 12;
const ROLES: Role[] = ['Marshal', 'Supervisor', 'Admin'];

interface CreateUserDialogProps {
  token: string;
  locations: LocationOption[];
  locationsError: string | null;
  onClose: () => void;
  onCreated: (user: AdminUser) => void;
}

interface FieldErrors {
  username?: string;
  displayName?: string;
  employeeId?: string;
  role?: string;
  locationIds?: string;
  password?: string;
  confirmation?: string;
}

export default function CreateUserDialog({
  token,
  locations,
  locationsError,
  onClose,
  onCreated,
}: CreateUserDialogProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorNonce, setErrorNonce] = useState(0);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const trimmedUsername = username.trim();
    if (!/^[A-Za-z0-9._-]{3,64}$/u.test(trimmedUsername)) {
      next.username = 'Enter a username of 3–64 letters, digits, dots, underscores or hyphens.';
    }
    if (displayName.trim() === '') next.displayName = 'Enter a display name.';
    else if (displayName.trim().length > 120) next.displayName = 'Use at most 120 characters.';
    if (employeeId.trim() !== '' && employeeId.trim().length > 64) {
      next.employeeId = 'Use at most 64 characters.';
    }
    if (role === '') next.role = 'Choose a role.';
    if (role !== 'Admin' && locationIds.length === 0) {
      next.locationIds = 'Choose at least one location.';
    }
    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (confirmation !== password) next.confirmation = 'The passwords do not match.';
    return next;
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || role === '') {
      if (Object.keys(nextErrors).length > 0) setErrorNonce((previous) => previous + 1);
      return;
    }

    setFailure(null);
    setSubmitting(true);
    createUser(token, {
      username: username.trim(),
      displayName: displayName.trim(),
      ...(employeeId.trim() === '' ? {} : { employeeId: employeeId.trim() }),
      role,
      locationIds,
      password,
    })
      .then((created) => onCreated(created))
      .catch((error: unknown) => {
        setFailure(
          error instanceof OperationsApiError ? error.message : 'The user could not be created.',
        );
      })
      .finally(() => setSubmitting(false));
  }

  useEffect(() => {
    if (errorNonce === 0) return;
    document.querySelector<HTMLElement>('[data-testid="error-summary"]')?.focus();
  }, [errorNonce]);

  function focusField(id: string): void {
    const element = document.getElementById(id);
    if (element instanceof HTMLElement) {
      element.focus();
      element.scrollIntoView?.({ block: 'center' });
    }
  }

  const errorItems = (
    [
      ['username', 'create-user-username', 'Username'],
      ['displayName', 'create-user-display-name', 'Display name'],
      ['employeeId', 'create-user-employee-id', 'Employee ID'],
      ['role', 'create-user-role', 'Role'],
      ['locationIds', 'create-user-locations', 'Locations'],
      ['password', 'create-user-password', 'Initial password'],
      ['confirmation', 'create-user-confirmation', 'Confirm initial password'],
    ] as const
  )
    .filter(([key]) => errors[key] !== undefined)
    .map(([, id, label]) => ({ id, message: label }));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="create-user-title">
      <DialogTitle id="create-user-title" component="h2">
        Create user
      </DialogTitle>
      <DialogContent dividers>
        <Stack
          id="create-user-form"
          component="form"
          spacing={SPACING.lg}
          onSubmit={submit}
          noValidate
        >
          {failure !== null && (
            <Notice severity="error" role="alert">
              {failure}
            </Notice>
          )}
          {locationsError !== null && (
            <Notice severity="warning" role="status">
              {locationsError} You can still create an Admin without a location.
            </Notice>
          )}
          <ErrorSummary
            key={errorNonce}
            items={errorItems}
            onNavigate={(item) => focusField(item.id)}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: SPACING.md,
            }}
          >
            <TextField
              id="create-user-username"
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              error={errors.username !== undefined}
              helperText={errors.username ?? 'The sign-in identifier, e.g. EMP-012.'}
              fullWidth
              required
            />
            <TextField
              id="create-user-display-name"
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              error={errors.displayName !== undefined}
              helperText={errors.displayName}
              fullWidth
              required
            />
            <TextField
              id="create-user-employee-id"
              label="Employee ID (optional)"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              error={errors.employeeId !== undefined}
              helperText={errors.employeeId}
              fullWidth
            />
            <FormControl fullWidth error={errors.role !== undefined}>
              <InputLabel id="create-role-label">Role</InputLabel>
              <Select
                id="create-user-role"
                labelId="create-role-label"
                label="Role"
                displayEmpty
                value={role}
                onChange={(event) => setRole(event.target.value as Role | '')}
              >
                <MenuItem value="">Choose a role</MenuItem>
                {ROLES.map((candidate) => (
                  <MenuItem key={candidate} value={candidate}>
                    {candidate}
                  </MenuItem>
                ))}
              </Select>
              {errors.role !== undefined && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.role}
                </Typography>
              )}
            </FormControl>

            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              <FormControl fullWidth error={errors.locationIds !== undefined}>
                <InputLabel id="create-locations-label">Locations</InputLabel>
                <Select
                  id="create-user-locations"
                  labelId="create-locations-label"
                  label="Locations"
                  multiple
                  value={locationIds}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLocationIds(typeof value === 'string' ? value.split(',') : value);
                  }}
                  displayEmpty
                  renderValue={(selected) =>
                    selected.length === 0
                      ? 'Choose locations'
                      : selected
                          .map(
                            (id) => locations.find((location) => location.id === id)?.label ?? id,
                          )
                          .join(', ')
                  }
                >
                  {locations.map((location) => (
                    <MenuItem key={location.id} value={location.id}>
                      {location.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.locationIds !== undefined && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.locationIds}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ mt: 0.5 }}>
                  Marshals and Supervisors need at least one location. Admins read across locations.
                </Typography>
              </FormControl>
            </Box>

            <TextField
              id="create-user-password"
              label="Initial password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password !== undefined}
              helperText={errors.password ?? `At least ${MIN_PASSWORD_LENGTH} characters.`}
              fullWidth
              required
            />
            <TextField
              id="create-user-confirmation"
              label="Confirm initial password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              error={errors.confirmation !== undefined}
              helperText={errors.confirmation}
              fullWidth
              required
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button form="create-user-form" type="submit" variant="contained" disabled={submitting}>
          Create user
        </Button>
      </DialogActions>
    </Dialog>
  );
}
