import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { formatDayOfSeason } from './dates';

describe('formatDayOfSeason', () => {
  const date = Temporal.PlainDate.from('2026-10-24');

  it('gives the weekday, day and month', () => {
    expect(formatDayOfSeason(date)).toBe('Saturday 24 October');
  });

  it('can abbreviate', () => {
    expect(formatDayOfSeason(date, 'short')).toBe('Sat 24 Oct');
  });
});
