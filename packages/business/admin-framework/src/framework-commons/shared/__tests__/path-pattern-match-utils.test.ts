import { describe, expect, it } from 'vitest';

import { matchPathPattern } from '../path-pattern-match-utils';

describe('path pattern match utils', () => {
  it('keeps single-star matches inside one path segment', () => {
    expect(matchPathPattern('/SALES/*', '/SALES/EAST')).toBe(true);
    expect(matchPathPattern('/SALES/*', '/SALES/EAST/TEAM')).toBe(false);
  });

  it('matches zero or more trailing segments with double-star', () => {
    expect(matchPathPattern('/SALES/**', '/SALES')).toBe(true);
    expect(matchPathPattern('/SALES/**', '/SALES/EAST/TEAM')).toBe(true);
  });

  it('supports single-character wildcards', () => {
    expect(matchPathPattern('/SALES/?AST', '/SALES/EAST')).toBe(true);
  });

  it('rejects non-terminal catch-all segments', () => {
    expect(matchPathPattern('/SALES/**/TEAM', '/SALES/EAST/TEAM')).toBe(false);
  });
});
