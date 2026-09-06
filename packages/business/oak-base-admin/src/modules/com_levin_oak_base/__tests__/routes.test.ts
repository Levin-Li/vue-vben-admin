import { describe, expect, it } from 'vitest';

import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';
import { createOakBaseAdminModule } from '../module';
import { oakBaseAdminRoutes } from '../routes';

function flattenCrudRoutes(children: any[] | undefined): any[] {
  return (children || []).flatMap((route) => {
    if (Array.isArray(route?.children) && route.children.length > 0) {
      return flattenCrudRoutes(route.children);
    }

    return route?.meta?.crudResource ? [route] : [];
  });
}

describe('oak base admin routes', () => {
  it('derives uploaded page operations from the actual Dict API metadata', () => {
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/Dict',
    );

    expect(mapping?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          apiMethods: ['create'],
          label: '新增',
          opName: 'create',
          requireAuthorizations: [
            'com.levin.oak.base:系统数据-字典::新增',
            '/Dict/create',
          ],
        }),
        expect.objectContaining({
          apiMethods: ['delete'],
          label: '删除',
          opName: 'delete',
        }),
        expect.objectContaining({
          apiMethods: ['update'],
          label: '更新',
          opName: 'update',
        }),
      ]),
    );
  });

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
    const crudRoutes = flattenCrudRoutes(module.routes?.[0]?.children);

    expect(crudRoutes).toEqual(
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
    const crudRoutes = flattenCrudRoutes(module.routes?.[0]?.children);

    expect(crudRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'TrafficControlRule',
            title: '流量控制规则管理',
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
          title: '流量控制规则管理',
          viewPath: '/system/com_levin_oak_base/traffic-control-rule/index.vue',
        }),
      ]),
    );
  });

  it('registers the open area CRUD route and backend mapping', () => {
    const module = createOakBaseAdminModule();
    const root = module.routes?.[0];
    const basicSettingsGroup = root?.children?.find(
      (route) => route.meta?.title === '基础&设置',
    );

    expect(basicSettingsGroup?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'OpenArea',
            title: '开通区域',
          }),
          name: '_clob_V1_OpenArea',
          path: '/clob/V1/OpenArea',
        }),
      ]),
    );

    expect(oakBaseAdminBackendRouteMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/clob/V1/OpenArea',
          sourceFilePath:
            'modules/com_levin_oak_base/views/open-area/index.vue',
          title: '开通区域',
          viewPath: '/system/com_levin_oak_base/open-area/index.vue',
        }),
      ]),
    );
  });

  it('registers the administrative area test page under development tools', () => {
    const module = createOakBaseAdminModule();
    const root = module.routes?.[0];
    const developmentToolsGroup = root?.children?.find(
      (route) => route.meta?.title === '开发&工具',
    );

    expect(developmentToolsGroup?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'Demo',
            title: '常用组件测试',
          }),
          name: '_clob_V1_dev_TestDemo',
          path: '/clob/V1/dev/TestDemo',
        }),
      ]),
    );
    expect(oakBaseAdminBackendRouteMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/clob/V1/dev/TestDemo',
          sourceFilePath: 'modules/com_levin_oak_base/views/dev/TestDemo.vue',
          title: '常用组件测试',
          viewPath: '/system/com_levin_oak_base/dev/TestDemo.vue',
        }),
      ]),
    );
  });

  it('registers the payment simulation workbench route and backend mapping', () => {
    const module = createOakBaseAdminModule();
    const crudRoutes = flattenCrudRoutes(module.routes?.[0]?.children);

    expect(crudRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'PaymentSimulationWorkbench',
            title: '支付模拟工作台',
          }),
          name: '_clob_V1_PaymentSimulationWorkbench',
          path: '/clob/V1/PaymentSimulationWorkbench',
        }),
      ]),
    );

    expect(oakBaseAdminBackendRouteMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/clob/V1/PaymentSimulationWorkbench',
          sourceFilePath:
            'modules/com_levin_oak_base/views/payment-simulation-workbench/index.vue',
          title: '支付模拟工作台',
          viewPath:
            '/system/com_levin_oak_base/payment-simulation-workbench/index.vue',
        }),
      ]),
    );
  });

  it('注册设置历史独立页面及查询详情删除操作', () => {
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/SettingHistoryData',
    );
    expect(mapping).toMatchObject({
      resource: 'SettingHistoryData',
      sourceFilePath: 'modules/com_levin_oak_base/views/setting-history-data/index.vue',
      viewPath: '/system/com_levin_oak_base/setting-history-data/index.vue',
    });
    const operations = mapping?.operations?.map((operation) => operation.opName);
    expect(operations).toEqual(expect.arrayContaining(['retrieve', 'delete']));
    expect(operations).not.toContain('create');
    expect(operations).not.toContain('update');
  });

  it('groups development support pages under development tools', () => {
    const module = createOakBaseAdminModule();
    const root = module.routes?.[0];
    const developmentToolsGroup = root?.children?.find(
      (route) => route.meta?.title === '开发&工具',
    );
    const basicSettingsGroup = root?.children?.find(
      (route) => route.meta?.title === '基础&设置',
    );
    const paymentGroup = root?.children?.find(
      (route) => route.meta?.title === '支付&交易',
    );
    const movedResources = [
      'PaymentSimulationWorkbench',
      'UiSetting',
      'SettingHistoryData',
      'GlobalOrgSelectorSetting',
      'ImportExportTemplate',
      'ServicePlugin',
      'ServicePluginSetting',
      'Area',
      'Nation',
      'I18nRes',
    ];
    const resourceNames = (routes: any[] | undefined) =>
      routes?.map((route) => route.meta?.crudResource) || [];

    expect(resourceNames(developmentToolsGroup?.children)).toEqual(
      expect.arrayContaining(movedResources),
    );
    expect(resourceNames(basicSettingsGroup?.children)).not.toEqual(
      expect.arrayContaining(movedResources.slice(1)),
    );
    expect(resourceNames(paymentGroup?.children)).not.toContain(
      'PaymentSimulationWorkbench',
    );
  });

  it('groups my messages with the personal center routes', () => {
    const module = createOakBaseAdminModule();
    const root = module.routes?.[0];
    const personalCenterGroup = root?.children?.find(
      (route) => route.meta?.title === '个人&中心',
    );

    expect(personalCenterGroup?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'MyMessages',
            title: '我的消息',
          }),
          path: '/clob/V1/MyMessages',
        }),
      ]),
    );
    expect(oakBaseAdminBackendRouteMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/clob/V1/MyMessages',
          sourceFilePath:
            'modules/com_levin_oak_base/views/my-messages/index.vue',
          title: '我的消息',
          viewPath: '/system/com_levin_oak_base/my-messages/index.vue',
        }),
      ]),
    );
  });

  it('does not register the removed verify code audit route', () => {
    const module = createOakBaseAdminModule();
    const crudRoutes = flattenCrudRoutes(module.routes?.[0]?.children);

    expect(crudRoutes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({ crudResource: 'VerifyCodeAudit' }),
        }),
      ]),
    );
    expect(oakBaseAdminBackendRouteMappings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/clob/V1/VerifyCodeAudit' }),
      ]),
    );
  });

  it('registers electronic invoice pages and their backend mappings', () => {
    const module = createOakBaseAdminModule();
    const crudRoutes = flattenCrudRoutes(module.routes?.[0]?.children);

    expect(crudRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'EInvoice',
            title: '电子发票',
          }),
          path: '/clob/V1/EInvoice',
        }),
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'EInvoiceProviderConnection',
            title: '电子发票供应商连接',
          }),
          path: '/clob/V1/EInvoiceProviderConnection',
        }),
      ]),
    );

    expect(oakBaseAdminBackendRouteMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/clob/V1/EInvoice',
          sourceFilePath:
            'modules/com_levin_oak_base/views/electronic-invoice/index.vue',
          viewPath: '/system/com_levin_oak_base/electronic-invoice/index.vue',
        }),
        expect.objectContaining({
          path: '/clob/V1/EInvoiceProviderConnection',
          sourceFilePath:
            'modules/com_levin_oak_base/views/electronic-invoice-provider-connection/index.vue',
          viewPath:
            '/system/com_levin_oak_base/electronic-invoice-provider-connection/index.vue',
        }),
      ]),
    );
  });
});
