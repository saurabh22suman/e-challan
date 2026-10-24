import type { ChallanTrendResponse } from '@echallan/contracts';

/**
 * Trend range helpers (docs/design.md §8).
 *
 * The API defines its window in Asia/Kolkata calendar dates. The browser must
 * not derive those dates from the machine timezone, so the "today" boundary is
 * formatted explicitly with `Intl` in Asia/Kolkata and date arithmetic is done
 * on the calendar date (UTC midnight), not on local instants.
 */

export const TREND_TIMEZONE = 'Asia/Kolkata' as const;

export type TrendPreset = 7 | 30 | 90;

export interface TrendRequest {
  from: string;
  to: string;
  granularity: ChallanTrendResponse['granularity'];
}

const KOLKATA_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: TREND_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

function datePart(parts: Intl.DateTimeFormatPart[], type: 'day' | 'month' | 'year'): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

/** Today's Asia/Kolkata calendar date as `YYYY-MM-DD`. */
export function kolkataIsoDate(now: Date = new Date()): string {
  const parts = KOLKATA_DATE_FORMAT.formatToParts(now);
  return `${datePart(parts, 'year')}-${datePart(parts, 'month')}-${datePart(parts, 'day')}`;
}

/** Add whole days to a `YYYY-MM-DD` calendar date without touching local time. */
export function addIsoDays(date: string, days: number): string {
  const match = ISO_DATE_PATTERN.exec(date);
  if (match === null) throw new Error(`Invalid ISO date: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Request parameters for a preset. Ranges are inclusive: the 30-day preset is
 * today plus the preceding 29 Kolkata calendar days, matching the API default.
 * Weekly buckets are used only for the 90-day preset.
 */
export function trendRequestForPreset(preset: TrendPreset, now: Date = new Date()): TrendRequest {
  const to = kolkataIsoDate(now);
  return {
    from: addIsoDays(to, -(preset - 1)),
    to,
    granularity: preset === 90 ? 'week' : 'day',
  };
}

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Stable, locale-independent display label. The calendar date itself came from
 * the API or from the Intl-based Kolkata helper above; month names are explicit
 * so ICU version differences cannot change labels in tests or screenshots.
 */
export function formatTrendDay(date: string): string {
  const match = ISO_DATE_PATTERN.exec(date);
  if (match === null) throw new Error(`Invalid ISO date: ${date}`);
  const month = MONTH_ABBREVIATIONS[Number(match[2]) - 1];
  if (month === undefined) throw new Error(`Invalid ISO date: ${date}`);
  return `${Number(match[3])} ${month} ${match[1]}`;
}

export function formatTrendBucket(
  date: string,
  granularity: ChallanTrendResponse['granularity'],
): string {
  const day = formatTrendDay(date);
  return granularity === 'week' ? `Week of ${day}` : day;
}

/** Compact axis label (`24 Oct`), without relying on locale month spellings. */
export function formatTrendAxisDay(date: string): string {
  const match = ISO_DATE_PATTERN.exec(date);
  if (match === null) throw new Error(`Invalid ISO date: ${date}`);
  const month = MONTH_ABBREVIATIONS[Number(match[2]) - 1];
  if (month === undefined) throw new Error(`Invalid ISO date: ${date}`);
  return `${Number(match[3])} ${month}`;
}

/** Period text derived only from the API response, never from the client request. */
export function trendPeriodLabel(response: ChallanTrendResponse): string {
  const cadence = response.granularity === 'week' ? 'weekly buckets' : 'daily buckets';
  return `${formatTrendDay(response.from)} to ${formatTrendDay(response.to)} (${cadence}, ${response.timezone})`;
}

export function trendChartSummary(response: ChallanTrendResponse): string {
  return (
    `Challan trend from ${formatTrendDay(response.from)} to ${formatTrendDay(response.to)}. ` +
    `Issued ${response.totals.issued}, resolved ${response.totals.resolved}, ` +
    `cancelled ${response.totals.cancelled}.`
  );
}

export function hasTrendActivity(response: ChallanTrendResponse): boolean {
  return response.totals.issued + response.totals.resolved + response.totals.cancelled > 0;
}
