import { Temporal } from '@js-temporal/polyfill';

// CTB (closest to the basket) prizes for a social day: each is played on one
// hole, by a group of divisions.
export interface CtbPrize {
  hole?: number;
  divisions: string[];
}

/** Divisions that appear in more than one CTB prize, in first-seen order. */
export function ctbOverlaps(prizes: CtbPrize[]): string[] {
  const seen = new Set<string>();
  const overlaps = new Set<string>();
  for (const prize of prizes) {
    for (const division of new Set(prize.divisions)) {
      if (seen.has(division)) overlaps.add(division);
      seen.add(division);
    }
  }
  return [...overlaps];
}

/** A prize's label, e.g. "Div A/B/X/Z". */
export function ctbLabel(prize: CtbPrize): string {
  return `Div ${prize.divisions.join('/')}`;
}

/** Today in Melbourne (YYYY-MM-DD), or CTB_TODAY if set, to simulate another day. */
export function ctbToday(): string {
  return process.env.CTB_TODAY
    ?? Temporal.Now.plainDateISO('Australia/Melbourne').toString();
}

/** The social day CTB claims are for: today's, or else the next one. */
export function ctbRoundFor<T extends { date: string }>(days: T[], today: string): T | undefined {
  return days
    .filter((day) => day.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** An anchor for a prize's claim form, e.g. "ctb-div-abxz". */
export function ctbAnchor(prize: CtbPrize): string {
  return `ctb-div-${prize.divisions.join('').toLowerCase()}`;
}
