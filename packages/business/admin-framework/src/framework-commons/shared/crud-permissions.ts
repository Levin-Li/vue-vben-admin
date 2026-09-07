import type { ServiceMeta } from '../api-authorize';
import type { CrudPageConfig } from './types';

import {
  getResAuthorizeMeta,
  getServiceMeta,
  hasResAuthorizeMeta,
} from '../api-authorize';

type CrudOperation = 'create' | 'delete' | 'list' | 'retrieve' | 'update';

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
  return buildApiMethodPermissions(config.apiService, operation);
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
  if (!hasResAuthorizeMeta(method)) return [];
  const authorizeMeta = getResAuthorizeMeta(method);

  if (authorizeMeta.ignored || authorizeMeta.onlyRequireAuthenticated) {
    return [];
  }

  if (
    ![
      authorizeMeta.domain,
      authorizeMeta.type,
      authorizeMeta.res,
      authorizeMeta.action,
    ].some((value) => value.trim())
  )
    return [];

  const serviceMeta = getServiceMeta(service);
  const domain = authorizeMeta.domain || '';
  const type = resolvePermissionType(authorizeMeta.type, serviceMeta);
  const res = authorizeMeta.res || '';
  const action = authorizeMeta.action || '';
  const expression =
    domain || type || res || action ? `${domain}:${type}:${res}:${action}` : '';
  return expression ? [expression] : [];
}
