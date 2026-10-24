import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChallanTrendResponse } from '@echallan/contracts';
import { getChallanTrend, OperationsApiError } from '../api/operations';
import TrendPanel from '../features/trend/TrendPanel';
import { kolkataIsoDate, trendRequestForPreset } from '../features/trend/trendData';

/**
 * Trend tab component acceptance (docs/design.md §8).
 *
 * The API and chart are mocked so this suite can assert request parameters,
 * loading/empty/error states and the accessible table without a canvas. Real
 * API scope and aggregation are covered by the API integration suite; the
 * browser journey covers the rendered chart.
 */

vi.mock('../features/trend/TrendChart', () => ({
  default: ({ summary }: { summary: string }) => (
    <div role="img" aria-label={summary} data-testid="mock-trend-chart" />
  ),
}));

vi.mock('../api/operations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/operations')>();
  return { ...actual, getChallanTrend: vi.fn() };
});

const TOKEN = 'c'.repeat(64);
const mockedGetChallanTrend = vi.mocked(getChallanTrend);

function trendFixture(): ChallanTrendResponse {
  return {
    timezone: 'Asia/Kolkata',
    granularity: 'day',
    from: '2026-09-26',
    to: '2026-10-25',
    points: [
      { bucketStart: '2026-10-24', issued: 2, resolved: 1, cancelled: 0 },
      { bucketStart: '2026-10-25', issued: 1, resolved: 0, cancelled: 1 },
    ],
    totals: { issued: 3, resolved: 1, cancelled: 1 },
  };
}

function emptyFixture(): ChallanTrendResponse {
  return {
    ...trendFixture(),
    points: [
      { bucketStart: '2026-10-24', issued: 0, resolved: 0, cancelled: 0 },
      { bucketStart: '2026-10-25', issued: 0, resolved: 0, cancelled: 0 },
    ],
    totals: { issued: 0, resolved: 0, cancelled: 0 },
  };
}

