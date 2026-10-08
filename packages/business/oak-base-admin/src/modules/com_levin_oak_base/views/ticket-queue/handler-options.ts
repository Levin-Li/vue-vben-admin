import type { SupportScope } from '../../api/support-workbench-types';

import { useUserStore } from '@vben/runtime/stores';

import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

import { toGenericSupportRequestScope } from '../../api/support-request-scope';

export function buildQueueHandlerUserQuery(scope: SupportScope, name = '') {
  return toGenericSupportRequestScope({
    ...scope,
    enable: true,
    containsName: name,
    pageIndex: 1,
    pageSize: 100,
  });
}

export function buildQueueHandlerRoleQuery(scope: SupportScope, name = '') {
  // Roles are tenant-scoped, not organized. Queue handlers must belong to that tenant.
  return toGenericSupportRequestScope({
    tenantId: scope.tenantId,
    enable: true,
    containsName: name,
    containsPublicData: false,
    pageIndex: 1,
    pageSize: 100,
  });
}

export function isQueueHandlerRoleOption(
  item: { publicRole?: unknown; tenantId?: unknown },
  tenantId?: string,
) {
  if (item.publicRole === true) return false;
  if (isPlatformUser(useUserStore().userInfo))
    return Boolean(tenantId) && item.tenantId === tenantId;
  // Tenant visibility can mask this field; the formal directory query and save remain authoritative.
  return (
    item.tenantId === null ||
    item.tenantId === undefined ||
    item.tenantId === tenantId
  );
}
