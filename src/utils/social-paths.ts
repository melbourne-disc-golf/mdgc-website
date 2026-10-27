/** A season's root, which redirects to its rounds. */
export function seasonPath(season: { slug: string }): string {
  return `/events/social/seasons/${season.slug}`;
}

/** A season's list of rounds. */
export function seasonRoundsPath(season: { slug: string }): string {
  return `${seasonPath(season)}/rounds`;
}

/** A season's stats, for all divisions or just one (by letter). */
export function seasonStatsPath(season: { slug: string }, division?: string): string {
  const base = `${seasonPath(season)}/stats`;
  return division ? `${base}/${divisionParam(division)}` : base;
}

/** A season's club champs qualification ladder. */
export function seasonLadderPath(season: { slug: string }): string {
  return `${seasonPath(season)}/ladder`;
}

export function roundPath(season: { slug: string }, roundNumber: number): string {
  return `/events/social/seasons/${season.slug}/rounds/${roundNumber}`;
}

/** The URL segment for a division page, e.g. "div/a", or undefined for all divisions. */
export function divisionParam(division?: string): string | undefined {
  return division && `div/${division.toLowerCase()}`;
}

/** Links for choosing a division ("All", then each letter), marking the current one. */
export function divisionLinks(
  divisions: readonly string[],
  current: string | undefined,
  hrefFor: (division?: string) => string,
): { text: string; href: string; current: boolean }[] {
  return [
    { text: 'All', href: hrefFor(), current: !current },
    ...divisions.map((d) => ({ text: d, href: hrefFor(d), current: d === current })),
  ];
}

/** Fragment id for a division's results on a round page, e.g. "div-A". */
export function divisionAnchor(letter: string): string {
  return `div-${/^[A-Z0-9]+$/.test(letter) ? letter : 'other'}`;
}