beforeEach(() => {
  // Only Date is faked, so promises, MUI transitions and user-event keep working.
  vi.useFakeTimers({ toFake: ['Date'] });
  // 20:00 UTC is already 01:30 on the next day in Asia/Kolkata.
  vi.setSystemTime(new Date('2026-10-24T20:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Kolkata preset ranges', () => {
  it('derives inclusive 7/30/90-day windows on the Kolkata calendar', () => {
    const now = new Date('2026-10-24T20:00:00.000Z');

    expect(kolkataIsoDate(now)).toBe('2026-10-25');
    expect(trendRequestForPreset(7, now)).toEqual({
      from: '2026-10-19',
      to: '2026-10-25',
      granularity: 'day',
    });
    expect(trendRequestForPreset(30, now)).toEqual({
      from: '2026-09-26',
      to: '2026-10-25',
      granularity: 'day',
    });
    expect(trendRequestForPreset(90, now)).toEqual({
      from: '2026-07-28',
      to: '2026-10-25',
      granularity: 'week',
    });
  });
});

describe('TrendPanel', () => {
  it('shows a loading state while requesting the default 30-day daily trend', () => {
    mockedGetChallanTrend.mockReturnValue(new Promise<ChallanTrendResponse>(() => undefined));

    render(<TrendPanel token={TOKEN} />);

    expect(screen.getByRole('progressbar', { name: 'Loading trend' })).toBeInTheDocument();
    expect(mockedGetChallanTrend).toHaveBeenCalledTimes(1);
    expect(mockedGetChallanTrend).toHaveBeenCalledWith(TOKEN, {
      from: '2026-09-26',
      to: '2026-10-25',
      granularity: 'day',
    });
  });

  it('renders totals, the API period, the legend and an accessible chart summary', async () => {
    mockedGetChallanTrend.mockResolvedValue(trendFixture());

    render(<TrendPanel token={TOKEN} />);

    expect(await screen.findByTestId('trend-total-issued')).toHaveTextContent('3');
    expect(screen.getByTestId('trend-total-resolved')).toHaveTextContent('1');
    expect(screen.getByTestId('trend-total-cancelled')).toHaveTextContent('1');
    expect(screen.getByRole('status', { name: 'Issued' })).toBeInTheDocument();

    expect(screen.getByTestId('trend-period')).toHaveTextContent(
      '26 Sep 2026 to 25 Oct 2026 (daily buckets, Asia/Kolkata)',
    );

    const legend = screen.getByRole('list', { name: 'Chart legend' });
    expect(within(legend).getByText('Issued')).toBeInTheDocument();
    expect(within(legend).getByText('Resolved')).toBeInTheDocument();
    expect(within(legend).getByText('Cancelled')).toBeInTheDocument();

    expect(
      screen.getByRole('img', {
        name: /Challan trend.*Issued 3, resolved 1, cancelled 1/i,
      }),
    ).toBeInTheDocument();
  });

  it('shows an honest empty notice when every total is zero', async () => {
    mockedGetChallanTrend.mockResolvedValue(emptyFixture());

    render(<TrendPanel token={TOKEN} />);

    expect(
      await screen.findByText(
        /No issued, resolved or cancelled challans were recorded from 26 Sep 2026 to 25 Oct 2026/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('mock-trend-chart')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View as table' })).not.toBeInTheDocument();
  });

  it('shows an error notice and retries the same range', async () => {
    const user = userEvent.setup();
    mockedGetChallanTrend
      .mockRejectedValueOnce(
        new OperationsApiError(500, 'server_error', 'Trend service unavailable.'),
      )
      .mockResolvedValue(trendFixture());

    render(<TrendPanel token={TOKEN} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Trend service unavailable.');

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByTestId('trend-total-issued')).toHaveTextContent('3');
    expect(mockedGetChallanTrend).toHaveBeenCalledTimes(2);
    expect(mockedGetChallanTrend).toHaveBeenLastCalledWith(TOKEN, {
      from: '2026-09-26',
      to: '2026-10-25',
      granularity: 'day',
    });
  });

  it('requests weekly 90-day data and daily 7-day data from the presets', async () => {
    const user = userEvent.setup();
    mockedGetChallanTrend.mockImplementation(async (_token, query) => ({
      ...trendFixture(),
      granularity: query?.granularity === 'week' ? 'week' : 'day',
      from: query?.from ?? '2026-09-26',
      to: query?.to ?? '2026-10-25',
    }));

    render(<TrendPanel token={TOKEN} />);
    await screen.findByTestId('trend-total-issued');
    expect(mockedGetChallanTrend).toHaveBeenLastCalledWith(TOKEN, {
      from: '2026-09-26',
      to: '2026-10-25',
      granularity: 'day',
    });

    await user.click(screen.getByRole('button', { name: '90 days' }));
    await waitFor(() =>
      expect(mockedGetChallanTrend).toHaveBeenLastCalledWith(TOKEN, {
        from: '2026-07-28',
        to: '2026-10-25',
        granularity: 'week',
      }),
    );
    expect(await screen.findByText(/weekly buckets, Asia\/Kolkata/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '7 days' }));
    await waitFor(() =>
      expect(mockedGetChallanTrend).toHaveBeenLastCalledWith(TOKEN, {
        from: '2026-10-19',
        to: '2026-10-25',
        granularity: 'day',
      }),
    );
  });

  it('toggles between the chart and an accessible table of exactly the API points', async () => {
    const user = userEvent.setup();
    mockedGetChallanTrend.mockResolvedValue(trendFixture());

    render(<TrendPanel token={TOKEN} />);
    await screen.findByTestId('trend-total-issued');

    await user.click(screen.getByRole('button', { name: 'View as table' }));

    const table = screen.getByRole('table', { name: 'Challan trend data' });
    for (const heading of ['Bucket', 'Issued', 'Resolved', 'Cancelled']) {
      expect(within(table).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('24 Oct 2026')).toBeInTheDocument();
    expect(within(table).getByText('25 Oct 2026')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-trend-chart')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View as chart' }));
    expect(screen.getByTestId('mock-trend-chart')).toBeInTheDocument();
  });
});
