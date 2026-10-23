// Season-wide statistics, derived from a season's played rounds.
//
// Rules (kept consistent with mdgc-sd.vercel.app where it has a rule):
// - Every scored hole counts in the scoring mix, even from an incomplete scorecard.
// - Only complete scorecards count towards to-par averages and best rounds.
// - Players are identified by Metrix user id, and shown by their latest name.
// - Best rounds are ranked by score to par, then raw score.

import type { EventDetail } from './metrix';
import { scoreCategories, scoreCategory, type ScoreCategory } from './scores';

export type ScoreCounts = Record<ScoreCategory, number>;

export interface RoundStats {
  id: number;
  number: number;
  date: string;
  courseId: string;
  courseTitle: string;
  players: number;
  averageToPar: number | null;
  bestToPar: number | null;
  scoreCounts: ScoreCounts;
}

export interface BestRound {
  userId: string;
  name: string;
  division: string;
  roundId: number;
  roundNumber: number;
  courseId: string;
  courseTitle: string;
  toPar: number;
  raw: number;
}

export interface PlayerProfile {
  userId: string;
  name: string;
  division: string; // from their latest round
  rating: number | null; // from their latest round
  rounds: number;
  scoreCounts: ScoreCounts;
  averageToPar: number | null;
  bestToPar: number | null;
}

export interface SeasonStats {
  roundsPlayed: number;
  playerRounds: number;
  averageField: number | null;
  uniquePlayers: number;
  holesScored: number;
  scoreCounts: ScoreCounts;
  rounds: RoundStats[];
  bestRounds: BestRound[];
  players: PlayerProfile[];
}

const BEST_ROUNDS = 10;

/** Divisions that get their own stats view; X and Z count only towards the whole season. */
export const statsDivisions = ['A', 'B', 'C', 'D'];

export function emptyScoreCounts(): ScoreCounts {
  return Object.fromEntries(scoreCategories.map((c) => [c, 0])) as ScoreCounts;
}

export function totalScores(counts: ScoreCounts): number {
  return scoreCategories.reduce((sum, c) => sum + counts[c], 0);
}

/** A count as a share of a total, e.g. "12.5%", "<0.1%", or "–" for no total. */
export function formatShare(count: number, total: number): string {
  if (!total) return '–';
  if (count === 0) return '0%';
  const value = (100 * count) / total;
  return value < 0.05 ? '<0.1%' : `${value.toFixed(1)}%`;
}

/** Aces, eagles and birdies. */
export function birdiesOrBetter(counts: ScoreCounts): number {
  return counts.ace + counts.eagle + counts.birdie;
}

/** Drop the disambiguating number Metrix sometimes appends, e.g. "Chris Scott 127348". */
export function cleanPlayerName(name: string): string {
  return name.replace(/\s+\d{4,}$/, '').trim();
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

interface PlayerAccumulator {
  userId: string;
  name: string;
  rounds: number;
  scoreCounts: ScoreCounts;
  toPars: number[];
  division: string;
  rating: number | null;
  latestRound: number;
}

/**
 * The rounds as played in one division: only scorecards in that division,
 * and only rounds where someone played in it.
 */
export function roundsInDivision(rounds: EventDetail[], letter: string): EventDetail[] {
  return rounds
    .map((round) => ({
      ...round,
      divisions: round.divisions
        .map((d) => ({ ...d, players: d.players.filter((p) => p.division === letter) }))
        .filter((d) => d.players.length > 0),
    }))
    .filter((round) => round.divisions.length > 0);
}

export function seasonStats(playedRounds: EventDetail[]): SeasonStats {
  const rounds = [...playedRounds].sort((a, b) => a.number - b.number);
  const seasonCounts = emptyScoreCounts();
  const roundStats: RoundStats[] = [];
  const bestRounds: BestRound[] = [];
  const players = new Map<string, PlayerAccumulator>();
  let playerRounds = 0;

  for (const round of rounds) {
    const roundCounts = emptyScoreCounts();
    const roundToPars: number[] = [];
    const scorecards = round.divisions.flatMap((d) => d.players);

    for (const p of scorecards) {
      playerRounds++;
      const counts = emptyScoreCounts();
      p.holes.forEach((score, i) => {
        if (score === null) return;
        counts[scoreCategory(score, round.tracks[i]?.par ?? 0)]++;
      });
      const complete = p.holes.length === round.tracks.length && p.holes.every((h) => h !== null);

      for (const c of scoreCategories) {
        roundCounts[c] += counts[c];
        seasonCounts[c] += counts[c];
      }

      const acc: PlayerAccumulator = players.get(p.userId) ?? {
        userId: p.userId,
        name: p.name,
        rounds: 0,
        scoreCounts: emptyScoreCounts(),
        toPars: [],
        division: p.division,
        rating: null,
        latestRound: 0,
      };
      acc.name = p.name;
      acc.rounds++;
      for (const c of scoreCategories) acc.scoreCounts[c] += counts[c];
      if (round.number >= acc.latestRound) {
        acc.division = p.division;
        acc.rating = p.rating;
        acc.latestRound = round.number;
      }
      players.set(p.userId, acc);

      if (complete) {
        roundToPars.push(p.diff);
        acc.toPars.push(p.diff);
        bestRounds.push({
          userId: p.userId,
          name: cleanPlayerName(p.name),
          division: p.division,
          roundId: round.id,
          roundNumber: round.number,
          courseId: round.courseId,
          courseTitle: round.courseTitle,
          toPar: p.diff,
          raw: p.sum,
        });
      }
    }

    roundStats.push({
      id: round.id,
      number: round.number,
      date: round.date,
      courseId: round.courseId,
      courseTitle: round.courseTitle,
      players: scorecards.length,
      averageToPar: average(roundToPars),
      bestToPar: roundToPars.length ? Math.min(...roundToPars) : null,
      scoreCounts: roundCounts,
    });
  }

  bestRounds.sort((a, b) => a.toPar - b.toPar || a.raw - b.raw);

  const profiles: PlayerProfile[] = [...players.values()].map((acc) => ({
    userId: acc.userId,
    name: cleanPlayerName(acc.name),
    division: acc.division,
    rating: acc.rating,
    rounds: acc.rounds,
    scoreCounts: acc.scoreCounts,
    averageToPar: average(acc.toPars),
    bestToPar: acc.toPars.length ? Math.min(...acc.toPars) : null,
  }));
  profiles.sort((a, b) => (a.averageToPar ?? Infinity) - (b.averageToPar ?? Infinity) || b.rounds - a.rounds);

  return {
    roundsPlayed: rounds.length,
    playerRounds,
    averageField: rounds.length ? playerRounds / rounds.length : null,
    uniquePlayers: players.size,
    holesScored: totalScores(seasonCounts),
    scoreCounts: seasonCounts,
    rounds: roundStats,
    bestRounds: bestRounds.slice(0, BEST_ROUNDS),
    players: profiles,
  };
}
