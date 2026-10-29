import { describe, it, expect } from 'vitest';
import { documentTitle, pageTitleWithParent } from './page-title';

describe('pageTitleWithParent', () => {
  it("adds the parent's title", () => {
    expect(pageTitleWithParent('Qualification', 'MDGC Club Champs 2026')).toBe('Qualification | MDGC Club Champs 2026');
  });

  it('is just the title without a parent', () => {
    expect(pageTitleWithParent('Club')).toBe('Club');
  });

  it("leaves out a parent the title already includes", () => {
    expect(pageTitleWithParent('2026 Season 1 - Div A', '2026 Season 1')).toBe('2026 Season 1 - Div A');
  });
});

describe('documentTitle', () => {
  it('adds the site name', () => {
    expect(documentTitle('Board | Club')).toBe('Board | Club | Melbourne Disc Golf Club');
  });
});
