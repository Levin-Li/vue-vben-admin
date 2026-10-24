import { beforeEach, describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  access: {
    accessCodes: [] as string[],
  },
  user: {
    userInfo: null as null | Record<string, any>,
  },
}));

vi.mock('@vben/runtime/stores', () => ({
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
      loginName: 'platform-sa',
      superAdmin: true,
    };

    expect(
      useRbacAccess().hasPermission(
        'com.levin.oak.base:专家数据-简单页面::查询列表',
      ),
    ).toBe(true);
  });

  it('平台超级管理员角色无需单独授权即可访问', () => {
    stores.user.userInfo = {
      loginName: 'platform-sa-by-role',
      roleList: ['R_PLATFORM_SA'],
    };

    expect(useRbacAccess().hasPermission('demo:resource:read')).toBe(true);
  });

  it('平台管理员角色不授予无限制权限', () => {
    stores.user.userInfo = {
      loginName: 'platform-admin',
      roleList: ['R_PLATFORM_ADMIN'],
    };

    expect(useRbacAccess().hasPermission('demo:resource:read')).toBe(false);
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
