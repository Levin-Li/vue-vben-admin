import type { AdminPageOperation } from './module-contract';

import {
  getCrudOpMeta,
  getResAuthorizeMeta,
  getServiceMeta,
  hasResAuthorizeMeta,
} from './api-authorize';

function joinPermissionPath(...parts: string[]) {
  const normalized = parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''));

  return normalized.length > 0 ? `/${normalized.join('/')}` : '';
}

function resolvePermissionType(authorizeType: string, serviceType: string) {
  if (!authorizeType) return serviceType;

  if (authorizeType.endsWith('-') && serviceType.startsWith(authorizeType)) {
    return serviceType;
  }

  return authorizeType;
}

function buildMethodPermissions(service: object, methodName: string) {
  const method = (service as Record<string, unknown>)[methodName];
  const authorize = getResAuthorizeMeta(
    typeof method === 'function' ? method : undefined,
  );

  if (authorize.ignored || authorize.onlyRequireAuthenticated) {
    return [];
  }

  const serviceMeta = getServiceMeta(service);
  const type = resolvePermissionType(authorize.type, serviceMeta.type || '');
  const expression =
    authorize.domain || type || authorize.res || authorize.action
      ? `${authorize.domain}:${type}:${authorize.res}:${authorize.action}`
      : '';
  const path = joinPermissionPath(serviceMeta.basePath || '', methodName);

  return [...new Set([expression, path].filter(Boolean))];
}

/**
 * Converts the page-facing controller operations already declared on a
 * frontend API service into the route-upload contract.  It deliberately only
 * includes @CRUD.Op methods: list/retrieve endpoints are page data contracts,
 * while an operation button is an explicit controller action.
 */
export function buildAdminPageOperations(
  service: null | object | undefined,
): AdminPageOperation[] {
  if (!service) return [];

  const prototype = Object.getPrototypeOf(service) as
    | Record<string, unknown>
    | null;
  if (!prototype) return [];

  return Object.getOwnPropertyNames(prototype).flatMap((methodName) => {
    if (methodName === 'constructor') return [];

    const method = prototype[methodName];
    if (typeof method !== 'function') return [];

    const crudOp = getCrudOpMeta(method);
    if (!crudOp || !hasResAuthorizeMeta(method)) return [];

    const authorize = getResAuthorizeMeta(method);
    const opName = crudOp.name || methodName;
    const label = crudOp.label || authorize.action || opName;

    return [
      {
        apiMethods: [methodName],
        description: crudOp.desc || authorize.remark || label,
        label,
        opName,
        requireAuthorizations: buildMethodPermissions(service, methodName),
      },
    ];
  });
}
