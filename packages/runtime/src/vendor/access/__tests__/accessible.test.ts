import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

import { generateAccessible } from '../accessible';
import { resetStaticRoutes } from '../../utils/helpers/reset-routes';

describe('generateAccessible', () => {
  it('preserves a top-level group route view when it owns a default child page', async () => {
    const rootComponent = defineComponent({ template: '<router-view />' });
    const routeView = defineComponent({ template: '<router-view />' });
    const groupPage = defineComponent({ template: '<div>group page</div>' });
    const rootRoute: any = {
      children: [],
      component: rootComponent,
      name: 'root',
      path: '/',
    };
    const router: any = {
      addRoute: vi.fn(),
      getRoutes: vi.fn(() => [rootRoute]),
      removeRoute: vi.fn(),
    };

    await generateAccessible('frontend', {
      router,
      routes: [
        {
          children: [
            {
              component: groupPage,
              meta: { hideInMenu: true, title: '国家地区' },
              name: 'NationIndex',
              path: '',
            },
          ],
          component: routeView,
          meta: {
            preserveComponentWhenChildren: true,
            title: '国家地区',
          },
          name: 'NationGroup',
          path: '/clob/V1/Nation',
        },
      ],
    });

    const nationRoute = rootRoute.children.find(
      (route: { name: string }) => route.name === 'NationGroup',
    );
    expect(nationRoute?.component).toBeDefined();
    expect(nationRoute?.children?.[0]?.name).toBe('NationIndex');
  });

  it('replaces a previous user 403 route when a super administrator reloads the same menu', async () => {
    // 使用真实路由器模拟同一 SPA 会话内普通用户切换为超级管理员。
    const rootComponent = defineComponent({ template: '<router-view />' });
    const pageComponent = defineComponent({
      template: '<div>management</div>',
    });
    const forbiddenComponent = defineComponent({ template: '<div>403</div>' });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          children: [],
          component: rootComponent,
          name: 'Root',
          path: '/',
        },
      ],
    });
    const createManagementMenu = (menuVisibleWithForbidden: boolean) => [
      {
        component: '/views/management.vue',
        meta: { menuVisibleWithForbidden, title: '管理页面' },
        name: 'Management',
        path: '/management',
      },
    ];
    const options = {
      forbiddenComponent,
      pageMap: {
        '/management.vue': pageComponent,
      },
      router,
      routes: [],
    };

    // 普通用户保留菜单入口但没有页面访问权限，组件应被替换为 403。
    await generateAccessible('backend', {
      ...options,
      fetchMenuListAsync: async () => createManagementMenu(true),
    });
    expect(
      router.getRoutes().find((route) => route.name === 'Management')
        ?.components.default,
    ).toBe(forbiddenComponent);

    // 切换账号时移除旧动态路由，再按超级管理员菜单重新装配同一路径。
    resetStaticRoutes(router, ['Root']);
    await generateAccessible('backend', {
      ...options,
      fetchMenuListAsync: async () => createManagementMenu(false),
    });

    expect(router.resolve('/management').name).toBe('Management');
    expect(
      router.getRoutes().find((route) => route.name === 'Management')
        ?.components.default,
    ).toBe(pageComponent);
  });
});
