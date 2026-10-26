import { describe, it, expect } from 'vitest';
import { birdieHeat, formatToPar, fractionHeat, percentHeat, toParHeat } from './season-format';
import { emptyScoreCounts } from './season-stats';

describe('formatToPar', () => {
  it('signs scores over and under par', () => {
    expect(formatToPar(3)).toBe('+3');
    expect(formatToPar(-2)).toBe('-2');
  });

  it('calls par "E"', () => {
    expect(formatToPar(0)).toBe('E');
  });

  it('calls a score that rounds to par "E"', () => {
    expect(formatToPar(0.04, 1)).toBe('E');
    expect(formatToPar(-0.04, 1)).toBe('E');
  });

  it('rounds to the given digits', () => {
    expect(formatToPar(2.36, 1)).toBe('+2.4');
  });

  it('shows a dash for no score', () => {
    expect(formatToPar(null)).toBe('–');
  });
});

describe('toParHeat', () => {
  it('shades from good to bad as scores rise', () => {
    expect(toParHeat(-1)).toBe('heat-good-4');
    expect(toParHeat(0)).toBe('heat-good-4');
    expect(toParHeat(3)).toBe('heat-good-2');
    expect(toParHeat(6)).toBe('heat-warn-2');
    expect(toParHeat(9)).toBe('heat-bad-2');
    expect(toParHeat(10)).toBe('heat-bad-4');
  });

  it('leaves no score unshaded', () => {
    expect(toParHeat(null)).toBe('');
  });
});

describe('percentHeat', () => {
  const thresholds = [10, 20, 30, 40];

  it('goes up a level for each threshold reached', () => {
    expect(percentHeat('warn', 20, 100, thresholds)).toBe('heat-warn-2');
    expect(percentHeat('warn', 39, 100, thresholds)).toBe('heat-warn-3');
  });

  it('stays between levels 1 and 4', () => {
    expect(percentHeat('warn', 0, 100, thresholds)).toBe('heat-warn-1');
    expect(percentHeat('warn', 90, 100, thresholds)).toBe('heat-warn-4');
  });

  it('leaves an empty total unshaded', () => {
    expect(percentHeat('warn', 0, 0, thresholds)).toBe('');
  });
});

describe('birdieHeat', () => {
  it('shades the share of birdies or better', () => {
    const counts = { ...emptyScoreCounts(), eagle: 1, birdie: 1, par: 8 };
    expect(birdieHeat(counts)).toBe('heat-good-2');
  });
});

describe('fractionHeat', () => {
  it('shades by quarters of the maximum', () => {
    expect(fractionHeat(50, 100)).toBe('heat-neutral-2');
    expect(fractionHeat(100, 100)).toBe('heat-neutral-4');
  });

  it('stays between levels 1 and 4', () => {
    expect(fractionHeat(1, 100)).toBe('heat-neutral-1');
  });
});
