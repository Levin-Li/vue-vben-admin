import type { AdminBackendRouteMapping } from '@levin/admin-framework';

import {
  buildAdminPageOperations,
  getServiceMeta,
} from '@levin/admin-framework';

import {
  oakBaseAdminCrudResources,
  oakWorkflowMenuGroup,
  oakWorkflowResources,
} from './admin-crud';
import * as oakBaseApi from './api';
import { pageMeta as dailyAccessStatPageMeta } from './views/daily-access-stat/config';
import { pageMeta as dataModelRecordPageMeta } from './views/data-model-record-page/config';
import { pageMeta as dataModelPageMeta } from './views/data-model/config';
import { pageMeta as notificationAuditPageMeta } from './views/notification-audit/config';
import { pageMeta as robotNotifyGroupPageMeta } from './views/robot-notify-group/config';
import { pageMeta as supportMailboxRulePageMeta } from './views/support-mailbox-rule/config';
import { pageMeta as ticketQueuePageMeta } from './views/ticket-queue/config';
import { pageMeta as ticketPageMeta } from './views/ticket/config';
import { pageMeta as workflowNotificationRoutePageMeta } from './views/workflow-notification-route/config';

const MODULE_VIEW_PREFIX = '/system/com_levin_oak_base';
const MODULE_SOURCE_PREFIX = 'modules/com_levin_oak_base/views';

interface PageMeta {
  description: string;
  name: string;
  title: string;
}

// 新业务页的元数据显式 eager 注册，服务运行期间新增文件也不会依赖旧 glob 缓存。
// 源码与构建包分别使用 ts/mjs，索引键统一为同一个逻辑页面位置。
const discoveredPageMeta = import.meta.glob(
  ['./views/**/config.ts', './views/**/config.mjs'],
  {
    eager: true,
    import: 'pageMeta',
  },
) as Record<string, PageMeta>;
const pageMetaModules: Record<string, PageMeta> = {
  ...Object.fromEntries(
    Object.entries(discoveredPageMeta).map(([path, metadata]) => [
      path.replace(/\.mjs$/, '.ts'),
      metadata,
    ]),
  ),
  './views/data-model/config.ts': dataModelPageMeta,
  './views/data-model-record-page/config.ts': dataModelRecordPageMeta,
  './views/daily-access-stat/config.ts': dailyAccessStatPageMeta,
  './views/notification-audit/config.ts': notificationAuditPageMeta,
  './views/robot-notify-group/config.ts': robotNotifyGroupPageMeta,
  './views/support-mailbox-rule/config.ts': supportMailboxRulePageMeta,
  './views/ticket-queue/config.ts': ticketQueuePageMeta,
  './views/ticket/config.ts': ticketPageMeta,
  './views/workflow-notification-route/config.ts':
    workflowNotificationRoutePageMeta,
};

function getPageMeta(sourceFilePath: string): PageMeta {
  const relativePagePath = sourceFilePath
    .replace(`${MODULE_SOURCE_PREFIX}/`, '')
    .replace(/\/[^/]+$/, '');
  const metadataPath = `./views/${relativePagePath}/config.ts`;
  const pageMeta = pageMetaModules[metadataPath];

  if (!pageMeta) {
    throw new Error(`页面缺少 pageMeta：${sourceFilePath}`);
  }

  return pageMeta;
}

/**
 * 实际页面目录不一定等于实体短类名的 kebab-case。
 * 电子合同以完整领域名称命名，避免生成 EContract 时产生难读且不存在的 e-contract 路径。
 */
const CRUD_PAGE_DIRECTORY_OVERRIDES: Readonly<Record<string, string>> = {
  EContract: 'electronic-contract',
  EContractTemplate: 'electronic-contract-template',
  EInvoice: 'electronic-invoice',
  EInvoiceProviderConnection: 'electronic-invoice-provider-connection',
};
const CRUD_ROUTE_PATH_PREFIX = '/clob/V1';

