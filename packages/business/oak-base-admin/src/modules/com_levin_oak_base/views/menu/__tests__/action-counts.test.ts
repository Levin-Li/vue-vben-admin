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
          { requireAuthorization: 'menu:update' },
          { apiUrl: '/api/menu/delete' },
          { label: '  ', requireAuthorization: '  ' },
        ],
      }),
    ).toBe(3);
  });
});
