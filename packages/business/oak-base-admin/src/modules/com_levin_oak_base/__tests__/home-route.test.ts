import { describe, expect, it } from 'vitest';

import { name, version } from '../../../../package.json';
import { createOakBaseAdminModule } from '../module';

describe('后台管理模块首页路由', () => {
  it('注册版本直接来自发布包元数据', () => {
    const module = createOakBaseAdminModule();
    expect(module.version).toBe(version);
    expect(module.packageInfo).toMatchObject({ name, version });
    expect(
      Number.isFinite(Date.parse(module.packageInfo?.buildTime || '')),
    ).toBe(true);
  });
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