function toKebabCase(value: string) {
  return value
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function getPageOperations(resource: string) {
  if (resource === 'Ticket')
    return buildAdminPageOperations(oakBaseApi.ticketService);
  if (resource === 'TicketQueue')
    return buildAdminPageOperations(oakBaseApi.ticketQueueService);
  if (resource === 'SupportMailboxRule')
    return buildAdminPageOperations(oakBaseApi.supportMailboxRuleService);
  if (resource === 'NotificationAudit')
    return buildAdminPageOperations(oakBaseApi.notificationAuditService);
  // 工作流宿主页组合两个明确控制器的操作；运行页复用公共服务但仍上传真实操作权限。
  if (resource === 'WorkflowDefinition') {
    return [
      ...buildAdminPageOperations(oakBaseApi.workflowDefinitionService),
      ...buildAdminPageOperations(
        oakBaseApi.workflowDefinitionVersionService,
      ).map((operation) =>
        operation.opName === 'create'
          ? { ...operation, opName: 'createVersion' }
          : operation,
      ),
    ];
  }
  if (resource === 'WorkflowStart') {
    return buildAdminPageOperations(oakBaseApi.workflowRuntimeService).filter(
      (operation) =>
        ['businessRecords', 'eligibility', 'manualStarts', 'start'].includes(
          operation.opName,
        ),
    );
  }
  if (resource === 'MyWorkflow')
    return buildAdminPageOperations(oakBaseApi.workflowRuntimeService);
  if (resource === 'WorkflowInstance')
    return buildAdminPageOperations(oakBaseApi.workflowManagementService);
  if (resource === 'WorkflowRequest') {
    return [
      ...buildAdminPageOperations(oakBaseApi.workflowRequestService),
      ...buildAdminPageOperations(oakBaseApi.workflowRuntimeService).filter(
        (operation) => ['retry', 'start'].includes(operation.opName),
      ),
    ];
  }
  const expectedBasePath = `/${resource}`;
  const service = Object.values<unknown>(oakBaseApi).find(
    (candidate): candidate is object =>
      Boolean(candidate) &&
      typeof candidate === 'object' &&
      getServiceMeta(candidate).basePath === expectedBasePath,
  );

  const operations = buildAdminPageOperations(service);
  // 原业务页的通用流程抽屉复用公开运行接口；登记权限仅用于分配，不会自动授予。
  if (
    [
      'Address',
      'Article',
      'ChannelPartner',
      'EContract',
      'SupplierPartner',
      'User',
    ].includes(resource)
  ) {
    return [
      ...operations,
      ...buildAdminPageOperations(oakBaseApi.workflowRuntimeService)
        .filter((operation) =>
          [
            'catalog',
            'eligibility',
            'history',
            'newRound',
            'resubmit',
            'retry',
            'roundState',
            'start',
          ].includes(operation.opName),
        )
        .map((operation) => ({
          ...operation,
          opName: `workflow${operation.opName.charAt(0).toUpperCase()}${operation.opName.slice(1)}`,
        })),
    ];
  }
  return operations;
}

function createCrudBackendRouteMapping(
  item: (typeof oakBaseAdminCrudResources)[number],
): AdminBackendRouteMapping {
  const pageDirectory =
    CRUD_PAGE_DIRECTORY_OVERRIDES[item.resource] || toKebabCase(item.name);
  const sourceFilePath =
    item.sourceFilePath || `${MODULE_SOURCE_PREFIX}/${pageDirectory}/index.vue`;
  const pageMeta = getPageMeta(sourceFilePath);

  return {
    description: pageMeta.description,
    icon: item.icon,
    keepAlive: true,
    // 分组只供前端授权后导航使用，不修改后端授权菜单或页面路径。
    ...(oakWorkflowResources.includes(item.resource)
      ? { menuGroup: oakWorkflowMenuGroup }
      : {}),
    operations: getPageOperations(item.permissionResource || item.resource),
    // 个人消息由登录态和服务端精确受众校验；没有菜单时仍允许从通知铃铛进入。
    ...(item.resource === 'MyMessages'
      ? { onlyRequireAuthenticated: true }
      : {}),
    path: `${CRUD_ROUTE_PATH_PREFIX}/${item.routePath || item.resource}`,
    resource: item.permissionResource || item.resource,
    sourceFilePath,
    title: pageMeta.title,
    viewPath:
      item.viewPath || `${MODULE_VIEW_PREFIX}/${pageDirectory}/index.vue`,
  };
}

export const oakBaseAdminBackendRouteMappings: AdminBackendRouteMapping[] = [
  {
    description: dataModelRecordPageMeta.description,
    hideInMenu: true,
    icon: 'lucide:table-properties',
    operations: buildAdminPageOperations(oakBaseApi.dataModelService).filter(
      (item) =>
        [
          'createRecord',
          'deleteRecord',
          'queryRecords',
          'setEnabled',
          'updateRecord',
        ].includes(item.opName),
    ),
    path: '/clob/V1/DataModelRecord',
    onlyRequireAuthenticated: true,
    resource: 'DataModelRecord',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/data-model-record-page/index.vue`,
    title: dataModelRecordPageMeta.title,
    viewPath: `${MODULE_VIEW_PREFIX}/data-model-record-page/index.vue`,
  },
  {
    description: getPageMeta(`${MODULE_SOURCE_PREFIX}/help-center/index.vue`)
      .description,
    fullPathKey: false,
    icon: 'lucide:book-open',
    operations: [],
    onlyRequireAuthenticated: true,
    path: '/clob/V1/HelpCenter',
    resource: 'HelpCenter',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/help-center/index.vue`,
    title: getPageMeta(`${MODULE_SOURCE_PREFIX}/help-center/index.vue`).title,
    viewPath: `${MODULE_VIEW_PREFIX}/help-center/index.vue`,
  },
  {
    description: getPageMeta(
      `${MODULE_SOURCE_PREFIX}/named-scope-variable-acceptance/index.vue`,
    ).description,
    icon: 'lucide:scan-search',
    operations: [],
    onlyRequireAuthenticated: true,
    path: '/clob/V1/namedScopeVariableAcceptance',
    resource: 'NamedScopeVariableAcceptance',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/named-scope-variable-acceptance/index.vue`,
    title: getPageMeta(
      `${MODULE_SOURCE_PREFIX}/named-scope-variable-acceptance/index.vue`,
    ).title,
    viewPath: `${MODULE_VIEW_PREFIX}/named-scope-variable-acceptance/index.vue`,
  },
  {
    description: getPageMeta(`${MODULE_SOURCE_PREFIX}/acl-test/index.vue`)
      .description,
    title: getPageMeta(`${MODULE_SOURCE_PREFIX}/acl-test/index.vue`).title,
    icon: 'lucide:shield-check',
    operations: buildAdminPageOperations(oakBaseApi.aclTestService),
    onlyRequireAuthenticated: true,
    path: '/clob/V1/aclTest',
    resource: 'AclTest',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/acl-test/index.vue`,
    viewPath: `${MODULE_VIEW_PREFIX}/acl-test/index.vue`,
  },
  {
    description: getPageMeta(`${MODULE_SOURCE_PREFIX}/home/index.vue`)
      .description,
    icon: 'lucide:house',
    path: '/clob/V1/index',
    resource: 'AdminHome',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/home/index.vue`,
    title: getPageMeta(`${MODULE_SOURCE_PREFIX}/home/index.vue`).title,
    viewPath: `${MODULE_VIEW_PREFIX}/home/index.vue`,
  },
  {
    description: getPageMeta(
      `${MODULE_SOURCE_PREFIX}/setting-for-tenant/index.vue`,
    ).description,
    icon: 'lucide:building',
    path: '/clob/V1/SettingForTenant',
    resource: 'SettingForTenant',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/setting-for-tenant/index.vue`,
    title: getPageMeta(`${MODULE_SOURCE_PREFIX}/setting-for-tenant/index.vue`)
      .title,
    viewPath: `${MODULE_VIEW_PREFIX}/setting-for-tenant/index.vue`,
  },
  {
    description: getPageMeta(
      `${MODULE_SOURCE_PREFIX}/tenant-plugin-setting/index.vue`,
    ).description,
    icon: 'lucide:plug-zap',
    path: '/clob/V1/TenantPluginSetting',
    resource: 'TenantPluginSetting',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/tenant-plugin-setting/index.vue`,
    title: getPageMeta(
      `${MODULE_SOURCE_PREFIX}/tenant-plugin-setting/index.vue`,
    ).title,
    viewPath: `${MODULE_VIEW_PREFIX}/tenant-plugin-setting/index.vue`,
  },
  ...oakBaseAdminCrudResources.map((item) =>
    createCrudBackendRouteMapping(item),
  ),
];
