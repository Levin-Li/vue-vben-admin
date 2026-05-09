import type { CrudPageConfig } from './types';

import type { ServiceMeta } from '../api-authorize';

import {
  getResAuthorizeMeta,
  getServiceMeta,
  hasResAuthorizeMeta,
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

function derivePermissionType(
  config: CrudPageConfig,
  serviceMeta: ServiceMeta,
) {
  if (serviceMeta.type) {
    return resolvePermissionType(serviceMeta.type, serviceMeta);
  }

  if (config.permissionResourceName) {
    return `${config.permissionTypePrefix || DEFAULT_PERMISSION_TYPE_PREFIX}${config.permissionResourceName}`;
  }

  return `${config.permissionTypePrefix || DEFAULT_PERMISSION_TYPE_PREFIX}${config.title}`;
}

export function resolvePermissionType(
  authorizeType: string | undefined,
  serviceMeta: ServiceMeta,
) {
  const type = String(authorizeType || '').trim();
  const serviceType = String(serviceMeta.type || '').trim();

  if (!type) {
    return serviceType;
  }

  if (type.endsWith('-')) {
    const tagName = String(serviceMeta.title || '').trim();

    if (tagName) {
      return `${type}${tagName}`;
    }

    if (serviceType.startsWith(type)) {
      return serviceType;
    }
  }

  return type;
}

export function buildCrudOperationPermissions(
  config: CrudPageConfig,
  operation: CrudOperation,
) {
  const apiMethodName = OPERATION_PATHS[operation];
  const apiService = config.apiService as
    | (Record<string, unknown> & object)
    | undefined;
  const serviceMethod =
    apiService && typeof apiService[apiMethodName] === 'function'
      ? apiService[apiMethodName]
      : undefined;

  if (hasResAuthorizeMeta(serviceMethod)) {
    return buildApiMethodPermissions(config.apiService, apiMethodName);
  }

  const serviceMeta = getServiceMeta(config.apiService);
  const domain = config.permissionDomain || DEFAULT_PERMISSION_DOMAIN;
  const type = derivePermissionType(config, serviceMeta);
  const expression = `${domain}:${type}::${OPERATION_LABELS[operation]}`;
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
  const type = resolvePermissionType(authorizeMeta.type, serviceMeta);
  const res = authorizeMeta.res || '';
  const action = authorizeMeta.action || '';
  const expression =
    domain || type || res || action ? `${domain}:${type}:${res}:${action}` : '';
  const path = joinPermissionPath(serviceMeta.basePath || '', methodName);

  return [...new Set([expression, path].filter(Boolean))];
}
