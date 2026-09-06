import {
  buildAdminPageOperations,
  getServiceMeta,
  type AdminBackendRouteMapping,
} from '@levin/admin-framework';

import { oakBaseAdminCrudResources } from './admin-crud';
import * as oakBaseApi from './api';

const MODULE_VIEW_PREFIX = '/system/com_levin_oak_base';
const MODULE_SOURCE_PREFIX = 'modules/com_levin_oak_base/views';

interface PageMeta {
  description: string;
  name: string;
  title: string;
}

const pageMetaModules = import.meta.glob('./views/**/config.ts', {
  eager: true,
  import: 'pageMeta',
}) as Record<string, PageMeta>;

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
  const expectedBasePath = `/${resource}`;
  const service = Object.values(oakBaseApi).find(
    (candidate): candidate is object =>
      Boolean(candidate) &&
      typeof candidate === 'object' &&
      getServiceMeta(candidate).basePath === expectedBasePath,
  );

  return buildAdminPageOperations(service);
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
    name: pageMeta.name,
    operations: getPageOperations(item.permissionResource || item.resource),
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
    description: getPageMeta(`${MODULE_SOURCE_PREFIX}/home/index.vue`)
      .description,
    icon: 'lucide:house',
    name: getPageMeta(`${MODULE_SOURCE_PREFIX}/home/index.vue`).name,
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
    name: getPageMeta(`${MODULE_SOURCE_PREFIX}/setting-for-tenant/index.vue`)
      .name,
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
    name: getPageMeta(`${MODULE_SOURCE_PREFIX}/tenant-plugin-setting/index.vue`)
      .name,
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
