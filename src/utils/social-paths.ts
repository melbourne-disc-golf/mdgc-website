export function seasonPath(season: { slug: string }): string {
  return `/events/social/seasons/${season.slug}`;
}

export function roundPath(season: { slug: string }, roundNumber: number): string {
  return `${seasonPath(season)}/rounds/${roundNumber}`;
}

/** Fragment id for a division's results on a round page, e.g. "div-A". */
export function divisionAnchor(letter: string): string {
  return `div-${/^[A-Z0-9]+$/.test(letter) ? letter : 'other'}`;
}
