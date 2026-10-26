import { birdiesOrBetter, totalScores, type ScoreCounts } from './season-stats';

/** A score relative to par, e.g. "+3", "-2" or "E" (even). */
export function formatToPar(value: number | null, digits = 0): string {
  if (value === null) return '–';
  const text = value.toFixed(digits);
  if (Number(text) === 0) return 'E';
  return value > 0 ? `+${text}` : text;
}

// Heat colours for stats tables (see .heat-* in global.css), using mdgc-sd's thresholds.

/** Shade a score to par: green at or under par, through to red well over. */
export function toParHeat(value: number | null): string {
  if (value === null) return '';
  if (value <= 0) return 'heat-good-4';
  if (value <= 3) return 'heat-good-2';
  if (value <= 6) return 'heat-warn-2';
  if (value <= 9) return 'heat-bad-2';
  return 'heat-bad-4';
}

/** Shade a percentage: one level per threshold reached, from 1 to 4. */
export function percentHeat(kind: string, count: number, total: number, thresholds: number[]): string {
  if (!total) return '';
  const pct = (100 * count) / total;
  const level = Math.min(4, Math.max(1, thresholds.filter((t) => pct >= t).length));
  return `heat-${kind}-${level}`;
}

export function birdieHeat(counts: ScoreCounts): string {
  return percentHeat('good', birdiesOrBetter(counts), totalScores(counts), [8, 16, 24, 32]);
}

/** Shade a count by its fraction of a maximum, in quarters. */
export function fractionHeat(value: number, max: number): string {
  const level = Math.min(4, Math.max(1, Math.floor((4 * value) / max)));
  return `heat-neutral-${level}`;
}
