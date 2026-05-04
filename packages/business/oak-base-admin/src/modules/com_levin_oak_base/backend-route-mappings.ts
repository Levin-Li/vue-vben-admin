import type { AdminBackendRouteMapping } from '@levin/admin-framework';

import { oakBaseAdminCrudResources } from './admin-crud';

const MODULE_VIEW_PREFIX = '/system/com_levin_oak_base';

function toKebabCase(value: string) {
  return value
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

export const oakBaseAdminBackendRouteMappings: AdminBackendRouteMapping[] = [
  ...oakBaseAdminCrudResources.map((item) => ({
    icon: 'lucide:panel-right-open',
    name: `${item.name}CrudPage`,
    resource: item.resource,
    sourcePath: `/clob/V1/${item.resource}`,
    title: item.title,
    view: `${MODULE_VIEW_PREFIX}/${toKebabCase(item.name)}/index.vue`,
  })),
  {
    icon: 'lucide:bell',
    name: 'MyMessagesPage',
    resource: 'MyMessages',
    sourcePath: '/clob/V1/MyMessages',
    title: '我的消息',
    view: `${MODULE_VIEW_PREFIX}/my-messages/index.vue`,
  },
  {
    icon: 'lucide:shield-check',
    name: 'DataPermissionPreview',
    resource: 'DataPermissionPreview',
    sourcePath: `${MODULE_VIEW_PREFIX}/data-permission-preview`,
    title: '数据权限分配预览',
    view: `${MODULE_VIEW_PREFIX}/data-permission-preview/index.vue`,
  },
];
