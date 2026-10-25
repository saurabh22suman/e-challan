import { useEffect, useMemo, useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import useMediaQuery from '@mui/material/useMediaQuery';
import Typography from '@mui/material/Typography';
import type { AdminUser } from '@echallan/contracts';
import {
  ActionButton,
  EmptyState,
  ErrorSummary,
  LIST_CARD_BREAKPOINT,
  Notice,
  PageHeader,
  RADIUS,
  RecordCard,
  SPACING,
  StatusBadge,
  ToneDialogTitle,
  tokens,
  useToast,
} from '@echallan/theme';
import {
  deactivateUser,
  listLocations,
  listUsers,
  OperationsApiError,
  reactivateUser,
  resetUserPassword,
  type LocationOption,
} from '../../api/operations';
import CreateUserDialog from './CreateUserDialog';

/**
 * Admin-only user management: create, deactivate ("remove"), reactivate and
 * reset. Deactivation is the approved removal model (PRD E5.3); no hard delete
 * is offered. The signed-in Admin cannot deactivate their own account.
 */

const MIN_PASSWORD_LENGTH = 12;

interface ResetPasswordDialogProps {
  token: string;
  target: AdminUser;
  currentUserId: string;
  onClose: () => void;
  onSuccess: (target: AdminUser) => void;
  onSelfReset: () => void;
}

function ResetPasswordDialog({
  token,
  target,
  currentUserId,
  onClose,
  onSuccess,
  onSelfReset,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorNonce, setErrorNonce] = useState(0);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (confirmation !== password) {
      nextErrors.confirmation = 'The passwords do not match.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setErrorNonce((previous) => previous + 1);
      return;
    }
    setFailure(null);
    setSubmitting(true);
    resetUserPassword(token, target.id, password)
      .then(() => {
        onSuccess(target);
        if (target.id === currentUserId) onSelfReset();
      })
      .catch((error: unknown) => {
        setFailure(
          error instanceof OperationsApiError ? error.message : 'The password could not be reset.',
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

  const errorItems = [
    ...(errors.password === undefined
      ? []
      : [{ id: 'reset-password-new', message: 'New password' }]),
    ...(errors.confirmation === undefined
      ? []
      : [{ id: 'reset-password-confirmation', message: 'Confirm new password' }]),
  ];

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="reset-password-title">
      <ToneDialogTitle id="reset-password-title" component="h2">
        Reset password
      </ToneDialogTitle>
      <DialogContent dividers>
        <Stack
          id="reset-password-form"
          component="form"
          spacing={SPACING.lg}
          onSubmit={submit}
          noValidate
        >
          <Typography variant="body1">
            Set a new password for {target.displayName} ({target.username}). Their live sessions
            will be revoked.
          </Typography>
          {failure !== null && (
            <Notice severity="error" role="alert">
              {failure}
            </Notice>
          )}
          <ErrorSummary
            key={errorNonce}
            items={errorItems}
            onNavigate={(item) => focusField(item.id)}
          />
          <TextField
            id="reset-password-new"
            label="New password"
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
            id="reset-password-confirmation"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            error={errors.confirmation !== undefined}
            helperText={errors.confirmation}
            fullWidth
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <ActionButton tone="ghost" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton form="reset-password-form" type="submit" tone="primary" disabled={submitting}>
          Reset password
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}

interface DeactivateDialogProps {
  target: AdminUser;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  failure: string | null;
}

function DeactivateDialog({
  target,
  onClose,
  onConfirm,
  submitting,
  failure,
}: DeactivateDialogProps) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="deactivate-user-title">
      <ToneDialogTitle id="deactivate-user-title" component="h2" tone="danger">
        Deactivate user
      </ToneDialogTitle>
      <DialogContent dividers>
        <Stack spacing={SPACING.md}>
          <Typography variant="body1">
            Deactivate {target.displayName} ({target.username})? The account is retained, but the
            user cannot sign in and all live sessions end. History is not deleted.
          </Typography>
          {failure !== null && (
            <Notice severity="error" role="alert">
              {failure}
            </Notice>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <ActionButton tone="ghost" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton tone="danger-solid" onClick={onConfirm} disabled={submitting}>
          Deactivate user
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}

interface UserAdminPanelProps {
  token: string;
  currentUserId: string;
  onSelfReset: () => void;
}

export default function UserAdminPanel({ token, currentUserId, onSelfReset }: UserAdminPanelProps) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFailure, setActionFailure] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateFailure, setDeactivateFailure] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminUser['role']>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{
    verb: 'deactivate' | 'reactivate';
    ids: string[];
  } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFailure, setBulkFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listUsers(token)
      .then((resolved) => {
        if (!cancelled) setUsers(resolved);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(
          failure instanceof OperationsApiError
            ? failure.message
            : 'The user list could not be loaded.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLocationsError(null);
    listLocations(token)
      .then((resolved) => {
        if (!cancelled) setLocations(resolved);
      })
      .catch(() => {
        if (!cancelled) setLocationsError('The location catalogue could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function refresh(title: string, description: string): void {
    showToast({ tone: 'success', title, description });
    setActionFailure(null);
    setReloadKey((value) => value + 1);
  }

  function reactivate(user: AdminUser): void {
    setActionFailure(null);
    reactivateUser(token, user.id)
      .then(() =>
        refresh('User reactivated', `${user.displayName} (${user.username}) can sign in again.`),
      )
      .catch((failure: unknown) => {
        setActionFailure(
          failure instanceof OperationsApiError
            ? failure.message
            : 'The user could not be reactivated.',
        );
      });
  }

  function confirmDeactivate(): void {
    if (deactivateTarget === null) return;
    setDeactivating(true);
    setDeactivateFailure(null);
    deactivateUser(token, deactivateTarget.id)
      .then(() => {
        const target = deactivateTarget;
        setDeactivateTarget(null);
        refresh(
          'User deactivated',
          `${target.displayName} (${target.username}) can no longer sign in. Account retained.`,
        );
      })
      .catch((failure: unknown) => {
        setDeactivateFailure(
          failure instanceof OperationsApiError
            ? failure.message
            : 'The user could not be deactivated.',
        );
      })
      .finally(() => setDeactivating(false));
  }

  const compactQuery = `(max-width:${LIST_CARD_BREAKPOINT}px)`;
  const compact = useMediaQuery(compactQuery, {
    defaultMatches: typeof window !== 'undefined' && window.matchMedia(compactQuery).matches,
  });
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (activeFilter === 'active' && !user.isActive) return false;
      if (activeFilter === 'inactive' && user.isActive) return false;
      if (term === '') return true;
      return (
        user.username.toLowerCase().includes(term) ||
        user.displayName.toLowerCase().includes(term) ||
        user.locationLabels.some((label) => label.toLowerCase().includes(term))
      );
    });
  }, [activeFilter, roleFilter, search, users]);

  const selectableUsers = filteredUsers.filter((user) => user.id !== currentUserId);
  const selectedUsers = users.filter(
    (user) => user.id !== currentUserId && selectedIds.has(user.id),
  );
  const selectedActive = selectedUsers.filter((user) => user.isActive);
  const selectedInactive = selectedUsers.filter((user) => !user.isActive);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, roleFilter, activeFilter, reloadKey]);

  async function runBulkAction(): Promise<void> {
    if (bulkAction === null) return;
    setBulkBusy(true);
    setBulkFailure(null);
    try {
      for (const id of bulkAction.ids) {
        if (bulkAction.verb === 'deactivate') await deactivateUser(token, id);
        else await reactivateUser(token, id);
      }
      setBulkAction(null);
      setSelectedIds(new Set());
      refresh(
        bulkAction.verb === 'deactivate' ? 'Users deactivated' : 'Users reactivated',
        `${bulkAction.ids.length} selected account(s) updated.`,
      );
    } catch (failure) {
      setBulkFailure(
        failure instanceof OperationsApiError
          ? failure.message
          : 'The bulk action could not be completed.',
      );
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleSelected(id: string): void {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderActions(user: AdminUser) {
    const self = user.id === currentUserId;
    return (
      <Stack direction="row" spacing={SPACING.sm} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <ActionButton
          tone="secondary"
          size="sm"
          sx={{ whiteSpace: 'nowrap' }}
          aria-label={`Reset password for ${user.username}`}
          onClick={() => {
            setResetTarget(user);
          }}
        >
          Reset password
        </ActionButton>
        {user.isActive ? (
          <ActionButton
            size="sm"
            tone="danger"
            sx={{ whiteSpace: 'nowrap' }}
            aria-label={`Deactivate ${user.username}`}
            disabled={self}
            onClick={() => {
              setDeactivateFailure(null);
              setDeactivateTarget(user);
            }}
          >
            Deactivate
          </ActionButton>
        ) : (
          <ActionButton
            tone="secondary"
            size="sm"
            sx={{ whiteSpace: 'nowrap' }}
            aria-label={`Reactivate ${user.username}`}
            onClick={() => reactivate(user)}
          >
            Reactivate
          </ActionButton>
        )}
        {self && (
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            You cannot deactivate your own account.
          </Typography>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={SPACING.xl}>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        titleComponent="h2"
        description="Manage who can sign in. Removal is deactivation; accounts and history are retained."
        actions={
          <ActionButton tone="primary" onClick={() => setCreating(true)}>
            Create user
          </ActionButton>
        }
      />
      <Card>
        <CardContent>
          <Stack spacing={SPACING.lg}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={SPACING.md}
              sx={{ alignItems: { md: 'flex-end' }, flexWrap: 'wrap' }}
            >
              <TextField
                label="Search users"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ flex: { xs: '1 1 auto', md: '1 1 280px' }, minWidth: 0 }}
              />
              <TextField
                select
                label="Role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as 'all' | AdminUser['role'])}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">All roles</MenuItem>
                <MenuItem value="Marshal">Marshal</MenuItem>
                <MenuItem value="Supervisor">Supervisor</MenuItem>
                <MenuItem value="Admin">Admin</MenuItem>
              </TextField>
              <TextField
                select
                label="Account status"
                value={activeFilter}
                onChange={(event) =>
                  setActiveFilter(event.target.value as 'all' | 'active' | 'inactive')
                }
                sx={{ minWidth: 170 }}
              >
                <MenuItem value="all">All accounts</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Deactivated</MenuItem>
              </TextField>
            </Stack>

            {selectedUsers.length > 0 && (
              <Stack direction="row" spacing={SPACING.md} sx={{ flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: tokens.muted, alignSelf: 'center' }}>
                  {selectedUsers.length} selected
                </Typography>
                <ActionButton
                  size="sm"
                  tone="danger"
                  disabled={selectedActive.length === 0}
                  onClick={() => {
                    setBulkFailure(null);
                    setBulkAction({
                      verb: 'deactivate',
                      ids: selectedActive.map((user) => user.id),
                    });
                  }}
                >
                  Deactivate selected
                </ActionButton>
                <ActionButton
                  tone="secondary"
                  size="sm"
                  disabled={selectedInactive.length === 0}
                  onClick={() => {
                    setBulkFailure(null);
                    setBulkAction({
                      verb: 'reactivate',
                      ids: selectedInactive.map((user) => user.id),
                    });
                  }}
                >
                  Reactivate selected
                </ActionButton>
              </Stack>
            )}

            {error !== null && (
              <Notice severity="error" role="status">
                {error}
              </Notice>
            )}
            {actionFailure !== null && (
              <Notice severity="error" role="alert">
                {actionFailure}
              </Notice>
            )}

            {loading ? (
              <CircularProgress aria-label="Loading users" />
            ) : filteredUsers.length === 0 && error === null ? (
              <EmptyState
                title={users.length === 0 ? 'No users recorded' : 'No users match these filters'}
                description={
                  users.length === 0
                    ? 'Create the first account to let a supervisor or marshal sign in.'
                    : 'Try a broader search or clear the role and status filters.'
                }
                action={
                  <ActionButton tone="primary" onClick={() => setCreating(true)}>
                    Create user
                  </ActionButton>
                }
              />
            ) : compact ? (
              <Stack spacing={SPACING.md}>
                {filteredUsers.map((user) => (
                  <RecordCard
                    key={user.id}
                    title={
                      <Stack direction="row" spacing={SPACING.sm} sx={{ alignItems: 'center' }}>
                        {user.id !== currentUserId && (
                          <Checkbox
                            slotProps={{ input: { 'aria-label': `Select ${user.username}` } }}
                            checked={selectedIds.has(user.id)}
                            onChange={() => toggleSelected(user.id)}
                          />
                        )}
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                          {user.username}
                        </span>
                      </Stack>
                    }
                    subtitle={user.displayName}
                    badge={<StatusBadge status={user.isActive ? 'active' : 'deactivated'} />}
                    fields={[
                      { label: 'Role', value: user.role },
                      {
                        label: 'Locations',
                        value:
                          user.locationLabels.length === 0
                            ? 'No locations'
                            : user.locationLabels.join(', '),
                      },
                    ]}
                    actions={renderActions(user)}
                  />
                ))}
              </Stack>
            ) : (
              <TableContainer
                sx={{
                  overflowX: 'auto',
                  border: `1px solid ${tokens.lineSoft}`,
                  borderRadius: RADIUS.control,
                }}
              >
                <Table aria-label="Users">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          slotProps={{ input: { 'aria-label': 'Select all visible users' } }}
                          checked={
                            selectableUsers.length > 0 &&
                            selectableUsers.every((user) => selectedIds.has(user.id))
                          }
                          indeterminate={
                            selectableUsers.some((user) => selectedIds.has(user.id)) &&
                            !selectableUsers.every((user) => selectedIds.has(user.id))
                          }
                          onChange={(event) => {
                            setSelectedIds(
                              event.target.checked
                                ? new Set(selectableUsers.map((user) => user.id))
                                : new Set(),
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>Username</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Active</TableCell>
                      <TableCell>Locations</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} hover>
                        <TableCell padding="checkbox">
                          {user.id !== currentUserId && (
                            <Checkbox
                              slotProps={{ input: { 'aria-label': `Select ${user.username}` } }}
                              checked={selectedIds.has(user.id)}
                              onChange={() => toggleSelected(user.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{user.username}</TableCell>
                        <TableCell>{user.displayName}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>
                          <StatusBadge status={user.isActive ? 'active' : 'deactivated'} />
                        </TableCell>
                        <TableCell sx={{ color: tokens.muted }}>
                          {user.locationLabels.length === 0
                            ? 'None'
                            : user.locationLabels.join(', ')}
                        </TableCell>
                        <TableCell align="right">{renderActions(user)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </CardContent>
      </Card>

      {creating && (
        <CreateUserDialog
          token={token}
          locations={locations}
          locationsError={locationsError}
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            refresh(
              'User created',
              `${created.displayName} (${created.username}) can now sign in.`,
            );
          }}
        />
      )}

      {resetTarget !== null && (
        <ResetPasswordDialog
          token={token}
          target={resetTarget}
          currentUserId={currentUserId}
          onClose={() => setResetTarget(null)}
          onSuccess={(reset) => {
            setResetTarget(null);
            showToast({
              tone: 'success',
              title: 'Password reset',
              description: `${reset.displayName} (${reset.username}) must use the new password. Their sessions were revoked.`,
            });
          }}
          onSelfReset={onSelfReset}
        />
      )}

      {bulkAction !== null && (
        <Dialog
          open
          onClose={() => setBulkAction(null)}
          fullWidth
          maxWidth="sm"
          aria-labelledby="bulk-users-title"
        >
          <ToneDialogTitle
            id="bulk-users-title"
            component="h2"
            tone={bulkAction.verb === 'deactivate' ? 'danger' : 'default'}
          >
            {bulkAction.verb === 'deactivate'
              ? 'Deactivate selected users'
              : 'Reactivate selected users'}
          </ToneDialogTitle>
          <DialogContent dividers>
            <Stack spacing={SPACING.md}>
              <Typography variant="body1">
                Apply this change to {bulkAction.ids.length} selected account(s)? Deactivation
                retains accounts and history; reactivation restores sign-in.
              </Typography>
              {bulkFailure !== null && (
                <Notice severity="error" role="alert">
                  {bulkFailure}
                </Notice>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <ActionButton
              tone="ghost"
              size="sm"
              onClick={() => setBulkAction(null)}
              disabled={bulkBusy}
            >
              Cancel
            </ActionButton>
            <ActionButton
              tone={bulkAction.verb === 'deactivate' ? 'danger-solid' : 'primary'}
              onClick={() => void runBulkAction()}
              disabled={bulkBusy}
            >
              {bulkBusy
                ? 'Applying…'
                : bulkAction.verb === 'deactivate'
                  ? 'Deactivate'
                  : 'Reactivate'}
            </ActionButton>
          </DialogActions>
        </Dialog>
      )}

      {deactivateTarget !== null && (
        <DeactivateDialog
          target={deactivateTarget}
          submitting={deactivating}
          failure={deactivateFailure}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={confirmDeactivate}
        />
      )}
    </Stack>
  );
}
