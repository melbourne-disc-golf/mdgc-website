// Build-time scraping of social day prize winners from mdgc-sd's public
// results pages, a stopgap until prize data moves off mdgc-sd.
//
// Imported only by scripts/fetch-mdgc-sd-prizes.ts and its tests, so the HTML
// parser never reaches the shipped site. Parsing is strict: markup we don't
// recognise throws, so the sync fails loudly and the last good data stays.

import { parse, type HTMLElement } from 'node-html-parser';
import type { SocialPrizeKind, SocialPrizesByEvent, SocialPrizeWinner } from './social-prizes';

/** Absolute URLs of the season results pages linked from the home page. */
export function parseSeasonLinks(html: string, baseUrl: string): string[] {
  const root = parse(html);
  const urls = root
    .querySelectorAll('a[href]')
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => /^(\.\/)?results\/[^/]+$/.test(href))
    .map((href) => new URL(href, baseUrl).toString());
  return [...new Set(urls)];
}

function text(el: HTMLElement | null): string {
  return el?.text.replace(/\s+/g, ' ').trim() ?? '';
}

function metrixId(panel: HTMLElement): string | undefined {
  for (const a of panel.querySelectorAll('.results-panel-actions a[href]')) {
    const match = (a.getAttribute('href') ?? '').match(/discgolfmetrix\.com\/(\d+)\b/);
    if (match) return match[1];
  }
  return undefined;
}

const KINDS: Record<string, SocialPrizeKind> = {
  'prize-row-handicap': 'handicap',
  'prize-row-ctb': 'ctb',
};

function parseKind(row: HTMLElement, panelId: string): SocialPrizeKind {
  for (const cls of row.classList.values()) {
    if (KINDS[cls]) return KINDS[cls];
  }
  throw new Error(`${panelId}: prize winner row of unknown kind (class "${row.getAttribute('class')}")`);
}

function parseWinner(row: HTMLElement, panelId: string): SocialPrizeWinner {
  const winner = {
    kind: parseKind(row, panelId),
    prize: text(row.querySelector('.prize-winner-type')),
    name: text(row.querySelector('.prize-winner-copy strong')),
  };
  if (!winner.prize || !winner.name) {
    throw new Error(`${panelId}: prize winner row without a prize or name`);
  }
  return winner;
}

/**
 * Parse the prize winners for each round on a season results page, keyed by
 * the round's Metrix event ID. Rounds not yet played, or with prizes pending
 * review, are left out.
 */
export function parseSeasonPrizes(html: string): SocialPrizesByEvent {
  const root = parse(html);
  const panels = root.querySelectorAll('section.results-panel');
  if (panels.length === 0) {
    throw new Error('No round panels (section.results-panel) found');
  }

  const prizes: SocialPrizesByEvent = {};
  for (const panel of panels) {
    const panelId = panel.id || '(unnamed panel)';
    if (panel.querySelector('.not-played-panel')) continue;

    const section = panel.querySelector('.results-prize-section');
    if (!section) {
      throw new Error(`${panelId}: neither a "not played" notice nor a prize section`);
    }

    const rows = section.querySelectorAll('.prize-winner-row');
    if (rows.length === 0) {
      if (section.querySelector('.prize-graphic-empty')) continue;
      throw new Error(`${panelId}: prize section has neither winners nor an empty notice`);
    }

    const id = metrixId(panel);
    if (!id) {
      throw new Error(`${panelId}: prize winners without a Metrix link`);
    }

    prizes[id] = {
      winners: rows.map((row) => parseWinner(row, panelId)),
      notes: section
        .querySelectorAll('.prize-graphic-notes p')
        .map((p) => text(p))
        .filter(Boolean),
    };
  }
  return prizes;
}
