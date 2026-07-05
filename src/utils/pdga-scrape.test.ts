import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDateRange, parseEvents, keepEvent } from './pdga-scrape';
import type { PdgaEvent } from './pdga';

describe('parseDateRange', () => {
  it('parses a single day', () => {
    expect(parseDateRange('July 5, 2026')).toEqual({
      startDate: '2026-07-05',
      endDate: '2026-07-05',
    });
  });

  it('parses a same-month range (month dropped on the right)', () => {
    expect(parseDateRange('July 10 - 12, 2026')).toEqual({
      startDate: '2026-07-10',
      endDate: '2026-07-12',
    });
  });

  it('parses a cross-month range (year dropped on the left)', () => {
    expect(parseDateRange('June 21 - August 9, 2026')).toEqual({
      startDate: '2026-06-21',
      endDate: '2026-08-09',
    });
  });

  it('parses a cross-year range (both years present)', () => {
    expect(parseDateRange('December 31, 2026 - January 2, 2027')).toEqual({
      startDate: '2026-12-31',
      endDate: '2027-01-02',
    });
  });

  it('tolerates an en-dash and extra whitespace', () => {
    expect(parseDateRange('  August 1 – 2,  2026 ')).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-02',
    });
  });
});

describe('keepEvent', () => {
  const at = (tier: string, location: string): PdgaEvent => ({
    name: 'x', eventId: 1, tier, location, startDate: '2026-07-01', endDate: '2026-07-01',
  });

  it('keeps C-tier in Victoria', () => {
    expect(keepEvent(at('C', 'Werribee, Victoria, Australia'))).toBe(true);
  });

  it('drops C-tier elsewhere in Australia', () => {
    expect(keepEvent(at('C', 'Warner, Queensland, Australia'))).toBe(false);
  });

  it('keeps B-tier elsewhere in Australia', () => {
    expect(keepEvent(at('B', 'Warner, Queensland, Australia'))).toBe(true);
  });

  it('drops B-tier in New Zealand but keeps A-tier', () => {
    expect(keepEvent(at('B', 'Auckland, New Zealand'))).toBe(false);
    expect(keepEvent(at('A', 'Auckland, New Zealand'))).toBe(true);
  });

  it('drops leagues and unsanctioned tiers everywhere', () => {
    expect(keepEvent(at('L', 'Belair, South Australia, Australia'))).toBe(false);
    expect(keepEvent(at('XC', 'Melbourne, Victoria, Australia'))).toBe(false);
  });

  it('drops events outside Australia and New Zealand', () => {
    expect(keepEvent(at('M', 'Emporia, Kansas, United States'))).toBe(false);
  });
});

describe('parseEvents', () => {
  const html = readFileSync(
    fileURLToPath(new URL('./__fixtures__/pdga-search.html', import.meta.url)),
    'utf8'
  );
  const events = parseEvents(html);

  it('parses every result row', () => {
    expect(events.length).toBe(25);
  });

  it('extracts the fields for a known event', () => {
    const werribee = events.find((e) => e.eventId === 105160);
    expect(werribee).toEqual({
      name: 'VMS Werribee Presented by Melbourne Disc Golf',
      eventId: 105160,
      tier: 'C',
      location: 'Werribee, Victoria, Australia',
      startDate: '2026-07-05',
      endDate: '2026-07-05',
    });
  });

  it('parses a multi-day event', () => {
    const qldOpen = events.find((e) => e.eventId === 101868);
    expect(qldOpen?.tier).toBe('B');
    expect(qldOpen?.startDate).toBe('2026-07-10');
    expect(qldOpen?.endDate).toBe('2026-07-12');
  });
});
