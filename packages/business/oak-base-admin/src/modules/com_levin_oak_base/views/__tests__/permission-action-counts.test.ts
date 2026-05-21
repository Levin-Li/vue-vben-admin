import { describe, expect, it } from 'vitest';

import {
  countConfiguredItems,
  getDataPermissionCount,
  getResourcePermissionCount,
} from '../permission-action-counts';

describe('permission-action-counts', () => {
  it('counts non-empty array and string permission values', () => {
    expect(countConfiguredItems(['a', '', ' b ', null, undefined])).toBe(2);
    expect(countConfiguredItems('a,\n b\n\n,c')).toBe(3);
  });

  it('counts resource and data permission fields from a record', () => {
    expect(
      getResourcePermissionCount({
        permissionList: ['res:a', 'res:b'],
      }),
    ).toBe(2);
    expect(
      getDataPermissionCount({
        orgScopeList: [{ orgId: '1' }, { orgId: '2' }],
      }),
    ).toBe(2);
  });
});
