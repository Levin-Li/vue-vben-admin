import type { AdminBackendRouteMapping } from '@levin/admin-framework';

import { oakBaseAdminCrudResources } from './admin-crud';

const MODULE_VIEW_PREFIX = '/system/com_levin_oak_base';
const MODULE_SOURCE_PREFIX = 'modules/com_levin_oak_base/views';
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
  const pageDirectory = toKebabCase(item.name);

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
