import { describe, expect, it } from 'vitest';

import { shouldNavigateSelectedMenu } from '../group-navigation';

describe('group navigation', () => {
  it('does not navigate a pure menu group to any child', () => {
    expect(
      shouldNavigateSelectedMenu({
        children: [{ name: '用户管理', path: '/clob/V1/User' }],
        name: '用户&权限',
        path: '/menu/user-permission',
      }),
    ).toBe(false);
  });

  it('keeps leaf menus and groups with their own page navigable', () => {
    expect(
      shouldNavigateSelectedMenu({ name: '用户管理', path: '/clob/V1/User' }),
    ).toBe(true);
    expect(
      shouldNavigateSelectedMenu({
        children: [{ name: '概览', path: '/workspace/overview' }],
        name: '工作台',
        navigateOnClick: true,
        path: '/workspace',
      }),
    ).toBe(true);
  });
});
