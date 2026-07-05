// Build-time parsing and filtering of PDGA "tour search" result pages.
//
// Imported only by scripts/fetch-pdga-events.ts and its tests, so the HTML
// parser never reaches the shipped site. The fetch script runs parseEvents()
// over each page, keeps the events keepEvent() approves, and writes the result
// to src/data/pdga/events.json (read back by src/utils/pdga.ts).

import { parse, type HTMLElement } from 'node-html-parser';
import type { PdgaEvent } from './pdga';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

interface PartialDate {
  year?: number;
  month?: number;
  day: number;
}

function parseDatePart(part: string): PartialDate {
  const monthMatch = part.match(/([A-Za-z]+)/);
  const month = monthMatch ? MONTHS[monthMatch[1].toLowerCase()] : undefined;
  const yearMatch = part.match(/\b(\d{4})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  // The day is the first 1–2 digit number that isn't the year.
  const withoutYear = yearMatch ? part.replace(yearMatch[0], '') : part;
  const dayMatch = withoutYear.match(/\b(\d{1,2})\b/);
  return { year, month, day: dayMatch ? Number(dayMatch[1]) : 1 };
}

/**
 * Parse a PDGA date-range string into ISO start/end dates.
 *
 * PDGA writes ranges compactly, dropping repeated month/year, e.g.
 *   "July 5, 2026"                        → 2026-07-05 .. 2026-07-05
 *   "July 10 - 12, 2026"                  → 2026-07-10 .. 2026-07-12
 *   "June 21 - August 9, 2026"            → 2026-06-21 .. 2026-08-09
 *   "December 31, 2026 - January 2, 2027" → 2026-12-31 .. 2027-01-02
 *
 * The year always appears on the right; the first month always appears on the
 * left. Missing pieces are inherited across the dash.
 */
export function parseDateRange(text: string): { startDate: string; endDate: string } {
  const normalised = text.replace(/\s+/g, ' ').trim();
  const years = normalised.match(/\b(\d{4})\b/g);
  const defaultYear = years ? Number(years[years.length - 1]) : new Date().getFullYear();

  const [startStr, endStr] = normalised.split(/\s*[–-]\s*/);
  const start = parseDatePart(startStr);
  const end = endStr ? parseDatePart(endStr) : { ...start };

  // End inherits the start's month if it names only a day; start inherits the
  // end's month only in the (unusual) case it named none.
  if (end.month === undefined) end.month = start.month;
  if (start.month === undefined) start.month = end.month;

  const startYear = start.year ?? end.year ?? defaultYear;
  const endYear = end.year ?? defaultYear;

  return {
    startDate: `${startYear}-${pad2(start.month ?? 1)}-${pad2(start.day)}`,
    endDate: `${endYear}-${pad2(end.month ?? 1)}-${pad2(end.day)}`,
  };
}

function cellText(row: HTMLElement, field: string): string {
  return row.querySelector(`.views-field-${field}`)?.text.trim() ?? '';
}

/**
 * Parse all event rows out of a PDGA tour-search results page.
 *
 * Everything we need is in a stable form: the event id and tier are on the
 * row's own CSS class (`tid-105160 tier-C …`), the rest in named cells. Rows
 * without an id/tier (e.g. the header) are skipped.
 */
export function parseEvents(html: string): PdgaEvent[] {
  const root = parse(html);
  const table = root.querySelector('table.views-table');
  if (!table) return [];

  const events: PdgaEvent[] = [];
  for (const row of table.querySelectorAll('tr')) {
    const classes = row.getAttribute('class') ?? '';
    const idMatch = classes.match(/\btid-(\d+)/);
    const tierMatch = classes.match(/\btier-([A-Za-z0-9]+)/);
    if (!idMatch || !tierMatch) continue;

    const { startDate, endDate } = parseDateRange(cellText(row, 'StartDate'));
    events.push({
      name: cellText(row, 'OfficialName'),
      eventId: Number(idMatch[1]),
      tier: tierMatch[1],
      location: cellText(row, 'Location'),
      startDate,
      endDate,
    });
  }
  return events;
}

// Tier ranking, highest first. Anything not listed (leagues "L", unsanctioned
// "XA/XB/XC", etc.) ranks below C and is excluded by every regional rule.
const TIER_RANK: Record<string, number> = { M: 5, NT: 4, A: 3, B: 2, C: 1 };

function tierRank(tier: string): number {
  return TIER_RANK[tier.toUpperCase()] ?? 0;
}

/**
 * Decide whether an event is relevant to our members, by tier and region:
 *   - Victoria:            C-tier and above
 *   - rest of Australia:   B-tier and above
 *   - New Zealand:         A-tier and above
 *
 * Location is PDGA's "City, State, Country" string.
 */
export function keepEvent(event: PdgaEvent): boolean {
  const segments = event.location.split(',').map((s) => s.trim());
  const country = segments[segments.length - 1] ?? '';
  const state = segments.length >= 3 ? segments[segments.length - 2] : '';

  let minRank: number;
  if (/^Australia$/i.test(country)) {
    minRank = /^Victoria$/i.test(state) ? TIER_RANK.C : TIER_RANK.B;
  } else if (/^New Zealand$/i.test(country)) {
    minRank = TIER_RANK.A;
  } else {
    return false;
  }
  return tierRank(event.tier) >= minRank;
}
