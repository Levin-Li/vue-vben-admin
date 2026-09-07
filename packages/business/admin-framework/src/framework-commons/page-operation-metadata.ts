import type { AdminPageOperation } from './module-contract';

import {
  getCrudOpMeta,
  getResAuthorizeMeta,
  hasResAuthorizeMeta,
} from './api-authorize';
import { buildApiMethodPermissions } from './shared/crud-permissions';

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

  const prototype = Object.getPrototypeOf(service) as null | Record<
    string,
    unknown
  >;
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
        requireAuthorizations: buildApiMethodPermissions(service, methodName),
      },
    ];
  });
}
