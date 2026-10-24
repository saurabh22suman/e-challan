import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate, useParams } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import type {
  AdminUser,
  ChallanReportResponse,
  ChallanReportQuery,
  ChallanStatus,
  ChallanSummary,
  MasterRecord,
  Role,
  Severity,
} from '@echallan/contracts';
import {
  challanStatusKind,
  Notice,
  SPACING,
  StatusBadge,
  ToneDialogTitle,
  tokens,
  useToast,
} from '@echallan/theme';
import {
  exportChallanReport,
  getChallanReport,
  listMasters,
  listUsers,
  OperationsApiError,
} from '../../api/operations';
import ChallanDetailDialog from './ChallanDetailDialog';

const STATUSES: ChallanStatus[] = ['Issued', 'Under Review', 'Resolved', 'Cancelled'];
const SEVERITIES: Severity[] = ['Minor', 'Major', 'Critical'];

function formatIssuedAt(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

interface FilterState {
  status: 'all' | ChallanStatus;
  search: string;
  severity: '' | Severity;
  locationId: string;
  departmentId: string;
  violationTypeId: string;
  vehicle: string;
  gatePass: string;
  issuedByUserId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FilterState = {
  status: 'all',
  search: '',
  severity: '',
  locationId: '',
  departmentId: '',
  violationTypeId: '',
  vehicle: '',
  gatePass: '',
  issuedByUserId: '',
  from: '',
  to: '',
};

interface ChallanReviewPanelProps {
  token: string;
  role: Role;
}

type SortField = NonNullable<ChallanReportQuery['sort']>;
type SortDirection = NonNullable<ChallanReportQuery['direction']>;

interface SavedView {
  name: string;
  filters: FilterState;
  sortField: SortField;
  sortDirection: SortDirection;
}

const SAVED_VIEWS_KEY = 'echallan.admin.report-views.v1';

function loadSavedViews(): SavedView[] {
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedView =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as SavedView).name === 'string' &&
          typeof (item as SavedView).filters === 'object',
      )
      .map((item) => ({
        ...item,
        filters: { ...EMPTY_FILTERS, ...item.filters },
      }));
  } catch {
    return [];
  }
}

