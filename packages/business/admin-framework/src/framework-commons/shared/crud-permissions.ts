import type { CrudPageConfig } from './types';

import {
  getResAuthorizeMeta,
  getServiceMeta,
} from '../api-authorize';

type CrudOperation = 'create' | 'delete' | 'list' | 'retrieve' | 'update';

const DEFAULT_PERMISSION_DOMAIN = 'com.levin.oak.base';
const DEFAULT_PERMISSION_TYPE_PREFIX = '系统数据-';

const OPERATION_LABELS: Record<CrudOperation, string> = {
  create: '新增',
  delete: '删除',
  list: '查询列表',
  retrieve: '查看详情',
  update: '修改',
};

const OPERATION_PATHS: Record<CrudOperation, string> = {
  create: 'create',
  delete: 'delete',
  list: 'list',
  retrieve: 'retrieve',
  update: 'update',
};

function normalizeApiBase(apiBase: string) {
  return apiBase.startsWith('/') ? apiBase : `/${apiBase}`;
}

function derivePermissionResourceName(config: CrudPageConfig) {
  if (config.permissionResourceName) {
    return config.permissionResourceName;
  }

  return config.title.replace(/管理$/, '') || config.title;
}

export function buildCrudOperationPermissions(
  config: CrudPageConfig,
  operation: CrudOperation,
) {
  const domain = config.permissionDomain || DEFAULT_PERMISSION_DOMAIN;
  const typePrefix =
    config.permissionTypePrefix || DEFAULT_PERMISSION_TYPE_PREFIX;
  const resourceName = derivePermissionResourceName(config);
  const expression = `${domain}:${typePrefix}${resourceName}::${OPERATION_LABELS[operation]}`;
  const path = `${normalizeApiBase(config.apiBase)}/${OPERATION_PATHS[operation]}`;

  return [expression, path];
}

function joinPermissionPath(...parts: string[]) {
  const normalized = parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''));

  return normalized.length > 0 ? `/${normalized.join('/')}` : '';
}

export function buildApiMethodPermissions(
  service: null | object | undefined,
  methodName: string,
) {
  const method =
    service &&
    typeof (service as Record<string, unknown>)[methodName] === 'function'
      ? ((service as Record<string, unknown>)[methodName] as object)
      : undefined;
  const authorizeMeta = getResAuthorizeMeta(method);

  if (authorizeMeta.ignored || authorizeMeta.onlyRequireAuthenticated) {
    return [];
  }

  const serviceMeta = getServiceMeta(service);
  const domain = authorizeMeta.domain || '';
  const type = authorizeMeta.type || serviceMeta.type || '';
  const res = authorizeMeta.res || '';
  const action = authorizeMeta.action || '';
  const expression =
    domain || type || res || action ? `${domain}:${type}:${res}:${action}` : '';
  const path = joinPermissionPath(serviceMeta.basePath || '', methodName);

  return [...new Set([expression, path].filter(Boolean))];
}
