import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSeasonLinks, parseSeasonPrizes } from './mdgc-sd-scrape';

const seasonHtml = readFileSync(
  fileURLToPath(new URL('./__fixtures__/mdgc-sd-season.html', import.meta.url)),
  'utf8',
);

function panel(id: string, inner: string): string {
  return `<section id="${id}" class="results-panel">${inner}</section>`;
}

const metrixActions = (id: string) =>
  `<div class="results-panel-actions"><a class="result-metrix-link" href="https://discgolfmetrix.com/${id}">Metrix</a></div>`;

describe('parseSeasonLinks', () => {
  it('finds the season results pages, resolved against the base URL', () => {
    const html = `
      <a href="info.html">Info</a>
      <a href="results/s1.html">Season 1</a>
      <a href="results/s2.html">Season 2</a>
      <a href="results/s2.html">Season 2 again</a>
      <a href="https://discgolfmetrix.com/3647171">Metrix</a>`;
    expect(parseSeasonLinks(html, 'https://mdgc-sd.vercel.app/')).toEqual([
      'https://mdgc-sd.vercel.app/results/s1.html',
      'https://mdgc-sd.vercel.app/results/s2.html',
    ]);
  });
});

describe('parseSeasonPrizes', () => {
  const prizes = parseSeasonPrizes(seasonHtml);

  it('keys each played round by its Metrix ID', () => {
    expect(Object.keys(prizes)).toEqual(['3647171']);
  });

  it('reads each winner, in page order', () => {
    const { winners } = prizes['3647171'];
    expect(winners).toHaveLength(6);
    expect(winners[0]).toEqual({ kind: 'handicap', prize: 'Div A Handicap', name: 'Markus Villota' });
    expect(winners[5]).toEqual({ kind: 'ctb', prize: 'Div C/D CTB', name: 'Illia Kravchenko' });
  });

  it('reads the prize notes', () => {
    expect(prizes['3647171'].notes).toEqual([
      'Illia Kravchenko also led Div C Handicap but won Div C/D CTB, so Div C Handicap passed to Robert Lambert.',
    ]);
  });

  it('gives a round without notes an empty list', () => {
    const html = panel(
      'rd-1',
      `${metrixActions('111')}
      <section class="results-prize-section">
        <article class="prize-winner-row prize-row-handicap"><span class="prize-winner-copy">
          <span class="prize-winner-type">Div A Handicap</span><strong>Someone</strong><em>Net 50</em>
        </span></article>
      </section>`,
    );
    expect(parseSeasonPrizes(html)['111'].notes).toEqual([]);
  });

  it('leaves out rounds with prizes pending review, and rounds not yet played', () => {
    expect(prizes['3539735']).toBeUndefined();
    expect(prizes['3647226']).toBeUndefined();
  });

  it('fails when the page has no round panels', () => {
    expect(() => parseSeasonPrizes('<main><p>Something else</p></main>')).toThrow(/No round panels/);
  });

  it('fails when a played round has no prize section', () => {
    const html = panel('rd-1', `${metrixActions('111')}<div class="results-section-grid"></div>`);
    expect(() => parseSeasonPrizes(html)).toThrow(/rd-1/);
  });

  it('fails when a prize section has neither winners nor an empty notice', () => {
    const html = panel('rd-1', `${metrixActions('111')}<section class="results-prize-section"></section>`);
    expect(() => parseSeasonPrizes(html)).toThrow(/neither winners nor an empty notice/);
  });

  it('fails when a round with winners has no Metrix link', () => {
    const html = panel(
      'rd-1',
      `<section class="results-prize-section">
        <article class="prize-winner-row prize-row-handicap"><span class="prize-winner-copy">
          <span class="prize-winner-type">Div A Handicap</span><strong>Someone</strong><em>Net 50</em>
        </span></article>
      </section>`,
    );
    expect(() => parseSeasonPrizes(html)).toThrow(/without a Metrix link/);
  });

  it('fails when a winner row has no name', () => {
    const html = panel(
      'rd-1',
      `${metrixActions('111')}
      <section class="results-prize-section">
        <article class="prize-winner-row prize-row-handicap"><span class="prize-winner-type">Div A Handicap</span></article>
      </section>`,
    );
    expect(() => parseSeasonPrizes(html)).toThrow(/without a prize or name/);
  });

  it('fails when a winner row is neither a handicap nor a CTB prize', () => {
    const html = panel(
      'rd-1',
      `${metrixActions('111')}
      <section class="results-prize-section">
        <article class="prize-winner-row prize-row-ace"><span class="prize-winner-copy">
          <span class="prize-winner-type">Ace</span><strong>Someone</strong>
        </span></article>
      </section>`,
    );
    expect(() => parseSeasonPrizes(html)).toThrow(/unknown kind/);
  });
});
