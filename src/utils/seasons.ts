export interface SeasonDates {
  dateStart?: string; // YYYY-MM-DD
  dateEnd?: string; // YYYY-MM-DD
}

/**
 * The season in progress on `today` (a YYYY-MM-DD date), or failing that the
 * soonest season still to come; null if neither.
 */
export function currentOrNextSeason<T extends SeasonDates>(
  seasons: T[],
  today: string
): { season: T; status: 'current' | 'next' } | null {
  const dated = seasons.filter((s): s is T & { dateStart: string } => Boolean(s.dateStart));
  const current = dated.find((s) => s.dateStart <= today && (!s.dateEnd || today <= s.dateEnd));
  if (current) return { season: current, status: 'current' };

  const next = dated
    .filter((s) => s.dateStart > today)
    .sort((a, b) => a.dateStart.localeCompare(b.dateStart))[0];
  return next ? { season: next, status: 'next' } : null;
}
