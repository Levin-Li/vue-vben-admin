import { describe, expect, it, vi } from 'vitest';

import { generateAccess } from '../access';

const state = vi.hoisted(() => ({
  routes: [
    {
      path: '/workflow',
      component: {},
      meta: { title: '流程设计', authority: ['workflow:read'] },
    },
  ],
  menus: [
    {
      name: '基础框架',
      path: '/base',
      children: [{ name: '流程设计', path: '/workflow' }],
    },
  ],
  mappings: [
    {
      path: '/workflow',
      menuGroup: {
        parentPath: '/base',
        path: '/base/workflow',
        title: '工作流',
      },
    },
  ],
}));
vi.mock('@vben/runtime/access', () => ({
  generateAccessible: vi.fn(async () => ({
    accessibleRoutes: state.routes,
    accessibleMenus: state.menus,
  })),
}));
vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: { app: { accessMode: 'backend' } },
}));
vi.mock('@levin/admin-framework', () => ({
  collectAdminModuleBackendRouteMappings: (modules: unknown[]) =>
    modules.flatMap((module: any) => module.backendRouteMappings),
}));
vi.mock('@levin/admin-framework/framework-commons/app/options', () => ({
  getEnabledFrontendModules: () => [{ backendRouteMappings: state.mappings }],
}));
vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  getAllMenusApi: vi.fn(),
}));
vi.mock('@levin/admin-framework/framework-commons/app/layouts', () => ({
  BasicLayout: {},
  IFrameView: {},
  RouteView: {},
}));
vi.mock('@levin/admin-framework/framework-commons/app/locales', () => ({
  $t: (text: string) => text,
}));
vi.mock('@levin/admin-framework/framework-commons/app/pages', () => ({
  getAdminPageMap: () => ({}),
  resolveAdminPage: () => ({}),
}));
vi.mock('ant-design-vue', () => ({ message: { loading: vi.fn() } }));

describe('generateAccess menu grouping', () => {
  it('groups only the generated menus and keeps original authorized route tree and metadata', async () => {
    const before = JSON.stringify({ menus: state.menus, routes: state.routes });
    const result = await generateAccess({} as never);
    expect(result.accessibleRoutes).toBe(state.routes);
    expect(result.accessibleMenus[0]?.children?.[0]).toMatchObject({
      name: '工作流',
      path: '/base/workflow',
      children: [{ path: '/workflow' }],
    });
    expect(JSON.stringify({ menus: state.menus, routes: state.routes })).toBe(
      before,
    );
  });
});
