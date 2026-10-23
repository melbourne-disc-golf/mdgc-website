import { describe, it, expect } from 'vitest';
import { getSocialRoundPrizes, type SocialPrizesByEvent } from './social-prizes';

const prizes: SocialPrizesByEvent = {
  '111': {
    winners: [{ prize: 'Div A Handicap', name: 'Someone', detail: 'Net 50' }],
    notes: ['A note.'],
  },
};

describe('getSocialRoundPrizes', () => {
  it('looks a round up by its Metrix ID, as a number or a string', () => {
    expect(getSocialRoundPrizes(111, prizes)).toBe(prizes['111']);
    expect(getSocialRoundPrizes('111', prizes)).toBe(prizes['111']);
  });

  it('gives a round with no prize data no winners and no notes', () => {
    expect(getSocialRoundPrizes(222, prizes)).toEqual({ winners: [], notes: [] });
  });
});
