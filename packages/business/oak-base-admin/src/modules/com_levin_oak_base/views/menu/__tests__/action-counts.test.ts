import { describe, expect, it } from 'vitest';

import {
  getOpButtonCount,
  getRequireAuthorizationCount,
} from '../action-counts';

describe('menu action count helpers', () => {
  it('counts non-empty required permissions', () => {
    expect(
      getRequireAuthorizationCount({
        requireAuthorizations: ['menu:view', '', '  ', 'menu:update'],
      }),
    ).toBe(2);
  });

  it('counts configured operation buttons', () => {
    expect(
      getOpButtonCount({
        opButtonList: [
          { label: '新增' },
          { opName: 'update', requireAuthorizations: ['menu:update'] },
          { opName: 'delete' },
          { label: '  ', requireAuthorizations: ['  '] },
        ],
      }),
    ).toBe(3);
  });
});
