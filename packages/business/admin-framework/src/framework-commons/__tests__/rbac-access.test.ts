import { beforeEach, describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  access: {
    accessCodes: [] as string[],
  },
  user: {
    userInfo: null as null | Record<string, any>,
  },
}));

vi.mock('@vben/stores', () => ({
  useAccessStore: () => stores.access,
  useUserStore: () => stores.user,
}));

import { useRbacAccess } from '../rbac-access';

describe('useRbacAccess', () => {
  beforeEach(() => {
    stores.access.accessCodes = [];
    stores.user.userInfo = null;
  });

  it('allows super admin users even when authorized permission list is empty', () => {
    stores.user.userInfo = {
      loginName: 'sa',
      roleList: ['R_SA'],
      superAdmin: true,
    };

    expect(
      useRbacAccess().hasPermission(
        'com.levin.oak.base:专家数据-简单页面::查询列表',
      ),
    ).toBe(true);
  });

  it('still requires permission matches for normal users', () => {
    stores.user.userInfo = {
      loginName: 'demo',
      roleList: ['R_CUSTOMER'],
    };

    expect(useRbacAccess().hasPermission('demo:resource:read')).toBe(false);

    stores.access.accessCodes = ['demo:resource:*'];

    expect(useRbacAccess().hasPermission('demo:resource:read')).toBe(true);
  });
});
