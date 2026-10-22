import { describe, it, expect } from 'vitest';
import { scoreCategory } from './scores';

describe('scoreCategory', () => {
  it('categorises scores relative to par', () => {
    expect(scoreCategory(2, 4)).toBe('eagle');
    expect(scoreCategory(2, 3)).toBe('birdie');
    expect(scoreCategory(3, 3)).toBe('par');
    expect(scoreCategory(4, 3)).toBe('bogey');
    expect(scoreCategory(5, 3)).toBe('double-plus');
  });

  it('treats a hole in one as an ace, whatever the par', () => {
    expect(scoreCategory(1, 3)).toBe('ace');
    expect(scoreCategory(1, 4)).toBe('ace');
  });

  it('counts anything better than an eagle as an eagle', () => {
    expect(scoreCategory(2, 5)).toBe('eagle');
  });

  it('counts anything worse than a double bogey as double-plus', () => {
    expect(scoreCategory(9, 3)).toBe('double-plus');
  });
});
