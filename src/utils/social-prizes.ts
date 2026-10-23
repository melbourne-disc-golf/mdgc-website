// Social day prize winners, as scraped from mdgc-sd into
// src/data/mdgc-sd/prize-winners.json by scripts/fetch-mdgc-sd-prizes.ts.
// The scraping lives in mdgc-sd-scrape.ts, which only the script imports.

export interface SocialPrizeWinner {
  prize: string;
  name: string;
  detail: string;
}

export interface SocialRoundPrizes {
  winners: SocialPrizeWinner[];
  notes: string[];
}

/** Prizes per round, keyed by the round's Metrix event ID. */
export type SocialPrizesByEvent = Record<string, SocialRoundPrizes>;

function loadPrizes(): SocialPrizesByEvent {
  const modules = import.meta.glob('../data/mdgc-sd/prize-winners.json', { eager: true });
  const mod = Object.values(modules)[0] as { default?: SocialPrizesByEvent } | undefined;
  return mod?.default ?? {};
}

const NO_PRIZES: SocialRoundPrizes = { winners: [], notes: [] };

/** A round's prize winners and notes, or none if mdgc-sd has none yet. */
export function getSocialRoundPrizes(
  eventId: number | string,
  prizes: SocialPrizesByEvent = loadPrizes(),
): SocialRoundPrizes {
  return prizes[String(eventId)] ?? NO_PRIZES;
}
