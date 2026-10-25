import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Drawer from '@mui/material/Drawer';
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
  ActionButton,
  challanStatusKind,
  EmptyState,
  FONT_MONO,
  LIST_CARD_BREAKPOINT,
  MetricCard,
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
  userId: string;
}

type SortField = NonNullable<ChallanReportQuery['sort']>;
type SortDirection = NonNullable<ChallanReportQuery['direction']>;

export interface SavedView {
  name: string;
  filters: FilterState;
  sortField: SortField;
  sortDirection: SortDirection;
}

export const SAVED_VIEWS_KEY = 'echallan.admin.report-views.v1';
const SAVED_VIEWS_VERSION = 2;

interface SavedViewEnvelope {
  schemaVersion: 2;
  accounts: Record<string, SavedView[]>;
}

function savedViewAccountKey(userId: string, role: Role): string {
  return `${userId}:${role}`;
}

function isSavedView(value: unknown): value is SavedView {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SavedView).name === 'string' &&
    typeof (value as SavedView).filters === 'object'
  );
}

/**
 * Saved views are a browser preference, not a shared terminal setting. The v1
 * array is migrated into a per-account envelope; tokens and credentials are
 * never written here.
 */
export function loadSavedViews(userId: string, role: Role): SavedView[] {
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    const normalise = (views: unknown[]): SavedView[] =>
      views.filter(isSavedView).map((item) => ({
        ...item,
        filters: { ...EMPTY_FILTERS, ...item.filters },
      }));
    if (Array.isArray(parsed)) {
      // Legacy views have no owner. Never infer ownership from the next login:
      // discard them and replace the legacy array with an empty v2 envelope.
      window.localStorage.setItem(
        SAVED_VIEWS_KEY,
        JSON.stringify({ schemaVersion: SAVED_VIEWS_VERSION, accounts: {} }),
      );
      return [];
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const envelope = parsed as Partial<SavedViewEnvelope>;
      const views = envelope.accounts?.[savedViewAccountKey(userId, role)];
      return Array.isArray(views) ? normalise(views) : [];
    }
    return [];
  } catch {
    return [];
  }
}

export function persistSavedViews(userId: string, role: Role, views: SavedView[]): void {
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    let envelope: SavedViewEnvelope = { schemaVersion: SAVED_VIEWS_VERSION, accounts: {} };
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        typeof (parsed as SavedViewEnvelope).accounts === 'object'
      ) {
        envelope = {
          schemaVersion: SAVED_VIEWS_VERSION,
          accounts: (parsed as SavedViewEnvelope).accounts ?? {},
        };
      }
    }
    envelope.accounts[savedViewAccountKey(userId, role)] = views;
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(envelope));
  } catch {
    /* storage unavailable: views last for this page only */
  }
}

