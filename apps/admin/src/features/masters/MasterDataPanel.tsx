import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
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
import {
  MASTER_KINDS,
  RESOLUTION_ACTION_LABELS,
  type MasterKind,
  type MasterRecord,
  type ResolutionActionCode,
  type Severity,
} from '@echallan/contracts';
import {
  ActionButton,
  Notice,
  SPACING,
  StatusBadge,
  ToneDialogTitle,
  tokens,
  useToast,
} from '@echallan/theme';
import {
  deactivateMaster,
  listAdminMasters,
  listMasters,
  OperationsApiError,
  saveMaster,
} from '../../api/operations';

const KIND_LABELS: Record<MasterKind, string> = {
  'violation-types': 'Violation types',
  departments: 'Departments',
  contractors: 'Contractors',
  locations: 'Locations',
  gates: 'Gates',
  'vehicle-types': 'Vehicle types',
};

const SEVERITIES: Severity[] = ['Minor', 'Major', 'Critical'];
const ACTION_CODES = Object.keys(RESOLUTION_ACTION_LABELS) as ResolutionActionCode[];

interface EditState {
  mode: 'create' | 'edit';
  target: MasterRecord | null;
  label: string;
  severity: Severity;
  defaultAction: '' | ResolutionActionCode;
  locationId: string;
  error: string | null;
}

function emptyEdit(): EditState {
  return {
    mode: 'create',
    target: null,
    label: '',
    severity: 'Minor',
    defaultAction: '',
    locationId: '',
    error: null,
  };
}

