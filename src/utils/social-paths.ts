export function seasonPath(season: { slug: string }): string {
  return `/events/social/seasons/${season.slug}`;
}

export function roundPath(season: { slug: string }, roundNumber: number): string {
  return `${seasonPath(season)}/rounds/${roundNumber}`;
}
