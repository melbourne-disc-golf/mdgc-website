import { describe, it, expect } from 'vitest';
import type { EventDetail, Player } from './metrix';
import { roundsInDivision, seasonStats } from './season-stats';

// A three-hole course: par 3, 3, 4 (par 10).
const tracks = [
  { number: '1', par: 3 },
  { number: '2', par: 3 },
  { number: '3', par: 4 },
];

function player(userId: string, name: string, division: string, holes: (number | null)[]): Player {
  const sum = holes.reduce<number>((total, h) => total + (h ?? 0), 0);
  return {
    userId,
    name,
    group: null,
    division,
    divisionName: `Div ${division}`,
    rating: null,
    holes,
    sum,
    diff: sum - 10,
    hc: null,
    net: null,
    pos: 0,
  };
}

function round(id: number, number: number, players: Player[]): EventDetail {
  return {
    id,
    seasonId: 1,
    number,
    name: `Round ${number}`,
    date: `2026-07-0${number}`,
    courseName: 'Test Park',
    courseId: 'c1',
    holeCount: 3,
    par: 10,
    tracks,
    divisions: [{ letter: 'A', name: 'Div A', label: 'Div A', description: null, players }],
  };
}

const rounds = [
  round(101, 1, [
    player('1', 'Alice', 'A', [2, 3, 4]), // -1: birdie, par, par
    player('2', 'Bob', 'B', [3, 4, 6]), // +3: par, bogey, double+
  ]),
  round(102, 2, [
    player('1', 'Alice 123456', 'A', [1, 3, 2]), // -4: ace, par, eagle
    player('3', 'Carol', 'C', [3, null, 4]), // incomplete
  ]),
];

describe('seasonStats', () => {
  const stats = seasonStats(rounds);

  it('summarises the season', () => {
    expect(stats.roundsPlayed).toBe(2);
    expect(stats.playerRounds).toBe(4);
    expect(stats.averageField).toBe(2);
    expect(stats.uniquePlayers).toBe(3);
    expect(stats.holesScored).toBe(11);
  });

  it('counts every scored hole by category, including incomplete rounds', () => {
    expect(stats.scoreCounts).toEqual({
      ace: 1,
      eagle: 1,
      birdie: 1,
      par: 6,
      bogey: 1,
      'double-plus': 1,
    });
  });

  it('summarises each round, averaging only complete scorecards', () => {
    expect(stats.rounds.map((r) => [r.number, r.players, r.averageToPar])).toEqual([
      [1, 2, 1],
      [2, 2, -4],
    ]);
  });

  it('ranks the best rounds by score to par, then raw score, leaving out incomplete ones', () => {
    expect(stats.bestRounds.map((r) => [r.userId, r.roundNumber, r.toPar])).toEqual([
      ['1', 2, -4],
      ['1', 1, -1],
      ['2', 1, 3],
    ]);
  });

  it('profiles each player by Metrix id, using their latest name, without the trailing number', () => {
    const alice = stats.players.find((p) => p.userId === '1');
    expect(alice).toMatchObject({ name: 'Alice', rounds: 2, averageToPar: -2.5, bestToPar: -4, division: 'A' });
    expect(alice?.scoreCounts.ace).toBe(1);
  });

  it('gives a player with only incomplete rounds no average or best', () => {
    const carol = stats.players.find((p) => p.userId === '3');
    expect(carol).toMatchObject({ rounds: 1, averageToPar: null, bestToPar: null });
  });

  it('lists the most regular players first', () => {
    expect(stats.players[0].userId).toBe('1');
  });

  it("uses a player's most-played division, breaking ties by the latest round", () => {
    const moves = seasonStats([
      round(201, 1, [player('9', 'Dee', 'C', [3, 3, 4])]),
      round(202, 2, [player('9', 'Dee', 'B', [3, 3, 4])]),
    ]);
    expect(moves.players[0].division).toBe('B');
  });

  it('copes with a season with no rounds played', () => {
    const empty = seasonStats([]);
    expect(empty.roundsPlayed).toBe(0);
    expect(empty.averageField).toBeNull();
    expect(empty.players).toEqual([]);
  });
});

describe('roundsInDivision', () => {
  it('keeps only scorecards played in that division', () => {
    const filtered = roundsInDivision(rounds, 'A');
    expect(filtered.map((r) => r.divisions.flatMap((d) => d.players.map((p) => p.userId)))).toEqual([['1'], ['1']]);
  });

  it('drops rounds with no one in that division', () => {
    expect(roundsInDivision(rounds, 'B').map((r) => r.number)).toEqual([1]);
  });

  it('feeds seasonStats, so a player is profiled from their rounds in that division only', () => {
    const stats = seasonStats(roundsInDivision(rounds, 'C'));
    expect(stats.roundsPlayed).toBe(1);
    expect(stats.players.map((p) => [p.userId, p.rounds])).toEqual([['3', 1]]);
  });
});
