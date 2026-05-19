import type { AdminBackendRouteMapping } from '@levin/admin-framework';

import { oakBaseAdminCrudResources } from './admin-crud';

const MODULE_VIEW_PREFIX = '/system/com_levin_oak_base';
const MODULE_SOURCE_PREFIX = 'modules/com_levin_oak_base/views';

function toKebabCase(value: string) {
  return value
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

export const oakBaseAdminBackendRouteMappings: AdminBackendRouteMapping[] = [
  ...oakBaseAdminCrudResources.map((item) => ({
    deprecatedPaths:
      item.resource === 'RbacPermissionItem' ? ['/clob/V1/Permission'] : [],
    icon: item.icon,
    name: `${item.name}CrudPage`,
    path: `/clob/V1/${item.resource}`,
    resource: item.resource,
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/${toKebabCase(item.name)}/index.vue`,
    title: item.title,
    viewPath: `${MODULE_VIEW_PREFIX}/${toKebabCase(item.name)}/index.vue`,
  })),
  {
    icon: 'lucide:bell',
    name: 'MyMessagesPage',
    path: '/clob/V1/MyMessages',
    resource: 'MyMessages',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/my-messages/index.vue`,
    title: '我的消息',
    viewPath: `${MODULE_VIEW_PREFIX}/my-messages/index.vue`,
  },
  {
    icon: 'lucide:shield-check',
    name: 'DataPermissionPreview',
    path: `${MODULE_VIEW_PREFIX}/data-permission-preview`,
    resource: 'DataPermissionPreview',
    sourceFilePath: `${MODULE_SOURCE_PREFIX}/data-permission-preview/index.vue`,
    title: '数据权限分配预览',
    viewPath: `${MODULE_VIEW_PREFIX}/data-permission-preview/index.vue`,
  },
];
