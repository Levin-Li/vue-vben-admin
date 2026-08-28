import type { AdminBackendRouteMapping } from '@levin/admin-framework';

import { oakBaseAdminCrudResources } from './admin-crud';

const MODULE_VIEW_PREFIX = '/system/com_levin_oak_base';
const MODULE_SOURCE_PREFIX = 'modules/com_levin_oak_base/views';

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

function createCrudBackendRouteMapping(
  item: (typeof oakBaseAdminCrudResources)[number],
): AdminBackendRouteMapping {
  const pageDirectory = CRUD_PAGE_DIRECTORY_OVERRIDES[item.resource] || toKebabCase(item.name);

  return {
    icon: item.icon,
    path: `${CRUD_ROUTE_PATH_PREFIX}/${item.resource}`,
    resource: item.resource,
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/${pageDirectory}/index.vue`,
    title: item.title,
    viewPath: `${MODULE_VIEW_PREFIX}/${pageDirectory}/index.vue`,
  };
}

export const oakBaseAdminBackendRouteMappings: AdminBackendRouteMapping[] = [
  {
    icon: 'lucide:house',
    path: '/clob/V1/index',
    resource: 'AdminHome',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/home/index.vue`,
    title: '后台管理',
    viewPath: `${MODULE_VIEW_PREFIX}/home/index.vue`,
  },
  ...oakBaseAdminCrudResources.map(createCrudBackendRouteMapping),
  {
    icon: 'lucide:bell',
    path: '/clob/V1/MyMessages',
    resource: 'MyMessages',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/my-messages/index.vue`,
    title: '我的消息',
    viewPath: `${MODULE_VIEW_PREFIX}/my-messages/index.vue`,
  },
];
