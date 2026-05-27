import { describe, expect, it } from 'vitest';

import {
  evaluatePatternList,
  filterPatternOptions,
  matchPatternList,
  normalizePatternList,
  stringifyPatternList,
} from '../pattern-list-utils';

describe('pattern-list-utils', () => {
  it('normalizes arrays, JSON arrays, and plain text into unique strings', () => {
    expect(normalizePatternList([' /api/* ', '/api/*', null])).toEqual([
      '/api/*',
    ]);
    expect(normalizePatternList('["/demo/*","/demo/?"]')).toEqual([
      '/demo/*',
      '/demo/?',
    ]);
    expect(normalizePatternList('/api/*\n/admin/?;/demo/*')).toEqual([
      '/api/*',
      '/admin/?',
      '/demo/*',
    ]);
    expect(normalizePatternList('GET，POST|DELETE;PATCH')).toEqual([
      'GET',
      'POST',
      'DELETE',
      'PATCH',
    ]);
    expect(normalizePatternList('["/broken/*"')).toEqual(['["/broken/*"']);
  });

  it('generates Java List<String> compatible JSON arrays', () => {
    expect(stringifyPatternList('/api/*\n/admin/?')).toBe(
      JSON.stringify(['/api/*', '/admin/?'], null, 2),
    );
  });

  it('matches patterns with OR and AND mode', () => {
    expect(matchPatternList(['/api/*', '/admin/?'], '/api/demo', 'any')).toBe(
      true,
    );
    expect(matchPatternList(['/api/*', '*demo'], '/api/demo', 'all')).toBe(
      true,
    );
    expect(matchPatternList(['/api/*', '*admin'], '/api/demo', 'all')).toBe(
      false,
    );
    expect(matchPatternList([], '/api/demo', 'any')).toBe(false);
    expect(matchPatternList(['/api/*'], '', 'any')).toBe(false);
  });

  it('treats regex characters as literals while honoring wildcards', () => {
    expect(matchPatternList(['file.v?'], 'file.v1', 'any')).toBe(true);
    expect(matchPatternList(['file.v?'], 'file-v1', 'any')).toBe(false);
    expect(matchPatternList(['a+b*'], 'a+b-test', 'any')).toBe(true);
  });

  it('evaluates every pattern for immediate test feedback', () => {
    expect(evaluatePatternList(['/api/*', '/api/?'], '/api/a', 'all')).toEqual({
      items: [
        { matched: true, pattern: '/api/*' },
        { matched: true, pattern: '/api/?' },
      ],
      matched: true,
      mode: 'all',
      target: '/api/a',
    });
  });

  it('filters selectable options by value, label, description, or group', () => {
    const options = [
      { group: 'Demo', label: 'Demo API', value: '/demo/*' },
      { description: '后台接口', label: 'Admin API', value: '/admin/*' },
    ];

    expect(filterPatternOptions(options, '后台')).toEqual([options[1]]);
    expect(filterPatternOptions(options, 'demo')).toEqual([options[0]]);
  });
});
