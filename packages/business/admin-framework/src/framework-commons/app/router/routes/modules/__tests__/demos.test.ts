import { describe, expect, it, vi } from 'vitest';

import { buildCoreRouteNames } from '../../access-route-names';
import { coreRoutes } from '../../core';
import demosRoutes from '../demos';

vi.mock('@levin/admin-framework/framework-commons/app/pages', () => ({
  resolveAdminPage: (pagePath: string) => async () => pagePath,
}));

vi.mock('@levin/admin-framework/framework-commons/app/locales', () => ({
  $t: (key: string) => {
    const labels: Record<string, string> = {
      'demos.permissions': '权限分配',
      'demos.publicComponents': '公共组件',
      'demos.userOrgSelector': '组织用户选择器',
    };

    return labels[key] || key;
  },
}));

vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: {
    app: {
      defaultHomePath: '/index',
    },
  },
}));

describe('demos routes', () => {
  it('registers focused public component child pages under demos', () => {
    const demosRoot = demosRoutes.find((route) => route.path === '/demos');
    const route = demosRoot?.children?.find(
      (item) => item.path === '/demos/public-components',
    );
    const selectorRoute = route?.children?.find(
      (item) => item.path === '/demos/public-components/user-org-selector',
    );
    const permissionRoute = route?.children?.find(
      (item) => item.path === '/demos/public-components/permissions',
    );

    expect(route?.name).toBe('PublicComponentDemos');
    expect(route?.redirect).toBe('/demos/public-components/user-org-selector');
    expect(route?.meta?.title).toBe('公共组件');
    expect(selectorRoute?.name).toBe('UserOrgSelectorDemos');
    expect(selectorRoute?.component).toBeTypeOf('function');
    expect(selectorRoute?.meta?.title).toBe('组织用户选择器');
    expect(permissionRoute?.name).toBe('PermissionDemos');
    expect(permissionRoute?.component).toBeTypeOf('function');
    expect(permissionRoute?.meta?.title).toBe('权限分配');
    for (const entry of [route, selectorRoute, permissionRoute]) {
      expect(entry?.meta?.requiresAccess).toBe(true);
    }
  });

  it('keeps public component child pages directly reachable in backend menu mode', () => {
    const root = coreRoutes.find((route) => route.path === '/');
    const groupRoute = root?.children?.find(
      (item) => item.path === '/demos/public-components',
    );
    const selectorRoute = root?.children?.find(
      (item) => item.path === '/demos/public-components/user-org-selector',
    );
    const permissionRoute = root?.children?.find(
      (item) => item.path === '/demos/public-components/permissions',
    );

    expect(groupRoute?.name).toBe('PublicComponentDemosDirect');
    expect(groupRoute?.redirect).toBe(
      '/demos/public-components/user-org-selector',
    );
    expect(selectorRoute?.name).toBe('UserOrgSelectorDemosDirect');
    expect(selectorRoute?.meta?.hideInMenu).toBe(true);
    expect(permissionRoute?.name).toBe('PermissionDemosDirect');
    expect(permissionRoute?.meta?.hideInMenu).toBe(true);
    const names = buildCoreRouteNames(coreRoutes);
    for (const entry of [groupRoute, selectorRoute, permissionRoute]) {
      // 冷启动直达入口必须等待本人信息、许可和共享目录初始化；匿名不能跳过登录。
      expect(entry?.meta?.requiresAccess).toBe(true);
      expect(names).not.toContain(entry?.name);
    }
  });
});
