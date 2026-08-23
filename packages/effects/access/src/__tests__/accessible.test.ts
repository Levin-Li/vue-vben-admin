import { defineComponent } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { generateAccessible } from '../accessible';

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
});
