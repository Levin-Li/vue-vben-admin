import { describe, expect, it, vi } from 'vitest';

vi.mock('@levin/admin-framework/framework-commons/app/pages', () => ({
  resolveAdminPage: (pagePath: string) => async () => pagePath,
}));

vi.mock('@levin/admin-framework/framework-commons/app/locales', () => ({
  $t: (key: string) =>
    key === 'demos.publicComponents' ? '公共组件测试' : key,
}));

vi.mock('@vben/preferences', () => ({
  preferences: {
    app: {
      defaultHomePath: '/index',
    },
  },
}));

import { buildCoreRouteNames } from '../../access-route-names';
import { coreRoutes } from '../../core';
import demosRoutes from '../demos';

describe('demos routes', () => {
  it('registers the public component test page under demos only', () => {
    const demosRoot = demosRoutes.find((route) => route.path === '/demos');
    const route = demosRoot?.children?.find(
      (item) => item.path === '/demos/public-components',
    );

    expect(route?.name).toBe('PublicComponentDemos');
    expect(route?.component).toBeTypeOf('function');
    expect(route?.meta?.title).toBe('公共组件测试');
  });

  it('keeps the public component test page directly reachable in backend menu mode', () => {
    const root = coreRoutes.find((route) => route.path === '/');
    const route = root?.children?.find(
      (item) => item.path === '/demos/public-components',
    );

    expect(route?.name).toBe('PublicComponentDemosDirect');
    expect(route?.meta?.hideInMenu).toBe(true);
    expect(buildCoreRouteNames(coreRoutes)).toContain(
      'PublicComponentDemosDirect',
    );
  });
});
