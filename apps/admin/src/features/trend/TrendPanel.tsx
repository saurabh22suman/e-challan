import { useEffect, useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { ChallanTrendResponse, ChallanTrendTotals } from '@echallan/contracts';
import {
  ActionButton,
  Notice,
  SPACING,
  StatusBadge,
  tokens,
  type StatusKind,
  type ToneStyle,
} from '@echallan/theme';
import { getChallanTrend, OperationsApiError } from '../../api/operations';
import TrendChart from './TrendChart';
import {
  formatTrendBucket,
  formatTrendDay,
  hasTrendActivity,
  trendChartSummary,
  trendPeriodLabel,
  trendRequestForPreset,
  type TrendPreset,
} from './trendData';

/**
 * Supervisor/Admin challan trend (docs/design.md §8).
 *
 * The server owns aggregation and scope. This panel only chooses an Asia/Kolkata
 * calendar window and renders exactly the returned points and totals; a zero
 * total is shown as an honest empty state, never as fabricated chart data.
 */

const PRESETS: readonly TrendPreset[] = [7, 30, 90];

type SeriesKey = keyof ChallanTrendTotals;

interface SeriesMeta {
  key: SeriesKey;
  label: string;
  status: StatusKind;
  tone: ToneStyle;
}

const SERIES: readonly SeriesMeta[] = [
  { key: 'issued', label: 'Issued', status: 'issued', tone: tokens.tone.info },
  { key: 'resolved', label: 'Resolved', status: 'resolved', tone: tokens.tone.success },
  { key: 'cancelled', label: 'Cancelled', status: 'cancelled', tone: tokens.tone.cancelled },
];

function TrendTotals({ totals }: { totals: ChallanTrendTotals }) {
  return (
    <Stack
      component="section"
      aria-label="Trend totals"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={SPACING.md}
    >
      {SERIES.map(({ key, status, tone }) => (
        <Card
          key={key}
          variant="outlined"
          sx={{
            flex: 1,
            backgroundColor: tone.bg,
            borderColor: tone.border,
          }}
        >
          <CardContent sx={{ '&:last-child': { paddingBottom: SPACING.md } }}>
            <Stack spacing={SPACING.xs} sx={{ alignItems: 'flex-start' }}>
              <StatusBadge status={status} />
              <Typography
                component="p"
                variant="h2"
                data-testid={`trend-total-${key}`}
                sx={{ color: tone.fg }}
              >
                {totals[key]}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function ChartLegend() {
  return (
    <Stack
      component="ul"
      aria-label="Chart legend"
      direction="row"
      spacing={SPACING.lg}
      sx={{ listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap', rowGap: SPACING.xs }}
    >
      {SERIES.map(({ key, label, tone }) => (
        <Stack
          component="li"
          key={key}
          direction="row"
          spacing={SPACING.xs}
          sx={{ alignItems: 'center' }}
        >
          <Box
            component="span"
            aria-hidden="true"
            sx={{
              width: 18,
              height: 0,
              borderTop: `3px ${key === 'cancelled' ? 'dashed' : 'solid'} ${tone.fg}`,
            }}
          />
          <Typography variant="body2">{label}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function TrendTable({ trend }: { trend: ChallanTrendResponse }) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Challan trend data">
        <TableHead>
          <TableRow>
            <TableCell>Bucket</TableCell>
            <TableCell align="right">Issued</TableCell>
            <TableCell align="right">Resolved</TableCell>
            <TableCell align="right">Cancelled</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {trend.points.map((point) => (
            <TableRow key={point.bucketStart}>
              <TableCell>
                <time dateTime={point.bucketStart}>
                  {formatTrendBucket(point.bucketStart, trend.granularity)}
                </time>
              </TableCell>
              <TableCell align="right">{point.issued}</TableCell>
              <TableCell align="right">{point.resolved}</TableCell>
              <TableCell align="right">{point.cancelled}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function TrendPanel({ token }: { token: string }) {
  const [preset, setPreset] = useState<TrendPreset>(30);
  const [requestVersion, setRequestVersion] = useState(0);
  const [trend, setTrend] = useState<ChallanTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'chart' | 'table'>('chart');

  useEffect(() => {
    const query = trendRequestForPreset(preset);
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTrend(null);

    getChallanTrend(token, query)
      .then((resolved) => {
        if (!cancelled) setTrend(resolved);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(
          failure instanceof OperationsApiError
            ? failure.message
            : 'The trend could not be loaded. Try again.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, preset, requestVersion]);

  const selectPreset = (_event: MouseEvent<HTMLElement>, value: TrendPreset | null): void => {
    if (value !== null && value !== preset) {
      setPreset(value);
      setView('chart');
    }
  };

  const activity = trend !== null && hasTrendActivity(trend);

  return (
    <Stack
      component="section"
      aria-labelledby="trend-title"
      aria-busy={loading}
      spacing={SPACING.lg}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={SPACING.md}
        sx={{ alignItems: { md: 'flex-start' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography id="trend-title" component="h2" variant="h2">
            Challan trend
          </Typography>
          <Typography variant="body1" sx={{ color: tokens.muted, mt: SPACING.xs }}>
            Issued, resolved and cancelled events in your authorised locations, using Asia/Kolkata
            calendar days.
          </Typography>
          {trend !== null && (
            <Typography
              variant="body2"
              data-testid="trend-period"
              sx={{ color: tokens.muted, mt: SPACING.xs }}
            >
              {trendPeriodLabel(trend)}
            </Typography>
          )}
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={preset}
          onChange={selectPreset}
          aria-label="Trend range"
        >
          {PRESETS.map((days) => (
            <ToggleButton key={days} value={days}>
              {days} days
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {loading && (
        <Box
          role="status"
          aria-live="polite"
          sx={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, py: SPACING.lg }}
        >
          <CircularProgress size={24} aria-label="Loading trend" />
          <Typography variant="body1">Loading trend…</Typography>
        </Box>
      )}

      {!loading && error !== null && (
        <Notice tone="danger" role="alert">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={SPACING.md}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
          >
            <Box>{error}</Box>
            <ActionButton
              size="sm"
              tone="secondary"
              onClick={() => setRequestVersion((value) => value + 1)}
              sx={{ color: 'inherit', borderColor: 'currentColor' }}
            >
              Retry
            </ActionButton>
          </Stack>
        </Notice>
      )}

      {!loading && trend !== null && (
        <>
          <TrendTotals totals={trend.totals} />

          {activity ? (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={SPACING.md}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={SPACING.md}
                    sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography component="h3" variant="h3">
                        Activity by {trend.granularity}
                      </Typography>
                      <Typography variant="body2" sx={{ color: tokens.muted }}>
                        {formatTrendDay(trend.from)} to {formatTrendDay(trend.to)}
                      </Typography>
                    </Box>
                    <ActionButton
                      size="sm"
                      tone="secondary"
                      onClick={() =>
                        setView((current) => (current === 'chart' ? 'table' : 'chart'))
                      }
                    >
                      {view === 'chart' ? 'View as table' : 'View as chart'}
                    </ActionButton>
                  </Stack>

                  {view === 'chart' ? (
                    <>
                      <ChartLegend />
                      <TrendChart points={trend.points} summary={trendChartSummary(trend)} />
                    </>
                  ) : (
                    <TrendTable trend={trend} />
                  )}
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Notice tone="neutral" role="status">
              No issued, resolved or cancelled challans were recorded from{' '}
              {formatTrendDay(trend.from)} to {formatTrendDay(trend.to)}.
            </Notice>
          )}
        </>
      )}
    </Stack>
  );
}
