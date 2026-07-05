export interface SocialPrizeWinner {
  prize: string;
  name: string;
  detail: string;
}

const prizeWinnersByEvent: Record<number, SocialPrizeWinner[]> = {
  3647171: [
    {
      prize: 'Div A Handicap',
      name: 'Markus Villota',
      detail: 'Net 50.29, raw 55 (-9)',
    },
    {
      prize: 'Div B Handicap',
      name: 'Jason Vincent',
      detail: 'Net 47.82, raw 61 (-3)',
    },
    {
      prize: 'Div C Handicap',
      name: 'Robert Lambert',
      detail: 'Net 52.03, raw 67 (+3)',
    },
    {
      prize: 'Div D Handicap',
      name: 'Sharon Cook',
      detail: 'Net 43.52, raw 81 (+17)',
    },
    {
      prize: 'Div A/B/X/Z CTB',
      name: 'Aidan Howard',
      detail: 'Hole 1',
    },
    {
      prize: 'Div C/D CTB',
      name: 'Illia Kravchenko',
      detail: 'Hole 7',
    },
  ],
};

const prizeNotesByEvent: Record<number, string[]> = {
  3647171: [
    'Illia Kravchenko also led Div C Handicap but won Div C/D CTB, so Div C Handicap passed to Robert Lambert.',
  ],
};

export function getSocialPrizeWinners(eventId: number): SocialPrizeWinner[] {
  return prizeWinnersByEvent[eventId] ?? [];
}

export function getSocialPrizeNotes(eventId: number): string[] {
  return prizeNotesByEvent[eventId] ?? [];
}
