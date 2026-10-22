import { describe, expect, it } from 'vitest';
import { ctbAnchor, ctbLabel, ctbOverlaps, ctbRoundFor } from './ctb';

describe('ctbOverlaps', () => {
  it('is empty when each division has one prize', () => {
    expect(ctbOverlaps([
      { hole: 3, divisions: ['A', 'B', 'X', 'Z'] },
      { hole: 12, divisions: ['C', 'D'] },
    ])).toEqual([]);
  });

  it('lists divisions in more than one prize', () => {
    expect(ctbOverlaps([
      { hole: 3, divisions: ['A', 'B', 'C'] },
      { hole: 12, divisions: ['C', 'D', 'A'] },
    ])).toEqual(['C', 'A']);
  });

  it('ignores a division repeated within one prize', () => {
    expect(ctbOverlaps([{ hole: 3, divisions: ['A', 'A'] }])).toEqual([]);
  });

  it('does not treat uncovered divisions as a problem', () => {
    expect(ctbOverlaps([{ hole: 3, divisions: ['A'] }])).toEqual([]);
  });
});

describe('ctbLabel', () => {
  it('names the divisions, as prize names do', () => {
    expect(ctbLabel({ hole: 3, divisions: ['A', 'B', 'X', 'Z'] })).toBe('Div A/B/X/Z');
  });
});

describe('ctbRoundFor', () => {
  const days = [
    { id: 12, date: '2026-10-24' },
    { id: 11, date: '2026-10-17' },
    { id: 13, date: '2026-11-03' },
  ];

  it('is the next social day', () => {
    expect(ctbRoundFor(days, '2026-10-18')?.id).toBe(12);
  });

  it("is today's social day, on the day", () => {
    expect(ctbRoundFor(days, '2026-10-24')?.id).toBe(12);
  });

  it('moves on the day after', () => {
    expect(ctbRoundFor(days, '2026-10-25')?.id).toBe(13);
  });

  it('is undefined once there are no more social days', () => {
    expect(ctbRoundFor(days, '2026-11-04')).toBeUndefined();
  });
});

describe('ctbAnchor', () => {
  it('names the divisions', () => {
    expect(ctbAnchor({ hole: 3, divisions: ['A', 'B', 'X', 'Z'] })).toBe('ctb-div-abxz');
  });
});