export default function MasterDataPanel({ token }: { token: string }) {
  const { showToast } = useToast();
  const [kind, setKind] = useState<MasterKind>('violation-types');
  const [masters, setMasters] = useState<MasterRecord[]>([]);
  const [locations, setLocations] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deactivating, setDeactivating] = useState<MasterRecord | null>(null);
  const [actionFailure, setActionFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFailure, setBulkFailure] = useState<string | null>(null);
  const compact = useMediaQuery('(max-width:1199.95px)');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([listAdminMasters(token, kind), listMasters(token, 'locations')])
      .then(([list, locationList]) => {
        if (cancelled) return;
        setMasters(list.masters);
        setLocations(locationList.masters);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(
          failure instanceof OperationsApiError
            ? failure.message
            : 'The master-data list could not be loaded.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, kind, reloadKey]);

  const locationLabels = useMemo(
    () => new Map(locations.map((location) => [location.id, location.label])),
    [locations],
  );
  const filteredMasters = useMemo(() => {
    const term = search.trim().toLowerCase();
    return masters.filter((master) => {
      if (statusFilter === 'active' && !master.isActive) return false;
      if (statusFilter === 'inactive' && master.isActive) return false;
      return term === '' || master.label.toLowerCase().includes(term);
    });
  }, [masters, search, statusFilter]);
  const selectableMasters = filteredMasters.filter((master) => master.isActive);
  const selectedMasters = masters.filter((master) => selectedIds.has(master.id));

  useEffect(() => {
    setSelectedIds(new Set());
  }, [kind, search, statusFilter, reloadKey]);

  function toggleSelected(id: string): void {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkDeactivate(): Promise<void> {
    setBulkBusy(true);
    setBulkFailure(null);
    try {
      for (const master of selectedMasters) {
        await deactivateMaster(token, kind, master.id);
      }
      const count = selectedMasters.length;
      setBulkOpen(false);
      setSelectedIds(new Set());
      showToast({
        tone: 'success',
        title: 'Master entries deactivated',
        description: `${count} master entr${count === 1 ? 'y' : 'ies'} removed from selectors. Historical challans keep their snapshots.`,
      });
      setReloadKey((value) => value + 1);
    } catch (failure) {
      setBulkFailure(
        failure instanceof OperationsApiError
          ? failure.message
          : 'The selected entries could not be deactivated.',
      );
    } finally {
      setBulkBusy(false);
    }
  }

  const startCreate = () => {
    setActionFailure(null);
    setEdit(emptyEdit());
  };

  const startEdit = (master: MasterRecord) => {
    setActionFailure(null);
    setEdit({
      mode: 'edit',
      target: master,
      label: master.label,
      severity: master.severity ?? 'Minor',
      defaultAction: master.defaultAction ?? '',
      locationId: master.locationId ?? '',
      error: null,
    });
  };

  const submit = () => {
    if (edit === null) return;
    if (edit.label.trim() === '') {
      setEdit((previous) => (previous === null ? null : { ...previous, error: 'Enter a label.' }));
      return;
    }
    if (kind === 'gates' && edit.mode === 'create' && edit.locationId === '') {
      setEdit((previous) =>
        previous === null ? null : { ...previous, error: 'Choose the gate location.' },
      );
      return;
    }
    const payload =
      kind === 'violation-types'
        ? {
            label: edit.label.trim(),
            severity: edit.severity,
            defaultAction: edit.defaultAction === '' ? null : edit.defaultAction,
          }
        : kind === 'gates'
          ? edit.mode === 'create'
            ? { label: edit.label.trim(), locationId: edit.locationId }
            : { label: edit.label.trim() }
          : { label: edit.label.trim() };

    setBusy(true);
    setEdit((previous) => (previous === null ? null : { ...previous, error: null }));
    saveMaster(
      token,
      kind,
      edit.mode === 'create' ? 'create' : 'update',
      payload,
      edit.mode === 'edit' && edit.target !== null ? edit.target.id : undefined,
    )
      .then(() => {
        const created = edit.mode === 'create';
        setEdit(null);
        showToast({
          tone: 'success',
          title: created ? 'Master entry created' : 'Master entry updated',
          description: created
            ? 'The entry is now available in the controlled selectors.'
            : 'The entry was saved and is used by new records.',
        });
        setReloadKey((value) => value + 1);
      })
      .catch((failure: unknown) => {
        setEdit((previous) =>
          previous === null
            ? null
            : {
                ...previous,
                error:
                  failure instanceof OperationsApiError
                    ? failure.message
                    : 'The master entry could not be saved.',
              },
        );
      })
      .finally(() => setBusy(false));
  };

  const confirmDeactivate = () => {
    if (deactivating === null) return;
    setBusy(true);
    setActionFailure(null);
    deactivateMaster(token, kind, deactivating.id)
      .then(() => {
        showToast({
          tone: 'success',
          title: 'Master entry deactivated',
          description: `${deactivating.label} was removed from selectors. Historical challans keep their snapshots.`,
        });
        setDeactivating(null);
        setReloadKey((value) => value + 1);
      })
      .catch((failure: unknown) => {
        setActionFailure(
          failure instanceof OperationsApiError
            ? failure.message
            : 'The master entry could not be deactivated.',
        );
      })
      .finally(() => setBusy(false));
  };

  function renderActions(master: MasterRecord) {
    return (
      <Stack direction="row" spacing={SPACING.sm} sx={{ flexWrap: 'wrap' }}>
        <ActionButton tone="secondary" size="sm" onClick={() => startEdit(master)}>
          Edit
        </ActionButton>
        {master.isActive && (
          <ActionButton
            size="sm"
            tone="danger"
            onClick={() => {
              setActionFailure(null);
              setDeactivating(master);
            }}
          >
            Deactivate
          </ActionButton>
        )}
      </Stack>
    );
  }

  function detailText(master: MasterRecord): string {
    if (master.kind === 'violation-types') {
      return `${master.severity ?? '—'} · ${
        master.defaultAction === null || master.defaultAction === undefined
          ? 'No default action'
          : RESOLUTION_ACTION_LABELS[master.defaultAction]
      }`;
    }
    if (master.kind === 'gates') {
      return locationLabels.get(master.locationId ?? '') ?? 'Unknown location';
    }
    return '—';
  }

  return (
    <Card>
      <CardHeader
        title={
          <Typography component="h2" variant="h2">
            Master data
          </Typography>
        }
        subheader="Manage controlled values. Entries are deactivated, never deleted."
      />
      <CardContent>
        <Stack spacing={SPACING.lg}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={SPACING.md}>
            <TextField
              select
              label="Master kind"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as MasterKind);
                setError(null);
              }}
              sx={{ minWidth: 260 }}
            >
              {MASTER_KINDS.map((candidate) => (
                <MenuItem key={candidate} value={candidate}>
                  {KIND_LABELS[candidate]}
                </MenuItem>
              ))}
            </TextField>
            <ActionButton tone="primary" onClick={startCreate}>
              Add {KIND_LABELS[kind].toLowerCase().replace(/s$/u, '')}
            </ActionButton>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={SPACING.md}>
            <TextField
              label="Search master entries"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="Status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')
              }
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            {selectedMasters.length > 0 && (
              <ActionButton tone="danger" onClick={() => setBulkOpen(true)}>
                Deactivate selected ({selectedMasters.length})
              </ActionButton>
            )}
          </Stack>

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
            <CircularProgress aria-label="Loading master data" />
          ) : filteredMasters.length === 0 ? (
            <Notice severity="info" role="status">
              No entries match these filters.
            </Notice>
          ) : compact ? (
            <Stack spacing={SPACING.md}>
              {filteredMasters.map((master) => (
                <Box
                  key={master.id}
                  sx={{
                    border: `1px solid ${tokens.line}`,
                    borderRadius: 2,
                    padding: SPACING.md,
                    backgroundColor: tokens.surface,
                  }}
                >
                  <Stack spacing={SPACING.sm}>
                    <Stack
                      direction="row"
                      spacing={SPACING.sm}
                      sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
                    >
                      <Stack direction="row" spacing={SPACING.sm} sx={{ alignItems: 'center' }}>
                        {master.isActive && (
                          <Checkbox
                            slotProps={{ input: { 'aria-label': `Select ${master.label}` } }}
                            checked={selectedIds.has(master.id)}
                            onChange={() => toggleSelected(master.id)}
                          />
                        )}
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {master.label}
                        </Typography>
                      </Stack>
                      {master.isActive ? (
                        <StatusBadge status="active" />
                      ) : (
                        <StatusBadge status="deactivated" label="Inactive" />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: tokens.muted }}>
                      {detailText(master)}
                    </Typography>
                    {renderActions(master)}
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table aria-label="Master data">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        slotProps={{
                          input: { 'aria-label': 'Select all visible active master entries' },
                        }}
                        checked={
                          selectableMasters.length > 0 &&
                          selectableMasters.every((master) => selectedIds.has(master.id))
                        }
                        indeterminate={
                          selectableMasters.some((master) => selectedIds.has(master.id)) &&
                          !selectableMasters.every((master) => selectedIds.has(master.id))
                        }
                        onChange={(event) => {
                          setSelectedIds(
                            event.target.checked
                              ? new Set(selectableMasters.map((master) => master.id))
                              : new Set(),
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>Label</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Details</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMasters.map((master) => (
                    <TableRow key={master.id} hover>
                      <TableCell padding="checkbox">
                        {master.isActive && (
                          <Checkbox
                            slotProps={{ input: { 'aria-label': `Select ${master.label}` } }}
                            checked={selectedIds.has(master.id)}
                            onChange={() => toggleSelected(master.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{master.label}</TableCell>
                      <TableCell>
                        {master.isActive ? (
                          <StatusBadge status="active" />
                        ) : (
                          <StatusBadge status="deactivated" label="Inactive" />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: tokens.muted }}>{detailText(master)}</TableCell>
                      <TableCell align="right">{renderActions(master)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </CardContent>

      {edit !== null && (
        <Dialog
          open
          onClose={() => setEdit(null)}
          fullWidth
          maxWidth="sm"
          aria-labelledby="master-edit-title"
        >
          <ToneDialogTitle id="master-edit-title" component="h2">
            {edit.mode === 'create' ? `Create ${KIND_LABELS[kind]}` : `Edit ${edit.target?.label}`}
          </ToneDialogTitle>
          <DialogContent dividers>
            <Stack spacing={SPACING.lg} sx={{ pt: SPACING.sm }}>
              {edit.error !== null && (
                <Notice severity="error" role="alert">
                  {edit.error}
                </Notice>
              )}
              <TextField
                label="Label"
                value={edit.label}
                onChange={(event) =>
                  setEdit((previous) =>
                    previous === null ? null : { ...previous, label: event.target.value },
                  )
                }
                fullWidth
                required
              />
              {kind === 'violation-types' && (
                <>
                  <FormControl fullWidth>
                    <InputLabel id="master-severity-label">Severity</InputLabel>
                    <Select
                      labelId="master-severity-label"
                      label="Severity"
                      value={edit.severity}
                      onChange={(event) =>
                        setEdit((previous) =>
                          previous === null
                            ? null
                            : { ...previous, severity: event.target.value as Severity },
                        )
                      }
                    >
                      {SEVERITIES.map((severity) => (
                        <MenuItem key={severity} value={severity}>
                          {severity}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel id="master-action-label">Default action</InputLabel>
                    <Select
                      labelId="master-action-label"
                      label="Default action"
                      value={edit.defaultAction}
                      onChange={(event) =>
                        setEdit((previous) =>
                          previous === null
                            ? null
                            : {
                                ...previous,
                                defaultAction: event.target.value as '' | ResolutionActionCode,
                              },
                        )
                      }
                    >
                      <MenuItem value="">No default action</MenuItem>
                      {ACTION_CODES.map((code) => (
                        <MenuItem key={code} value={code}>
                          {RESOLUTION_ACTION_LABELS[code]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
              {kind === 'gates' && edit.mode === 'create' && (
                <FormControl fullWidth required>
                  <InputLabel id="master-location-label">Location</InputLabel>
                  <Select
                    labelId="master-location-label"
                    label="Location"
                    value={edit.locationId}
                    onChange={(event) =>
                      setEdit((previous) =>
                        previous === null ? null : { ...previous, locationId: event.target.value },
                      )
                    }
                  >
                    {locations
                      .filter((location) => location.isActive)
                      .map((location) => (
                        <MenuItem key={location.id} value={location.id}>
                          {location.label}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <ActionButton tone="ghost" size="sm" onClick={() => setEdit(null)} disabled={busy}>
              Cancel
            </ActionButton>
            <ActionButton tone="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : edit.mode === 'create' ? 'Create' : 'Save changes'}
            </ActionButton>
          </DialogActions>
        </Dialog>
      )}

      {bulkOpen && (
        <Dialog
          open
          onClose={() => setBulkOpen(false)}
          fullWidth
          maxWidth="sm"
          aria-labelledby="bulk-master-deactivate-title"
        >
          <ToneDialogTitle id="bulk-master-deactivate-title" component="h2" tone="danger">
            Deactivate selected master entries
          </ToneDialogTitle>
          <DialogContent dividers>
            <Stack spacing={SPACING.md}>
              <Typography variant="body1">
                Deactivate {selectedMasters.length} selected active entr
                {selectedMasters.length === 1 ? 'y' : 'ies'}? They will disappear from selectors;
                historical challans keep their snapshots. This pilot has no reactivation action.
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
              onClick={() => setBulkOpen(false)}
              disabled={bulkBusy}
            >
              Cancel
            </ActionButton>
            <ActionButton
              tone="danger-solid"
              onClick={() => void runBulkDeactivate()}
              disabled={bulkBusy}
            >
              {bulkBusy ? 'Deactivating…' : 'Deactivate'}
            </ActionButton>
          </DialogActions>
        </Dialog>
      )}

      {deactivating !== null && (
        <Dialog
          open
          onClose={() => setDeactivating(null)}
          fullWidth
          maxWidth="sm"
          aria-labelledby="master-deactivate-title"
        >
          <ToneDialogTitle id="master-deactivate-title" component="h2" tone="danger">
            Deactivate master entry
          </ToneDialogTitle>
          <DialogContent dividers>
            <Stack spacing={SPACING.md}>
              <Typography variant="body1">
                Deactivate “{deactivating.label}”? It will no longer appear in selectors, but
                historical challans keep their issued snapshots. This pilot has no reactivation
                action.
              </Typography>
              {actionFailure !== null && (
                <Notice severity="error" role="alert">
                  {actionFailure}
                </Notice>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <ActionButton
              tone="ghost"
              size="sm"
              onClick={() => setDeactivating(null)}
              disabled={busy}
            >
              Cancel
            </ActionButton>
            <ActionButton tone="danger-solid" onClick={confirmDeactivate} disabled={busy}>
              Deactivate
            </ActionButton>
          </DialogActions>
        </Dialog>
      )}
    </Card>
  );
}
