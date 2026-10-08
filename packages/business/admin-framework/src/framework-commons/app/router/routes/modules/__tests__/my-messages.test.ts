import { createMemoryHistory, createRouter } from 'vue-router';

import { describe, expect, it, vi } from 'vitest';

import routes from '../my-messages';

vi.mock('@levin/admin-framework/framework-commons/app/pages', () => ({
  resolveAdminPage: (path: string) => ({ template: '<div />', pagePath: path }),
}));

describe('我的消息静态路由', () => {
  it('路由名称从路径生成，地址能定位到唯一页面', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push('/clob/V1/MyMessages');
    expect(router.currentRoute.value.name).toBe(
      '/clob/V1/MyMessages'.replaceAll('/', '_'),
    );
    expect(router.currentRoute.value.matched).toHaveLength(1);
    expect(router.currentRoute.value.meta.hideInMenu).toBe(true);
    expect(routes[0]?.component).toMatchObject({
      pagePath: '/system/com_levin_oak_base/my-messages/index.vue',
    });
  });
});
