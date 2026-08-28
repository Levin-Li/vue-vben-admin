import { describe, expect, it } from 'vitest';

import { createOakBaseAdminModule } from '../module';

describe('后台管理模块首页路由', () => {
  it('将模块首页作为根路由的默认子页面，而非 CRUD 路由', () => {
    const module = createOakBaseAdminModule();
    const rootRoute = module.routes?.[0];

    expect(rootRoute?.path).toBe('/clob/V1/index');
    expect(rootRoute?.children?.[0]).toEqual(
      expect.objectContaining({
        meta: expect.objectContaining({ hideInMenu: true }),
        path: '',
      }),
    );
    expect(rootRoute?.children?.[0]?.component).toBeTypeOf('function');
  });
});