/** One summary tile in the reporting strip. */
function Metric({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card sx={{ flex: '1 1 150px', minWidth: 0 }}>
      <CardContent>
        <Typography variant="caption" sx={{ color: accent, fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography
          component="p"
          variant="h1"
          sx={{ fontVariantNumeric: 'tabular-nums', margin: 0 }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function ChallanReviewPanel({ token, role }: ChallanReviewPanelProps) {
  const { showToast } = useToast();
  const { challanId } = useParams();
  const navigate = useNavigate();
  const compact = useMediaQuery('(max-width:1199.95px)');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sortField, setSortField] = useState<SortField>('issuedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [report, setReport] = useState<ChallanReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(challanId ?? null);
  const [reloadKey, setReloadKey] = useState(0);
  const [locations, setLocations] = useState<MasterRecord[]>([]);
  const [departments, setDepartments] = useState<MasterRecord[]>([]);
  const [violations, setViolations] = useState<MasterRecord[]>([]);
  const [marshals, setMarshals] = useState<AdminUser[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadSavedViews);
  const [selectedView, setSelectedView] = useState('');
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewError, setViewError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(challanId ?? null);
  }, [challanId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
    } catch {
      /* storage unavailable: views last for this page only */
    }
  }, [savedViews]);

  // Text filters apply after a short pause; selects apply immediately through
  // the same path so the server remains the only filter authority.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedFilters(filters);
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const query = useMemo<Partial<ChallanReportQuery>>(
    () => ({
      ...(appliedFilters.status === 'all' ? {} : { status: appliedFilters.status }),
      ...(appliedFilters.search.trim() === '' ? {} : { search: appliedFilters.search.trim() }),
      ...(appliedFilters.severity === '' ? {} : { severity: appliedFilters.severity }),
      ...(appliedFilters.locationId === '' ? {} : { locationId: appliedFilters.locationId }),
      ...(appliedFilters.departmentId === '' ? {} : { departmentId: appliedFilters.departmentId }),
      ...(appliedFilters.violationTypeId === ''
        ? {}
        : { violationTypeId: appliedFilters.violationTypeId }),
      ...(appliedFilters.vehicle.trim() === '' ? {} : { vehicle: appliedFilters.vehicle.trim() }),
      ...(appliedFilters.gatePass.trim() === ''
        ? {}
        : { gatePass: appliedFilters.gatePass.trim() }),
      ...(appliedFilters.issuedByUserId === ''
        ? {}
        : { issuedByUserId: appliedFilters.issuedByUserId }),
      ...(appliedFilters.from === '' ? {} : { from: appliedFilters.from }),
      ...(appliedFilters.to === '' ? {} : { to: appliedFilters.to }),
      sort: sortField,
      direction: sortDirection,
      page: page + 1,
      pageSize: rowsPerPage,
    }),
    [appliedFilters, page, rowsPerPage, sortDirection, sortField],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getChallanReport(token, query)
      .then((resolved) => {
        if (!cancelled) setReport(resolved);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(
          failure instanceof OperationsApiError
            ? failure.message
            : 'The review list could not be loaded.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, query, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listMasters(token, 'locations'),
      listMasters(token, 'departments'),
      listMasters(token, 'violation-types'),
      role === 'Admin' ? listUsers(token) : Promise.resolve<AdminUser[]>([]),
    ])
      .then(([locationList, departmentList, violationList, users]) => {
        if (cancelled) return;
        setLocations(locationList.masters);
        setDepartments(departmentList.masters);
        setViolations(violationList.masters);
        setMarshals(users);
      })
      .catch(() => {
        // Optional filter options must not hide the report itself. The status
        // filter and free-text searches remain usable.
      });
    return () => {
      cancelled = true;
    };
  }, [token, role]);

  const items = report?.items ?? [];
  const total = report?.total ?? 0;
  const totals = report?.totals ?? {
    total: 0,
    issuedToday: 0,
    pending: 0,
    resolved: 0,
    repeatOffenders: 0,
  };

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setSelectedView('');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'issuedAt' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const download = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await exportChallanReport(token, query);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast({
        tone: 'success',
        title: 'Export started',
        description: 'The export is recorded in the audit trail.',
      });
    } catch (failure) {
      setError(
        failure instanceof OperationsApiError
          ? failure.message
          : 'The export could not be created.',
      );
    } finally {
      setExporting(false);
    }
  };

  const hasFilters =
    filters.status !== 'all' ||
    filters.search.trim() !== '' ||
    filters.severity !== '' ||
    filters.locationId !== '' ||
    filters.departmentId !== '' ||
    filters.violationTypeId !== '' ||
    filters.vehicle !== '' ||
    filters.gatePass !== '' ||
    filters.issuedByUserId !== '' ||
    filters.from !== '' ||
    filters.to !== '';

  const applyView = (view: SavedView) => {
    const next = { ...EMPTY_FILTERS, ...view.filters };
    setFilters(next);
    setAppliedFilters(next);
    setSortField(view.sortField);
    setSortDirection(view.sortDirection);
    setSelectedView(view.name);
    setPage(0);
    setFiltersOpen(false);
  };

  const saveCurrentView = () => {
    const name = viewName.trim();
    if (name === '') {
      setViewError('Enter a name for this view.');
      return;
    }
    const next: SavedView = {
      name,
      filters,
      sortField,
      sortDirection,
    };
    setSavedViews((previous) => [...previous.filter((view) => view.name !== name), next]);
    setSelectedView(name);
    setSaveViewOpen(false);
    setViewName('');
    setViewError(null);
    showToast({
      tone: 'success',
      title: 'View saved',
      description: `“${name}” is saved in this browser.`,
    });
  };

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.search.trim() !== '') {
    activeChips.push({
      key: 'search',
      label: `Search: ${filters.search.trim()}`,
      clear: () => setFilter('search', ''),
    });
  }
  if (filters.status !== 'all') {
    activeChips.push({
      key: 'status',
      label: `Status: ${filters.status}`,
      clear: () => setFilter('status', 'all'),
    });
  }
  if (filters.severity !== '') {
    activeChips.push({
      key: 'severity',
      label: `Severity: ${filters.severity}`,
      clear: () => setFilter('severity', ''),
    });
  }
  if (filters.locationId !== '') {
    activeChips.push({
      key: 'location',
      label: `Location: ${locations.find((item) => item.id === filters.locationId)?.label ?? filters.locationId}`,
      clear: () => setFilter('locationId', ''),
    });
  }
  if (filters.departmentId !== '') {
    activeChips.push({
      key: 'department',
      label: `Department: ${departments.find((item) => item.id === filters.departmentId)?.label ?? filters.departmentId}`,
      clear: () => setFilter('departmentId', ''),
    });
  }
  if (filters.violationTypeId !== '') {
    activeChips.push({
      key: 'violation',
      label: `Violation: ${violations.find((item) => item.id === filters.violationTypeId)?.label ?? filters.violationTypeId}`,
      clear: () => setFilter('violationTypeId', ''),
    });
  }
  if (filters.issuedByUserId !== '') {
    activeChips.push({
      key: 'marshal',
      label: `Issued by: ${marshals.find((item) => item.id === filters.issuedByUserId)?.displayName ?? filters.issuedByUserId}`,
      clear: () => setFilter('issuedByUserId', ''),
    });
  }
  if (filters.vehicle.trim() !== '') {
    activeChips.push({
      key: 'vehicle',
      label: `Vehicle: ${filters.vehicle.trim()}`,
      clear: () => setFilter('vehicle', ''),
    });
  }
  if (filters.gatePass.trim() !== '') {
    activeChips.push({
      key: 'gatePass',
      label: `Gate pass: ${filters.gatePass.trim()}`,
      clear: () => setFilter('gatePass', ''),
    });
  }
  if (filters.from !== '') {
    activeChips.push({
      key: 'from',
      label: `From: ${filters.from}`,
      clear: () => setFilter('from', ''),
    });
  }
  if (filters.to !== '') {
    activeChips.push({ key: 'to', label: `To: ${filters.to}`, clear: () => setFilter('to', '') });
  }

  const currentIndex = selectedId === null ? -1 : items.findIndex((item) => item.id === selectedId);
  const moveDetail = (offset: number) => {
    const next = items[currentIndex + offset];
    if (next !== undefined) navigate(`/challans/${next.id}`);
  };

  return (
    <Stack spacing={SPACING.lg}>
      <Stack direction="row" spacing={SPACING.md} sx={{ flexWrap: 'wrap', rowGap: SPACING.md }}>
        <Metric label="Total" value={totals.total} accent={tokens.metric.total} />
        <Metric label="Issued today" value={totals.issuedToday} accent={tokens.metric.pending} />
        <Metric label="Pending" value={totals.pending} accent={tokens.metric.pending} />
        <Metric label="Resolved" value={totals.resolved} accent={tokens.metric.resolved} />
        <Metric
          label="Repeat offenders (90 days)"
          value={totals.repeatOffenders}
          accent={tokens.metric.period}
        />
      </Stack>

      <Card>
        <CardHeader
          title={
            <Typography component="h2" variant="h2">
              Challans
            </Typography>
          }
          subheader={
            role === 'Admin'
              ? 'Every location. Newest issued first.'
              : 'Your assigned locations only. Newest issued first.'
          }
        />
        <CardContent>
          <Stack spacing={SPACING.lg}>
            <Box
              sx={{
                padding: SPACING.md,
                border: `1px solid ${tokens.lineSoft}`,
                borderRadius: 2,
                backgroundColor: tokens.surface,
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={SPACING.md}
                sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap' }}
              >
                <TextField
                  label="Search challans"
                  placeholder="Challan, vehicle, gate pass, driver or location"
                  value={filters.search}
                  onChange={(event) => setFilter('search', event.target.value)}
                  sx={{ flex: '1 1 320px', maxWidth: { md: 460 } }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  select
                  label="Saved view"
                  value={selectedView}
                  onChange={(event) => {
                    const name = event.target.value;
                    setSelectedView(name);
                    if (name === 'Needs attention') {
                      applyView({
                        name,
                        filters: { ...EMPTY_FILTERS, status: 'Under Review' },
                        sortField: 'issuedAt',
                        sortDirection: 'asc',
                      });
                      return;
                    }
                    const view = savedViews.find((candidate) => candidate.name === name);
                    if (view !== undefined) applyView(view);
                  }}
                  sx={{ minWidth: 210 }}
                >
                  <MenuItem value="">No saved view</MenuItem>
                  <MenuItem value="Needs attention">Needs attention</MenuItem>
                  {savedViews.map((view) => (
                    <MenuItem key={view.name} value={view.name}>
                      {view.name}
                    </MenuItem>
                  ))}
                </TextField>
                {compact && (
                  <Button
                    variant={filtersOpen ? 'contained' : 'outlined'}
                    startIcon={<FilterListIcon />}
                    onClick={() => setFiltersOpen((previous) => !previous)}
                    aria-expanded={filtersOpen}
                    aria-controls="challan-filters"
                  >
                    {filtersOpen
                      ? 'Hide filters'
                      : hasFilters
                        ? `Filters (${activeChips.length})`
                        : 'Filters'}
                  </Button>
                )}
                <Button variant="outlined" onClick={() => setSaveViewOpen(true)}>
                  Save current view
                </Button>
                <Button
                  variant="outlined"
                  onClick={() =>
                    applyView({
                      name: 'Needs attention',
                      filters: { ...EMPTY_FILTERS, status: 'Under Review' },
                      sortField: 'issuedAt',
                      sortDirection: 'asc',
                    })
                  }
                >
                  Needs attention
                </Button>
              </Stack>
            </Box>

            {activeChips.length > 0 && (
              <Stack
                direction="row"
                spacing={SPACING.sm}
                sx={{ flexWrap: 'wrap', rowGap: SPACING.sm }}
              >
                {activeChips.map((chip) => (
                  <Chip
                    key={chip.key}
                    label={chip.label}
                    variant="outlined"
                    onDelete={chip.clear}
                  />
                ))}
                <Button
                  size="small"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setAppliedFilters(EMPTY_FILTERS);
                    setSelectedView('');
                    setPage(0);
                  }}
                >
                  Clear all
                </Button>
              </Stack>
            )}

            {(!compact || filtersOpen) && (
              <Box
                id="challan-filters"
                sx={{
                  padding: SPACING.lg,
                  border: `1px solid ${tokens.lineSoft}`,
                  borderRadius: 2,
                  backgroundColor: tokens.canvas,
                }}
              >
                <Box sx={{ marginBottom: SPACING.lg }}>
                  <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Refine results
                  </Typography>
                  <Typography variant="caption" sx={{ color: tokens.muted }}>
                    Filters are applied by the server across the authorised records.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      lg: 'repeat(4, 1fr)',
                    },
                    gap: SPACING.md,
                  }}
                >
                  <TextField
                    size="small"
                    select
                    label="Filter by status"
                    value={filters.status}
                    onChange={(event) =>
                      setFilter('status', event.target.value as FilterState['status'])
                    }
                  >
                    <MenuItem value="all">All statuses</MenuItem>
                    {STATUSES.map((candidate) => (
                      <MenuItem key={candidate} value={candidate}>
                        {candidate}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    select
                    label="Severity"
                    value={filters.severity}
                    onChange={(event) =>
                      setFilter('severity', event.target.value as FilterState['severity'])
                    }
                  >
                    <MenuItem value="">All severities</MenuItem>
                    {SEVERITIES.map((candidate) => (
                      <MenuItem key={candidate} value={candidate}>
                        {candidate}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    select
                    label="Location"
                    value={filters.locationId}
                    onChange={(event) => setFilter('locationId', event.target.value)}
                  >
                    <MenuItem value="">All locations</MenuItem>
                    {locations.map((location) => (
                      <MenuItem key={location.id} value={location.id}>
                        {location.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    select
                    label="Department"
                    value={filters.departmentId}
                    onChange={(event) => setFilter('departmentId', event.target.value)}
                  >
                    <MenuItem value="">All departments</MenuItem>
                    {departments.map((department) => (
                      <MenuItem key={department.id} value={department.id}>
                        {department.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    select
                    label="Violation type"
                    value={filters.violationTypeId}
                    onChange={(event) => setFilter('violationTypeId', event.target.value)}
                  >
                    <MenuItem value="">All violation types</MenuItem>
                    {violations.map((violation) => (
                      <MenuItem key={violation.id} value={violation.id}>
                        {violation.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  {role === 'Admin' && (
                    <TextField
                      size="small"
                      select
                      label="Issued by"
                      value={filters.issuedByUserId}
                      onChange={(event) => setFilter('issuedByUserId', event.target.value)}
                    >
                      <MenuItem value="">All marshals</MenuItem>
                      {marshals.map((marshal) => (
                        <MenuItem key={marshal.id} value={marshal.id}>
                          {marshal.displayName} ({marshal.username})
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                  <TextField
                    size="small"
                    label="Vehicle number"
                    value={filters.vehicle}
                    onChange={(event) => setFilter('vehicle', event.target.value)}
                  />
                  <TextField
                    size="small"
                    label="Gate pass number"
                    value={filters.gatePass}
                    onChange={(event) => setFilter('gatePass', event.target.value)}
                  />
                  <TextField
                    size="small"
                    label="From date"
                    type="date"
                    value={filters.from}
                    onChange={(event) => setFilter('from', event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    size="small"
                    label="To date"
                    type="date"
                    value={filters.to}
                    onChange={(event) => setFilter('to', event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Box>
              </Box>
            )}

            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={() => void download()} disabled={exporting}>
                {exporting ? 'Preparing export…' : 'Export Excel'}
              </Button>
            </Stack>

            {error !== null && (
              <Notice severity="error" role="status">
                <Stack direction="row" spacing={SPACING.md} sx={{ alignItems: 'center' }}>
                  <Typography variant="body1">{error}</Typography>
                  <Button size="small" onClick={() => setReloadKey((value) => value + 1)}>
                    Retry
                  </Button>
                </Stack>
              </Notice>
            )}

            {loading ? (
              <CircularProgress aria-label="Loading challans" />
            ) : items.length === 0 && error === null ? (
              <Notice severity="info" role="status">
                <Stack direction="row" spacing={SPACING.md} sx={{ alignItems: 'center' }}>
                  <Typography variant="body1">No challans match this filter.</Typography>
                  {hasFilters && (
                    <Button
                      size="small"
                      onClick={() => {
                        setFilters(EMPTY_FILTERS);
                        setAppliedFilters(EMPTY_FILTERS);
                        setPage(0);
                      }}
                    >
                      Clear filter
                    </Button>
                  )}
                </Stack>
              </Notice>
            ) : (
              <>
                {compact ? (
                  <Stack spacing={SPACING.md}>
                    {items.map((item: ChallanSummary) => (
                      <Box
                        key={item.id}
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
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="body1"
                                sx={{ fontFamily: 'monospace', fontWeight: 700 }}
                              >
                                {item.challanNumber}
                              </Typography>
                              <Typography variant="caption" sx={{ color: tokens.muted }}>
                                {item.locationLabel}
                              </Typography>
                            </Box>
                            <StatusBadge status={challanStatusKind(item.status)} />
                          </Stack>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: SPACING.sm,
                            }}
                          >
                            <Box>
                              <Typography variant="caption" sx={{ color: tokens.muted }}>
                                Vehicle
                              </Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {item.vehicleRegistrationNumber}
                              </Typography>
                              <Typography variant="caption" sx={{ color: tokens.muted }}>
                                {item.gatePassNumber}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: tokens.muted }}>
                                Driver
                              </Typography>
                              <Typography variant="body2">{item.driverName}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: tokens.muted }}>
                                Severity
                              </Typography>
                              <Typography variant="body2">{item.severity}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: tokens.muted }}>
                                Issued
                              </Typography>
                              <Typography variant="body2">
                                {formatIssuedAt(item.issuedAt)}
                              </Typography>
                            </Box>
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            aria-label={`Open ${item.challanNumber}`}
                            onClick={() => navigate(`/challans/${item.id}`)}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            Open challan
                          </Button>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <TableContainer
                    sx={{
                      overflow: 'visible',
                      '& thead th': { position: 'sticky', top: 0, zIndex: 2 },
                    }}
                  >
                    <Table aria-label="Challans">
                      <TableHead>
                        <TableRow>
                          <TableCell
                            sortDirection={sortField === 'challanNumber' ? sortDirection : false}
                          >
                            <TableSortLabel
                              active={sortField === 'challanNumber'}
                              direction={sortField === 'challanNumber' ? sortDirection : 'asc'}
                              onClick={() => toggleSort('challanNumber')}
                            >
                              Challan
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>Vehicle</TableCell>
                          <TableCell>Driver</TableCell>
                          <TableCell>Location</TableCell>
                          <TableCell
                            sortDirection={sortField === 'severity' ? sortDirection : false}
                          >
                            <TableSortLabel
                              active={sortField === 'severity'}
                              direction={sortField === 'severity' ? sortDirection : 'asc'}
                              onClick={() => toggleSort('severity')}
                            >
                              Severity
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sortDirection={sortField === 'status' ? sortDirection : false}>
                            <TableSortLabel
                              active={sortField === 'status'}
                              direction={sortField === 'status' ? sortDirection : 'asc'}
                              onClick={() => toggleSort('status')}
                            >
                              Status
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sortDirection={sortField === 'issuedAt' ? sortDirection : false}
                          >
                            <TableSortLabel
                              active={sortField === 'issuedAt'}
                              direction={sortField === 'issuedAt' ? sortDirection : 'desc'}
                              onClick={() => toggleSort('issuedAt')}
                            >
                              Issued
                            </TableSortLabel>
                          </TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item: ChallanSummary) => (
                          <TableRow key={item.id} hover>
                            <TableCell sx={{ fontFamily: 'monospace' }}>
                              {item.challanNumber}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {item.vehicleRegistrationNumber}
                              </Typography>
                              <Typography variant="caption" sx={{ color: tokens.muted }}>
                                {item.gatePassNumber}
                              </Typography>
                            </TableCell>
                            <TableCell>{item.driverName}</TableCell>
                            <TableCell>{item.locationLabel}</TableCell>
                            <TableCell>{item.severity}</TableCell>
                            <TableCell>
                              <StatusBadge status={challanStatusKind(item.status)} />
                            </TableCell>
                            <TableCell sx={{ color: tokens.muted, whiteSpace: 'nowrap' }}>
                              {formatIssuedAt(item.issuedAt)}
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                aria-label={`Open ${item.challanNumber}`}
                                onClick={() => navigate(`/challans/${item.id}`)}
                              >
                                Open
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                <TablePagination
                  component="div"
                  count={total}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  onPageChange={(_event, nextPage) => setPage(nextPage)}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(0);
                  }}
                />
              </>
            )}
          </Stack>
        </CardContent>

        <ChallanDetailDialog
          token={token}
          challanId={selectedId}
          role={role}
          onClose={() => navigate('/challans')}
          onChanged={() => setReloadKey((value) => value + 1)}
          onPrevious={() => moveDetail(-1)}
          onNext={() => moveDetail(1)}
          previousDisabled={currentIndex <= 0}
          nextDisabled={currentIndex < 0 || currentIndex >= items.length - 1}
        />
      </Card>

      <Dialog
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="save-view-title"
      >
        <ToneDialogTitle id="save-view-title" component="h2">
          Save current view
        </ToneDialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            label="View name"
            value={viewName}
            onChange={(event) => {
              setViewName(event.target.value);
              setViewError(null);
            }}
            error={viewError !== null}
            helperText={viewError ?? 'Saved in this browser for quick access.'}
            fullWidth
            sx={{ mt: SPACING.sm }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveViewOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCurrentView}>
            Save view
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
