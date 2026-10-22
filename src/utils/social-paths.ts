export function seasonPath(season: { slug: string }): string {
  return `/events/social/seasons/${season.slug}`;
}

export function roundPath(season: { slug: string }, roundNumber: number): string {
  return `${seasonPath(season)}/rounds/${roundNumber}`;
}

/** Season stats, for all divisions or just one (by letter). */
export function statsPath(season: { slug: string }, division?: string): string {
  const base = `${seasonPath(season)}/stats`;
  return division ? `${base}/div-${division.toLowerCase()}` : base;
}

/** Fragment id for a division's results on a round page, e.g. "div-A". */
export function divisionAnchor(letter: string): string {
  return `div-${/^[A-Z0-9]+$/.test(letter) ? letter : 'other'}`;
}
