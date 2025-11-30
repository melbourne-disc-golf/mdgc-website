/**
 * Format a date range for display.
 *
 * Examples:
 * - Single day: "14 December, 2025"
 * - Same month: "14-18 December, 2025"
 * - Different months: "30 June - 2 July, 2025"
 * - Different years: "30 December, 2025 - 2 January, 2026"
 */
export function formatDateRange(startDate: Date, endDate?: Date): string {
  const formatOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };

  const addComma = (s: string) => s.replace(/ (\d{4})$/, ', $1');

  if (!endDate || startDate.getTime() === endDate.getTime()) {
    return addComma(startDate.toLocaleDateString('en-AU', formatOptions));
  }

  const sameMonth =
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear();
  const sameYear = startDate.getFullYear() === endDate.getFullYear();

  if (sameMonth) {
    const endFormatted = endDate.toLocaleDateString('en-AU', formatOptions);
    return `${startDate.getDate()}-${addComma(endFormatted)}`;
  } else if (sameYear) {
    const startFormatted = startDate.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
    });
    const endFormatted = endDate.toLocaleDateString('en-AU', formatOptions);
    return `${startFormatted} - ${addComma(endFormatted)}`;
  } else {
    const startFormatted = addComma(startDate.toLocaleDateString('en-AU', formatOptions));
    const endFormatted = addComma(endDate.toLocaleDateString('en-AU', formatOptions));
    return `${startFormatted} - ${endFormatted}`;
  }
}
