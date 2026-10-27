import { getResAuthorizeMeta, getServiceMeta } from '@levin/admin-framework';
import { groupAccessibleMenus } from '@levin/admin-framework/framework-commons/app/router/menu-display-groups';
import { describe, expect, it } from 'vitest';

import {
  oakBaseAdminCrudResources,
  oakBaseAdminResourceViewMap,
} from '../admin-crud';
import { noticeService } from '../api/notice-service';
import { workflowRuntimeService } from '../api/workflow-runtime-service';
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
  it('keeps standard CRUD tabs mounted across tab switches', () => {
    const root = createOakBaseAdminModule().routes?.[0];
    const setting = flattenCrudRoutes(root?.children).find(
      (route) => route.path === '/clob/V1/Setting',
    );
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/Setting',
    );
    const tenantSetting = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/SettingForTenant',
    );

    expect(setting?.meta?.keepAlive).toBe(true);
    expect(mapping?.keepAlive).toBe(true);
    expect(tenantSetting?.keepAlive).toBeUndefined();
  });

  it('结算单页面归入支付与交易并上传完整本地页面映射', () => {
    const root = createOakBaseAdminModule().routes?.[0];
    const group = root?.children?.find(
      (route) => route.meta?.title === '支付&交易',
    );
    const path = '/clob/V1/SettlementOrder';
    expect(group?.children?.find((route) => route.path === path)?.name).toBe(
      path.replaceAll('/', '_'),
    );
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === path,
    );
    expect(mapping).toMatchObject({
      resource: 'SettlementOrder',
      viewPath: '/system/com_levin_oak_base/settlement-order/index.vue',
      sourceFilePath:
        'modules/com_levin_oak_base/views/settlement-order/index.vue',
    });
    expect(mapping).not.toHaveProperty('name');
    expect(mapping?.menuGroup).toEqual({
      icon: 'lucide:wallet-cards',
      parentPath: '/clob/V1/index',
      path: '/clob/V1/index/groups/支付&交易',
      title: '支付&交易',
    });
    const authorizedMenus = [
      {
        name: '基础框架',
        path: '/clob/V1/index',
        children: [{ name: '结算单', path }],
      },
    ];
    const groupedMenus = groupAccessibleMenus(
      authorizedMenus,
      mapping ? [mapping] : [],
      [{ path: '/clob/V1/index', children: [{ path, component: {} }] }],
    );
    expect(groupedMenus[0]?.children?.[0]).toMatchObject({
      name: '支付&交易',
      path: '/clob/V1/index/groups/支付&交易',
      children: [{ name: '结算单', path }],
    });
    expect(groupedMenus[0]?.children?.map((item) => item.path)).toEqual([
      '/clob/V1/index/groups/支付&交易',
    ]);
    expect(authorizedMenus[0]?.children?.[0]?.path).toBe(path);
    expect(mapping?.operations?.map((item) => item.opName)).toEqual(
      expect.arrayContaining([
        'create',
        'update',
        'confirm',
        'invoice',
        'registerPayment',
        'adjustAmount',
        'readFinancialDetails',
      ]),
    );
    expect(mapping?.operations?.some((item) => item.opName === 'delete')).toBe(
      false,
    );
    expect(
      mapping?.operations?.find(
        (item) => item.opName === 'readFinancialDetails',
      )?.requireAuthorizations,
    ).toEqual(['com.levin.oak.base:业务数据:结算单:查看结算资料']);
  });

  it('供应商与渠道页归入既有客户与伙伴分组且不再注册混合页', () => {
    const root = createOakBaseAdminModule().routes?.[0];
    const group = root?.children?.find(
      (route) => route.meta?.title === '客户&伙伴',
    );
    for (const resource of ['SupplierPartner', 'ChannelPartner']) {
      const path = `/clob/V1/${resource}`;
      const page = group?.children?.find((route) => route.path === path);
      expect(page?.name).toBe(path.replaceAll('/', '_'));
      expect(
        oakBaseAdminBackendRouteMappings.find((item) => item.path === path)
          ?.resource,
      ).toBe(resource);
    }
    expect(oakBaseAdminResourceViewMap.Partner).toBeUndefined();
    expect(
      oakBaseAdminBackendRouteMappings.some(
        (item) => item.resource === 'Partner',
      ),
    ).toBe(false);
  });

  it('客户独立于会员和合作伙伴，归入客户与伙伴分组并上传标准操作', () => {
    const root = createOakBaseAdminModule().routes?.[0];
    const group = root?.children?.find(
      (route) => route.meta?.title === '客户&伙伴',
    );
    const page = group?.children?.find(
      (route) => route.path === '/clob/V1/Customer',
    );
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/Customer',
    );

    expect(page?.name).toBe('_clob_V1_Customer');
    expect(page?.meta?.crudResource).toBe('Customer');
    expect(mapping).toMatchObject({
      resource: 'Customer',
      sourceFilePath: 'modules/com_levin_oak_base/views/customer/index.vue',
      viewPath: '/system/com_levin_oak_base/customer/index.vue',
    });
    expect(mapping?.operations?.map((operation) => operation.opName)).toEqual(
      expect.arrayContaining(['create', 'retrieve', 'update']),
    );
    expect(
      mapping?.operations?.some((operation) => operation.opName === 'delete'),
    ).toBe(false);
  });

  it('不注册没有独立前端页面的后台资源', () => {
    const unsupported = [
      'AiModelCallAudit',
      'CryptoPayOrder',
      'CryptoSettlementEvent',
      'DataMigrationTask',
      'TenantApp',
      'WorkflowDefinitionVersion',
      'WorkflowNotificationDelivery',
      'WorkflowSimulationRun',
    ];
    const root = createOakBaseAdminModule().routes?.[0];
    const routes = flattenCrudRoutes(root?.children);

    for (const resource of unsupported) {
      expect(
        oakBaseAdminCrudResources.some((item) => item.resource === resource),
      ).toBe(false);
      expect(oakBaseAdminResourceViewMap[resource]).toBeUndefined();
      expect(
        routes.some((route) => route.path === `/clob/V1/${resource}`),
      ).toBe(false);
      expect(
        oakBaseAdminBackendRouteMappings.some(
          (item) => item.path === `/clob/V1/${resource}`,
        ),
      ).toBe(false);
    }
  });

  it('本人公告只读来源仅需登录，管理列表保留业务权限', () => {
    const source = getResAuthorizeMeta(
      noticeService.myDetail as Parameters<typeof getResAuthorizeMeta>[0],
    );
    const management = getResAuthorizeMeta(
      noticeService.list as Parameters<typeof getResAuthorizeMeta>[0],
    );
    expect(source.onlyRequireAuthenticated).toBe(true);
    expect(source.action).toBe('查看本人公告');
    expect(management.onlyRequireAuthenticated).not.toBe(true);
    expect(management.type).toBe('业务数据-通知');
  });

  it('工作流办理采用业务数据权限域，不误用平台设计权限', () => {
    expect(getServiceMeta(workflowRuntimeService).type).toBe(
      '业务数据-工作流运行时',
    );
    for (const key of [
      'catalog',
      'todo',
      'done',
      'started',
      'complete',
      'prepareStepUpAuth',
      'eligibility',
      'history',
      'start',
      'retry',
    ] as const) {
      // 装饰器在运行时附加符号元数据，静态方法签名不会体现该属性。
      const metadata = getResAuthorizeMeta(
        workflowRuntimeService[key] as Parameters<
          typeof getResAuthorizeMeta
        >[0],
      );
      expect(metadata.domain).toBe('WorkflowRuntime');
      expect(metadata.type).toBe('业务数据-工作流运行时');
    }
  });
  it('工作流设计、业务样例与个人办理页具有唯一业务归属及完整映射', () => {
    const root = createOakBaseAdminModule().routes?.[0];
    for (const [resource, directory, groupName] of [
      ['WorkflowDefinition', 'workflow-definition', '工作流'],
      ['WorkflowInstance', 'workflow-instance', '工作流'],
      ['WorkflowNotificationRoute', 'workflow-notification-route', '工作流'],
      ['RobotNotifyGroup', 'robot-notify-group', '基础&设置'],
      ['WorkflowRequest', 'workflow-request', '工作流'],
      ['MyWorkflow', 'my-workflow', '工作流'],
      ['WorkflowStart', 'workflow-start', '工作流'],
    ]) {
      const group = root?.children?.find(
        (item) => item.meta?.title === groupName,
      );
      const route = group?.children?.find(
        (item) => item.path === `/clob/V1/${resource}`,
      );
      expect(route?.name).toBe(route?.path.replaceAll('/', '_'));
      expect(route?.component).toBeTypeOf('function');
      expect(
        oakBaseAdminBackendRouteMappings.filter(
          (item) => item.path === route?.path,
        ),
      ).toEqual([
        expect.objectContaining({
          sourceFilePath: `modules/com_levin_oak_base/views/${directory}/index.vue`,
          viewPath: `/system/com_levin_oak_base/${directory}/index.vue`,
        }),
      ]);
    }
    // 本地路由与导航分组声明一致；通用通知投递保留运维入口。
    const workflowGroup = root?.children?.find(
      (item) => item.meta?.title === '工作流',
    );
    expect(workflowGroup?.meta?.icon).toBe('lucide:git-branch');
    expect(workflowGroup?.children?.map((item) => item.path)).toEqual([
      '/clob/V1/WorkflowDefinition',
      '/clob/V1/WorkflowStart',
      '/clob/V1/MyWorkflow',
      '/clob/V1/WorkflowInstance',
      '/clob/V1/WorkflowNotificationRoute',
      '/clob/V1/WorkflowRequest',
    ]);
    for (const route of workflowGroup?.children || []) {
      expect(
        oakBaseAdminBackendRouteMappings.find(
          (item) => item.path === route.path,
        )?.menuGroup,
      ).toMatchObject({
        parentPath: '/clob/V1/index',
        path: '/clob/V1/index/groups/工作流',
        title: '工作流',
      });
      expect(
        flattenCrudRoutes(root?.children).filter(
          (item) => item.path === route.path,
        ),
      ).toHaveLength(1);
    }
    expect(
      root?.children
        ?.find((item) => item.meta?.title === '运维&审计')
        ?.children?.some((item) => item.path === '/clob/V1/NotificationAudit'),
    ).toBe(true);
    const design = oakBaseAdminBackendRouteMappings.find(
      (item) => item.resource === 'WorkflowDefinition',
    );
    expect(design?.operations?.map((item) => item.opName)).toEqual(
      expect.arrayContaining([
        'create',
        'createVersion',
        'saveDraft',
        'startSimulation',
        'publishAfterSimulation',
      ]),
    );
  });
  it('邮件工单独立控制页归入已确定分组并登记真实动作', () => {
    const root = createOakBaseAdminModule().routes?.[0];
    for (const [resource, directory, groupName, actions] of [
      [
        'Ticket',
        'ticket',
        '客户&伙伴',
        [
          'list',
          'retrieve',
          'messages',
          'assign',
          'start',
          'resolve',
          'reopen',
          'close',
          'confirmContact',
          'reply',
          'outbound',
          'retryOutbound',
          'resolveOutboundUnsent',
          'attachmentDownload',
        ],
      ],
      [
        'TicketQueue',
        'ticket-queue',
        '客户&伙伴',
        ['list', 'retrieve', 'save', 'setEnabled'],
      ],
      [
        'SupportMailboxSetting',
        'support-mailbox-setting',
        '应用&接入',
        ['list', 'retrieve', 'create', 'update', 'enable', 'disable'],
      ],
      [
        'NotificationAudit',
        'notification-audit',
        '运维&审计',
        ['list', 'retrieve', 'retry', 'resolveUnsent'],
      ],
    ] as const) {
      const group = root?.children?.find(
        (item) => item.meta?.title === groupName,
      );
      const route = group?.children?.find(
        (item) => item.path === `/clob/V1/${resource}`,
      );
      expect(route?.name).toBe(`/clob/V1/${resource}`.replaceAll('/', '_'));
      const mapping = oakBaseAdminBackendRouteMappings.find(
        (item) => item.path === route?.path,
      );
      expect(mapping?.viewPath).toBe(
        `/system/com_levin_oak_base/${directory}/index.vue`,
      );
      expect(mapping?.sourceFilePath).toBe(
        `modules/com_levin_oak_base/views/${directory}/index.vue`,
      );
      expect(mapping?.operations?.map((item) => item.opName)).toEqual(
        expect.arrayContaining([...actions]),
      );
    }
    expect(
      oakBaseAdminCrudResources.some((item) =>
        [
          'MailBlob',
          'NotificationDelivery',
          'NotificationDeliveryAttempt',
          'NotificationEvent',
          'TicketMessage',
          'UserMessage',
        ].includes(item.resource),
      ),
    ).toBe(false);
  });

  it('默认将所有可生成 CRUD 页面唯一归入十一个带语义图标的业务分组', () => {
    const module = createOakBaseAdminModule();
    const root = module.routes?.[0];
    const expectedGroupIcons = {
      '用户&权限': 'lucide:shield-check',
      '租户&域名': 'lucide:building-2',
      '应用&接入': 'lucide:app-window',
      '支付&交易': 'lucide:wallet-cards',
      '客户&伙伴': 'lucide:handshake',
      '内容&资源': 'lucide:folder-open',
      '基础&设置': 'lucide:settings-2',
      工作流: 'lucide:git-branch',
      '开发&工具': 'lucide:code-2',
      '个人&中心': 'lucide:circle-user-round',
      '运维&审计': 'lucide:clipboard-check',
    };

    // 页面路径是 CRUD 资源的稳定唯一标识，按映射表验证所有默认页面均被纳入业务分组。
    const groupedCrudRoutes = flattenCrudRoutes(root?.children);
    const expectedPaths = oakBaseAdminCrudResources
      .filter((resource) => oakBaseAdminResourceViewMap[resource.resource])
      .map((resource) => `/clob/V1/${resource.routePath || resource.resource}`)
      .toSorted();
    const actualPaths = groupedCrudRoutes.map((route) => route.path).toSorted();

    expect(actualPaths).toEqual(expectedPaths);
    expect(new Set(actualPaths)).toHaveLength(actualPaths.length);
    expect(
      root?.children?.filter((route) => route.meta?.crudResource),
    ).toHaveLength(0);

    for (const [title, icon] of Object.entries(expectedGroupIcons)) {
      const group = root?.children?.find(
        (route) => route.meta?.title === title,
      );
      expect(group?.meta?.icon).toBe(icon);
      expect(group?.children).toBeTruthy();
    }
  });

  it('平台领域页面位于基础设置二级分组且保留稳定路由地址', () => {
    const module = createOakBaseAdminModule();
    const root = module.routes?.[0];
    const group = root?.children?.find(
      (route) => route.meta?.title === '基础&设置',
    );
    const page = group?.children?.find(
      (route) => route.meta?.crudResource === 'PlatformDomain',
    );

    expect(page?.path).toBe('/clob/V1/PlatformDomain');
    expect(page?.name).toBe('_clob_V1_PlatformDomain');
    expect(page?.component).toBeTypeOf('function');
    expect(
      root?.children?.filter((route) => route.meta?.title === '基础&设置'),
    ).toHaveLength(1);
  });

  it('访问控制测试页可独立直达且有完整页面映射', () => {
    const normal = createOakBaseAdminModule();
    const explicit = createOakBaseAdminModule({ crud: false });
    const developmentToolsGroup = normal.routes?.[0]?.children?.find(
      (route) => route.meta?.title === '开发&工具',
    );
    for (const routes of [developmentToolsGroup?.children, explicit.routes]) {
      const route = routes?.find((item) => item.path === '/clob/V1/aclTest');
      expect(route?.name).toBe('_clob_V1_aclTest');
      expect(route?.meta?.crudResource).toBeUndefined();
      expect(route?.component).toBeTypeOf('function');
    }
    expect(oakBaseAdminBackendRouteMappings).toContainEqual(
      expect.objectContaining({
        path: '/clob/V1/aclTest',
        onlyRequireAuthenticated: true,
        sourceFilePath: 'modules/com_levin_oak_base/views/acl-test/index.vue',
        viewPath: '/system/com_levin_oak_base/acl-test/index.vue',
      }),
    );
  });
  it('审计管理页面位于基础模块运维分组且具有可用本地映射', () => {
    const module = createOakBaseAdminModule();
    const root = module.routes?.[0];
    const group = root?.children?.find(
      (route) => route.meta?.title === '运维&审计',
    );
    for (const resource of ['AuditReport', 'BackendFixedJob']) {
      const page = group?.children?.find(
        (route) => route.meta?.crudResource === resource,
      );
      expect(page?.path).toBe(`/clob/V1/${resource}`);
      expect(page?.name).toBe(`/clob/V1/${resource}`.replaceAll('/', '_'));
      expect(page?.component).toBeTypeOf('function');
      expect(module.routes?.some((route) => route.path === page?.path)).toBe(
        false,
      );
      const mapping = oakBaseAdminBackendRouteMappings.find(
        (item) => item.resource === resource,
      );
      expect(mapping?.sourceFilePath).toMatch(
        /views\/(audit-report|backend-fixed-job)\/index.vue$/,
      );
      expect(mapping?.viewPath).toMatch(
        /\/(audit-report|backend-fixed-job)\/index.vue$/,
      );
      expect(mapping?.operations?.some((op) => op.opName === 'retrieve')).toBe(
        true,
      );
    }
  });

  it('导入导出模板页面只上传显式资源权限，不添加接口路径', () => {
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.resource === 'ImportExportTemplate',
    );
    expect(
      mapping?.operations?.find((item) => item.opName === 'retrieve')
        ?.requireAuthorizations,
    ).toEqual(['com.levin.oak.base:业务数据-导入导出模板::查看详情']);
    for (const route of oakBaseAdminBackendRouteMappings) {
      for (const operation of route.operations || []) {
        expect(
          operation.requireAuthorizations.some((permission) =>
            permission.startsWith('/'),
          ),
        ).toBe(false);
      }
    }
  });

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
          requireAuthorizations: ['com.levin.oak.base:系统数据-字典::新增'],
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
            title: '流控规则',
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
          title: '流控规则',
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

  it('registers the runtime schema form test page under development tools', () => {
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
            title: '动态表单测试',
          }),
          name: '_clob_V1_dev_RuntimeSchemaFormDemo',
          path: '/clob/V1/dev/RuntimeSchemaFormDemo',
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
      sourceFilePath:
        'modules/com_levin_oak_base/views/setting-history-data/index.vue',
      viewPath: '/system/com_levin_oak_base/setting-history-data/index.vue',
    });
    const operations = mapping?.operations?.map(
      (operation) => operation.opName,
    );
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
          onlyRequireAuthenticated: true,
          sourceFilePath:
            'modules/com_levin_oak_base/views/my-messages/index.vue',
          title: '我的消息',
          viewPath: '/system/com_levin_oak_base/my-messages/index.vue',
        }),
      ]),
    );
    // 个人消息由登录态和服务端受众过滤保护，其他业务页仍须取得后端菜单授权。
    expect(
      oakBaseAdminBackendRouteMappings.find(
        (item) => item.path === '/clob/V1/WorkflowRequest',
      )?.onlyRequireAuthenticated,
    ).not.toBe(true);
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
            title: '开票申请',
          }),
          path: '/clob/V1/EInvoice',
        }),
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'EInvoiceProviderConnection',
            title: '开票授权',
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
