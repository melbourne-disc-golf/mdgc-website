import { describe, expect, it } from 'vitest';
import { isUnlisted } from './unlisted-pages';

describe('isUnlisted', () => {
  it('matches an unlisted path, with or without a trailing slash', () => {
    expect(isUnlisted('/club/welcome')).toBe(true);
    expect(isUnlisted('/club/welcome/')).toBe(true);
  });

  it('matches a full URL, as the sitemap filter passes', () => {
    expect(isUnlisted('https://www.melbournediscgolf.com/club/welcome/')).toBe(true);
  });

  it('does not match listed pages', () => {
    expect(isUnlisted('/club')).toBe(false);
    expect(isUnlisted('/club/membership/')).toBe(false);
    expect(isUnlisted('https://www.melbournediscgolf.com/')).toBe(false);
  });

  it('does not match pages below or beside an unlisted path', () => {
    expect(isUnlisted('/club/welcome/extra')).toBe(false);
    expect(isUnlisted('/club/welcomed')).toBe(false);
  });
});
