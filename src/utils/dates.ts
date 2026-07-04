import { Temporal } from '@js-temporal/polyfill';

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a single date for display, e.g. "14 December, 2025" (long) or
 * "14 Dec, 2025" (short).
 */
export function formatDate(
  date: Temporal.PlainDate,
  format: 'long' | 'short' = 'long',
): string {
  const months = format === 'long' ? MONTHS_LONG : MONTHS_SHORT;
  return `${date.day} ${months[date.month - 1]}, ${date.year}`;
}

/**
 * Format a date range for display.
 *
 * Examples (long format, default):
 * - Single day: "14 December, 2025"
 * - Same month: "14-18 December, 2025"
 * - Different months: "30 June - 2 July, 2025"
 * - Different years: "30 December, 2025 - 2 January, 2026"
 *
 * Examples (short format):
 * - Single day: "14 Dec, 2025"
 * - Same month: "14-18 Dec, 2025"
 * - Different months: "30 Jun - 2 Jul, 2025"
 * - Different years: "30 Dec, 2025 - 2 Jan, 2026"
 */
export function formatDateRange(
  startDate: Temporal.PlainDate,
  endDate?: Temporal.PlainDate,
  format: 'long' | 'short' = 'long',
): string {
  const months = format === 'long' ? MONTHS_LONG : MONTHS_SHORT;

  if (!endDate || Temporal.PlainDate.compare(startDate, endDate) === 0) {
    return formatDate(startDate, format);
  }

  const sameMonth = startDate.month === endDate.month && startDate.year === endDate.year;
  const sameYear = startDate.year === endDate.year;

  if (sameMonth) {
    return `${startDate.day}-${formatDate(endDate, format)}`;
  } else if (sameYear) {
    return `${startDate.day} ${months[startDate.month - 1]} - ${formatDate(endDate, format)}`;
  } else {
    return `${formatDate(startDate, format)} - ${formatDate(endDate, format)}`;
  }
}
