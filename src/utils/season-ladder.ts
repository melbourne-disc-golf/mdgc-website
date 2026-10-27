// A season's points ladder, and the club champs qualification ladder for each
// division, derived from Metrix results.
//
// Rules (as mdgc-sd.vercel.app/results/club-champs describes them):
// - Each round, players get points for their raw-score finish across the whole
//   field: first gets 100, and each place after drops by 100 / field size.
//   Tied players share the points for their shared position.
// - A player's total is their best eight results.
// - A player's division is their most-played of A to D; equal attendance goes
//   down a division.
// - Only members who have played the minimum rounds are eligible, and the line
//   sits after the division's allocated places, counting only them. (mdgc-sd
//   also counts members short of the minimum, when placing the line.)
//
// Unlike mdgc-sd, which also has the club's membership list, this works only
// from Metrix: a player is a non-member if they were in Div Z in their latest
// round. It has no Female division either.

import type { EventDetail, Player } from './metrix';

export interface LadderEntry {
  userId: string;
  name: string; // from their latest round
  division: string | null; // most-played of A to D; null if they've played none
  member: boolean; // false if in Div Z in their latest round
  rounds: number;
  points: number; // best eight results
}

export interface DivisionLadderRow {
  entry: LadderEntry;
  eligible: boolean; // has played the minimum rounds
  position: number | null; // among eligible players, with tied points sharing a position
  inPlaces: boolean; // eligible, and at or above the line
}

const COUNTING_RESULTS = 8;
const LADDER_DIVISIONS = ['A', 'B', 'C', 'D'];

// Totals are sums of fractions, so compare them to the displayed precision.
function samePoints(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

function isComplete(player: Player): boolean {
  return player.holes.length > 0 && player.holes.every((h) => h !== null);
}

/** Each player's points for a round, by Metrix user id. */
export function roundPoints(round: EventDetail): Map<string, number> {
  const players = round.divisions.flatMap((d) => d.players).filter(isComplete);
  const field = players.length;
  const points = new Map<string, number>();
  for (const p of players) {
    const position = 1 + players.filter((o) => o.sum < p.sum).length;
    points.set(p.userId, (100 * (field - position + 1)) / field);
  }
  return points;
}

/** The most-played of divisions A to D, going down a division on equal counts; null if none. */
export function ladderDivision(counts: Record<string, number>): string | null {
  let best: string | null = null;
  for (const d of [...LADDER_DIVISIONS].reverse()) {
    if ((counts[d] ?? 0) > (best ? counts[best] ?? 0 : 0)) best = d;
  }
  return best;
}

/** Every player in the season's rounds, highest points first. */
export function seasonLadder(rounds: EventDetail[]): LadderEntry[] {
  const players = new Map<string, { name: string; latest: Player; counts: Record<string, number>; results: number[] }>();
  const ordered = [...rounds].sort((a, b) => a.number - b.number);
  for (const round of ordered) {
    const points = roundPoints(round);
    for (const p of round.divisions.flatMap((d) => d.players)) {
      const result = points.get(p.userId);
      if (result === undefined) continue;
      const acc = players.get(p.userId) ?? { name: p.name, latest: p, counts: {}, results: [] };
      acc.name = p.name;
      acc.latest = p;
      acc.counts[p.division] = (acc.counts[p.division] ?? 0) + 1;
      acc.results.push(result);
      players.set(p.userId, acc);
    }
  }

  return [...players.entries()]
    .map(([userId, acc]) => ({
      userId,
      name: acc.name,
      division: ladderDivision(acc.counts),
      member: acc.latest.division !== 'Z',
      rounds: acc.results.length,
      points: [...acc.results]
        .sort((a, b) => b - a)
        .slice(0, COUNTING_RESULTS)
        .reduce((sum, r) => sum + r, 0),
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

/**
 * A division's qualification ladder: its members, with the line after
 * `places`. Only those who have played the minimum rounds are eligible, and
 * only they get a position. Those in the places come first, then everyone
 * else, by points.
 */
export function divisionLadder(
  ladder: LadderEntry[],
  division: string,
  { places, minimumRounds }: { places: number; minimumRounds: number },
): DivisionLadderRow[] {
  const entries = ladder.filter((e) => e.member && e.division === division);
  const eligible = entries.filter((e) => e.rounds >= minimumRounds);
  const rows = entries.map((entry): DivisionLadderRow => {
    if (entry.rounds < minimumRounds) return { entry, eligible: false, position: null, inPlaces: false };
    const position = 1 + eligible.filter((o) => o.points > entry.points && !samePoints(o.points, entry.points)).length;
    return { entry, eligible: true, position, inPlaces: position <= places };
  });
  return [...rows.filter((r) => r.inPlaces), ...rows.filter((r) => !r.inPlaces)];
}
