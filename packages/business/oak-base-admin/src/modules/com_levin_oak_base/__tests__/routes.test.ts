import { describe, expect, it } from 'vitest';

import { createOakBaseAdminModule } from '../module';
import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';
import { oakBaseAdminRoutes } from '../routes';

describe('oak base admin routes', () => {
  it('registers the tenant setting page in the explicit route table', () => {
    expect(oakBaseAdminRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'SettingForTenant',
            title: '租户系统设置',
          }),
          name: '_clob_V1_SettingForTenant',
          path: '/clob/V1/SettingForTenant',
        }),
      ]),
    );
  });

  it('registers the tenant plugin setting page in the explicit route table', () => {
    expect(oakBaseAdminRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'TenantPluginSetting',
            title: '租户插件设置',
          }),
          name: '_clob_V1_TenantPluginSetting',
          path: '/clob/V1/TenantPluginSetting',
        }),
      ]),
    );
  });

  it('keeps the tenant setting route when generated CRUD routes are disabled', () => {
    const module = createOakBaseAdminModule({ crud: false });

    expect(module.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/clob/V1/SettingForTenant',
        }),
        expect.objectContaining({
          path: '/clob/V1/TenantPluginSetting',
        }),
      ]),
    );
  });

  it('registers organization-user and plain user routes separately', () => {
    const module = createOakBaseAdminModule();
    const root = module.routes?.[0];

    expect(root?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'OrgUser',
            title: '组织与用户',
          }),
          name: '_clob_V1_OrgUser',
          path: '/clob/V1/OrgUser',
        }),
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'User',
            title: '用户管理',
          }),
          name: '_clob_V1_User',
          path: '/clob/V1/User',
        }),
      ]),
    );

    expect(oakBaseAdminBackendRouteMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/clob/V1/OrgUser',
          title: '组织与用户',
          viewPath: '/system/com_levin_oak_base/org-user/index.vue',
        }),
        expect.objectContaining({
          path: '/clob/V1/User',
          title: '用户管理',
          viewPath: '/system/com_levin_oak_base/user/index.vue',
        }),
      ]),
    );
  });

  it('registers the traffic control rule CRUD route and backend mapping', () => {
    const module = createOakBaseAdminModule();
    const root = module.routes?.[0];

    expect(root?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'TrafficControlRule',
            title: '流量控制',
          }),
          name: '_clob_V1_TrafficControlRule',
          path: '/clob/V1/TrafficControlRule',
        }),
      ]),
    );

    expect(oakBaseAdminBackendRouteMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/clob/V1/TrafficControlRule',
          sourceFilePath:
            'modules/com_levin_oak_base/views/traffic-control-rule/index.vue',
          title: '流量控制',
          viewPath: '/system/com_levin_oak_base/traffic-control-rule/index.vue',
        }),
      ]),
    );
  });
});
