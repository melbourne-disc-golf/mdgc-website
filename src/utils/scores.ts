// Hole-score categories, as on a disc golf scorecard. Each has a matching
// .score-<category> class in global.css for its colours.

export const scoreCategories = ['ace', 'eagle', 'birdie', 'par', 'bogey', 'double-plus'] as const;

export type ScoreCategory = (typeof scoreCategories)[number];

export const scoreCategoryLabels: Record<ScoreCategory, string> = {
  ace: 'Ace',
  eagle: 'Eagle',
  birdie: 'Birdie',
  par: 'Par',
  bogey: 'Bogey',
  'double-plus': 'Double+',
};

export function scoreCategory(score: number, par: number): ScoreCategory {
  if (score === 1) return 'ace';
  const diff = score - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double-plus';
}
