import { describe, expect, it } from 'vitest';

import {
  getRequireAuthorizationCount,
  normalizePermissionValues,
} from '../simple-content-permissions';

describe('simple content permission helpers', () => {
  it('normalizes array and comma separated permission values', () => {
    expect(normalizePermissionValues(['a:view', '', '  b:update  '])).toEqual([
      'a:view',
      'b:update',
    ]);
    expect(normalizePermissionValues('a:view, b:update\nc:delete')).toEqual([
      'a:view',
      'b:update',
      'c:delete',
    ]);
  });

  it('counts non-empty required permissions', () => {
    expect(
      getRequireAuthorizationCount({
        requireAuthorizations: ['page:view', ' ', 'page:update'],
      }),
    ).toBe(2);
  });
});
