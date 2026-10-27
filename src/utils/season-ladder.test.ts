import { describe, it, expect } from 'vitest';
import type { EventDetail, Player } from './metrix';
import { divisionLadder, ladderDivision, roundPoints, seasonLadder } from './season-ladder';

function player(userId: string, division: string, sum: number, holes: (number | null)[] = [sum]): Player {
  return {
    userId,
    name: `Player ${userId}`,
    group: null,
    division,
    divisionName: `Div ${division}`,
    rating: null,
    holes,
    sum,
    diff: 0,
    hc: null,
    net: null,
    pos: 0,
  };
}

function round(number: number, players: Player[]): EventDetail {
  return {
    id: 100 + number,
    seasonId: 1,
    number,
    name: `Round ${number}`,
    title: `Round ${number} - Test Park`,
    date: `2026-07-${String(number).padStart(2, '0')}`,
    courseName: 'Test Park',
    courseId: 'c1',
    courseTitle: 'Test Park',
    holeCount: 1,
    par: 50,
    tracks: [{ number: '1', par: 50 }],
    // Divisions as Metrix groups them; points ignore the grouping.
    divisions: [{ letter: 'A', name: 'Div A', label: 'Div A', description: null, players }],
  };
}

describe('roundPoints', () => {
  it('gives first 100, and spaces the rest by 100 / field size, across all divisions', () => {
    const points = roundPoints(round(1, [player('1', 'A', 50), player('2', 'C', 52), player('3', 'Z', 55), player('4', 'D', 60)]));
    expect(points.get('1')).toBe(100);
    expect(points.get('2')).toBe(75);
    expect(points.get('3')).toBe(50);
    expect(points.get('4')).toBe(25);
  });

  it('gives tied players the points for their shared position', () => {
    const points = roundPoints(round(1, [player('1', 'A', 50), player('2', 'B', 52), player('3', 'B', 52), player('4', 'C', 60)]));
    expect(points.get('2')).toBe(75);
    expect(points.get('3')).toBe(75);
    expect(points.get('4')).toBe(25);
  });

  it('leaves out incomplete scorecards, which also leaves them out of the field size', () => {
    const points = roundPoints(round(1, [player('1', 'A', 50), player('2', 'B', 40, [40, null]), player('3', 'C', 60)]));
    expect(points.has('2')).toBe(false);
    expect(points.get('3')).toBe(50);
  });
});

describe('ladderDivision', () => {
  it('is the most-played of A to D', () => {
    expect(ladderDivision({ A: 1, B: 3, C: 2 })).toBe('B');
  });

  it('goes down a division when attendance is equal', () => {
    expect(ladderDivision({ A: 2, B: 2 })).toBe('B');
    expect(ladderDivision({ C: 1, D: 1 })).toBe('D');
  });

  it('ignores X and Z, and is null without any A to D rounds', () => {
    expect(ladderDivision({ A: 1, X: 4 })).toBe('A');
    expect(ladderDivision({ X: 2, Z: 1 })).toBeNull();
  });
});

describe('seasonLadder', () => {
  // Ten rounds of four players. Player 1 wins every round; player 2 is second.
  const rounds = Array.from({ length: 10 }, (_, i) =>
    round(i + 1, [
      player('1', 'A', 50),
      player('2', i < 4 ? 'B' : 'C', 51), // 4 B, 6 C
      player('3', i < 9 ? 'Z' : 'D', 60), // non-member until the last round
      player('4', 'Z', 70),
    ])
  );
  const ladder = seasonLadder(rounds);
  const byId = Object.fromEntries(ladder.map((e) => [e.userId, e]));

  it('totals the best eight results', () => {
    expect(byId['1'].rounds).toBe(10);
    expect(byId['1'].points).toBe(800);
    expect(byId['2'].points).toBe(600);
  });

  it('assigns each player their most-played division', () => {
    expect(byId['2'].division).toBe('C');
  });

  it('takes membership from the latest round, where Div Z is for non-members', () => {
    expect(byId['3'].member).toBe(true);
    expect(byId['3'].division).toBe('D');
    expect(byId['4'].member).toBe(false);
  });

  it('orders players by points', () => {
    expect(ladder.map((e) => e.userId)).toEqual(['1', '2', '3', '4']);
  });
});

describe('divisionLadder', () => {
  function entry(userId: string, points: number, rounds: number, division = 'A', member = true) {
    return { userId, name: `Player ${userId}`, division, member, rounds, points };
  }

  const ladder = [
    entry('1', 300, 3),
    entry('2', 250, 2),
    entry('9', 240, 4, 'B'),
    entry('3', 200, 5),
    entry('4', 200, 4),
    entry('8', 190, 4, 'A', false),
    entry('5', 100, 1),
  ];

  it('lists members in the division', () => {
    const rows = divisionLadder(ladder, 'A', { places: 2, minimumRounds: 3 });
    expect(rows.map((r) => r.entry.userId).sort()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('makes only players with the minimum rounds eligible', () => {
    const rows = divisionLadder(ladder, 'A', { places: 2, minimumRounds: 3 });
    expect(Object.fromEntries(rows.map((r) => [r.entry.userId, r.eligible]))).toEqual({
      '1': true,
      '2': false,
      '3': true,
      '4': true,
      '5': false,
    });
  });

  it('positions only eligible players, with tied points sharing a position', () => {
    const rows = divisionLadder(ladder, 'A', { places: 2, minimumRounds: 3 });
    expect(Object.fromEntries(rows.map((r) => [r.entry.userId, r.position]))).toEqual({
      '1': 1,
      '2': null,
      '3': 2,
      '4': 2,
      '5': null,
    });
  });

  it('draws the line after the allocated places, counting only eligible players', () => {
    const rows = divisionLadder(ladder, 'A', { places: 1, minimumRounds: 3 });
    expect(rows.map((r) => [r.entry.userId, r.inPlaces])).toEqual([
      ['1', true],
      ['2', false],
      ['3', false],
      ['4', false],
      ['5', false],
    ]);
  });

  it('puts players tied on the line inside it', () => {
    const rows = divisionLadder(ladder, 'A', { places: 2, minimumRounds: 3 });
    expect(rows.filter((r) => r.inPlaces).map((r) => r.entry.userId)).toEqual(['1', '3', '4']);
  });

  it('lists players short of the minimum below the line, by points', () => {
    const rows = divisionLadder(ladder, 'A', { places: 2, minimumRounds: 3 });
    expect(rows.map((r) => r.entry.userId)).toEqual(['1', '3', '4', '2', '5']);
  });
});