export default function ChallanReviewPanel({ token, role, userId }: ChallanReviewPanelProps) {
  const { showToast } = useToast();
  const { challanId } = useParams();
  const navigate = useNavigate();
  const compactQuery = `(max-width:${LIST_CARD_BREAKPOINT}px)`;
  const compact = useMediaQuery(compactQuery, {
    defaultMatches: typeof window !== 'undefined' && window.matchMedia(compactQuery).matches,
  });
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
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews(userId, role));
  const [selectedView, setSelectedView] = useState('');
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewError, setViewError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(challanId ?? null);
  }, [challanId]);

  useEffect(() => {
    setSavedViews(loadSavedViews(userId, role));
  }, [role, userId]);

  useEffect(() => {
    persistSavedViews(userId, role, savedViews);
  }, [role, savedViews, userId]);

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

  const applyUnderReview = () => {
    const next: FilterState = { ...EMPTY_FILTERS, status: 'Under Review' };
    setFilters(next);
    setAppliedFilters(next);
    setSelectedView('');
    setSortField('issuedAt');
    setSortDirection('asc');
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

  const filtersPending = JSON.stringify(filters) !== JSON.stringify(appliedFilters);
  const refreshing = report !== null && loading;
  const initialLoading = report === null && loading;

  return (
    <Stack spacing={SPACING.xl}>
      <PageHeader
        eyebrow="Review queue"
        title="Challans"
        titleComponent="h2"
        description={
          role === 'Admin'
            ? 'Every location, newest issued first. Open a record to review evidence and record follow-up.'
            : 'Your assigned locations, newest issued first. Open a record to review evidence and record follow-up.'
        }
        meta={report === null ? 'Loading records…' : `${total} records in this view`}
        actions={
          <>
            <ActionButton tone="ghost" onClick={() => setReloadKey((value) => value + 1)}>
              Refresh
            </ActionButton>
            <ActionButton
              tone="primary"
              onClick={() => void download()}
              disabled={exporting || loading || filtersPending || report === null}
            >
              {exporting ? 'Preparing export…' : 'Export Excel'}
            </ActionButton>
          </>
        }
      />

      <Box
        aria-busy={loading}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
          gap: SPACING.md,
        }}
      >
        {report === null && initialLoading ? (
          <>
            {['Total', 'Issued today', 'Pending', 'Resolved', 'Repeat offenders'].map((label) => (
              <MetricCard key={label} label={label} value="" loading />
            ))}
          </>
        ) : report !== null ? (
          <>
            <MetricCard label="Total" value={totals.total} tone="neutral" />
            <MetricCard label="Issued today" value={totals.issuedToday} tone="info" />
            <MetricCard
              label="Pending"
              value={totals.pending}
              tone="warning"
              hint="Issued + under review"
            />
            <MetricCard label="Resolved" value={totals.resolved} tone="success" />
            <MetricCard
              label="Repeat offenders"
              value={totals.repeatOffenders}
              tone="neutral"
              hint="Last 90 days"
            />
          </>
        ) : null}
      </Box>

      {refreshing && (
        <Typography
          variant="caption"
          role="status"
          sx={{ color: tokens.muted, marginTop: `-${SPACING.sm}` }}
        >
          Updating results…
        </Typography>
      )}

      <Card>
        <CardContent>
          <Stack spacing={SPACING.lg}>
            <Box
              sx={{
                paddingBottom: SPACING.lg,
                borderBottom: `1px solid ${tokens.lineSoft}`,
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={SPACING.md}
                sx={{ alignItems: { md: 'flex-end' }, flexWrap: 'wrap' }}
              >
                <TextField
                  label="Search challans"
                  placeholder="Challan, vehicle, gate pass, driver or location"
                  value={filters.search}
                  onChange={(event) => setFilter('search', event.target.value)}
                  sx={{ flex: { xs: '1 1 auto', md: '1 1 280px' }, minWidth: 0 }}
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
                    const view = savedViews.find((candidate) => candidate.name === name);
                    if (view !== undefined) applyView(view);
                  }}
                  sx={{ minWidth: 210 }}
                >
                  <MenuItem value="">No saved view</MenuItem>
                  {savedViews.map((view) => (
                    <MenuItem key={view.name} value={view.name}>
                      {view.name}
                    </MenuItem>
                  ))}
                </TextField>
                <ActionButton
                  tone={filtersOpen ? 'primary' : 'secondary'}
                  startIcon={<FilterListIcon />}
                  onClick={() => setFiltersOpen((previous) => !previous)}
                  aria-expanded={filtersOpen}
                  aria-controls="challan-filters-drawer"
                >
                  {filtersOpen
                    ? 'Hide filters'
                    : hasFilters
                      ? `Filters (${activeChips.length})`
                      : 'Filters'}
                </ActionButton>
                <ActionButton tone="ghost" onClick={() => setSaveViewOpen(true)}>
                  Save current view
                </ActionButton>
                <ActionButton tone="secondary" onClick={applyUnderReview}>
                  Under review
                </ActionButton>
              </Stack>
              {filtersPending && (
                <Typography
                  variant="caption"
                  role="status"
                  sx={{ color: tokens.muted, mt: SPACING.sm }}
                >
                  Updating results with the latest filters…
                </Typography>
              )}
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
                <ActionButton
                  tone="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setAppliedFilters(EMPTY_FILTERS);
                    setSelectedView('');
                    setPage(0);
                  }}
                >
                  Clear all
                </ActionButton>
              </Stack>
            )}

            <Drawer
              anchor="right"
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              slotProps={{
                paper: {
                  sx: {
                    width: { xs: '100%', sm: 460 },
                    boxSizing: 'border-box',
                    padding: SPACING.lg,
                  },
                },
              }}
            >
              <Stack id="challan-filters-drawer" spacing={SPACING.lg} sx={{ minHeight: '100%' }}>
                <Stack
                  direction="row"
                  spacing={SPACING.md}
                  sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography component="h2" variant="h3">
                      Filters
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.muted }}>
                      Results update as you choose filters.
                    </Typography>
                  </Box>
                  <ActionButton tone="ghost" size="sm" onClick={() => setFiltersOpen(false)}>
                    Close
                  </ActionButton>
                </Stack>
                <Box
                  sx={{
                    flex: '1 1 auto',
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: SPACING.md,
                    alignContent: 'start',
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
                <Stack
                  direction="row"
                  spacing={SPACING.md}
                  sx={{
                    justifyContent: 'flex-end',
                    borderTop: `1px solid ${tokens.lineSoft}`,
                    paddingTop: SPACING.md,
                  }}
                >
                  <ActionButton
                    tone="ghost"
                    onClick={() => {
                      setFilters(EMPTY_FILTERS);
                      setAppliedFilters(EMPTY_FILTERS);
                      setSelectedView('');
                      setPage(0);
                    }}
                    disabled={!hasFilters}
                  >
                    Clear all
                  </ActionButton>
                  <ActionButton tone="primary" onClick={() => setFiltersOpen(false)}>
                    Done
                  </ActionButton>
                </Stack>
              </Stack>
            </Drawer>

            {error !== null && (
              <Notice severity="error" role="status">
                <Stack direction="row" spacing={SPACING.md} sx={{ alignItems: 'center' }}>
                  <Typography variant="body1">
                    {report === null
                      ? error
                      : 'Could not refresh this view. Showing the last loaded results.'}
                  </Typography>
                  <ActionButton
                    tone="ghost"
                    size="sm"
                    onClick={() => setReloadKey((value) => value + 1)}
                  >
                    Retry
                  </ActionButton>
                </Stack>
              </Notice>
            )}

            {initialLoading ? (
              <Stack spacing={SPACING.md} role="status" aria-label="Loading challans">
                <CircularProgress size={24} />
                <Typography variant="body2" sx={{ color: tokens.muted }}>
                  Loading records…
                </Typography>
              </Stack>
            ) : items.length === 0 && error === null ? (
              <EmptyState
                title="No challans match this filter"
                description="Try a broader search, clear a filter, or choose another saved view."
                action={
                  hasFilters ? (
                    <ActionButton
                      tone="secondary"
                      onClick={() => {
                        setFilters(EMPTY_FILTERS);
                        setAppliedFilters(EMPTY_FILTERS);
                        setSelectedView('');
                        setPage(0);
                      }}
                    >
                      Clear filters
                    </ActionButton>
                  ) : undefined
                }
              />
            ) : (
              <>
                {compact ? (
                  <Stack spacing={SPACING.md}>
                    {items.map((item: ChallanSummary) => (
                      <RecordCard
                        key={item.id}
                        title={
                          <span style={{ fontFamily: FONT_MONO, letterSpacing: '0.01em' }}>
                            {item.challanNumber}
                          </span>
                        }
                        subtitle={item.locationLabel}
                        badge={<StatusBadge status={challanStatusKind(item.status)} />}
                        fields={[
                          { label: 'Vehicle', value: item.vehicleRegistrationNumber, mono: true },
                          { label: 'Driver', value: item.driverName },
                          { label: 'Severity', value: item.severity },
                          { label: 'Issued', value: formatIssuedAt(item.issuedAt) },
                          { label: 'Gate pass', value: item.gatePassNumber, mono: true },
                        ]}
                        actions={
                          <ActionButton
                            tone="secondary"
                            size="sm"
                            aria-label={`Open ${item.challanNumber}`}
                            onClick={() => navigate(`/challans/${item.id}`)}
                          >
                            Open challan
                          </ActionButton>
                        }
                      />
                    ))}
                  </Stack>
                ) : (
                  <TableContainer
                    sx={{
                      overflowX: 'auto',
                      border: `1px solid ${tokens.lineSoft}`,
                      borderRadius: RADIUS.control,
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
                          <TableCell sx={{ minWidth: 170 }}>Location</TableCell>
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
                            <TableCell
                              sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap', fontSize: 12.5 }}
                            >
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
                            <TableCell sx={{ maxWidth: 220 }}>{item.locationLabel}</TableCell>
                            <TableCell>{item.severity}</TableCell>
                            <TableCell>
                              <StatusBadge status={challanStatusKind(item.status)} />
                            </TableCell>
                            <TableCell sx={{ color: tokens.muted, whiteSpace: 'nowrap' }}>
                              {formatIssuedAt(item.issuedAt)}
                            </TableCell>
                            <TableCell align="right">
                              <ActionButton
                                tone="ghost"
                                size="sm"
                                aria-label={`Open ${item.challanNumber}`}
                                onClick={() => navigate(`/challans/${item.id}`)}
                              >
                                Open
                              </ActionButton>
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
            helperText={viewError ?? 'Saved for this account on this device.'}
            fullWidth
            sx={{ mt: SPACING.sm }}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton tone="ghost" size="sm" onClick={() => setSaveViewOpen(false)}>
            Cancel
          </ActionButton>
          <ActionButton tone="primary" onClick={saveCurrentView}>
            Save view
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
