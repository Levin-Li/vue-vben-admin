import type { SupportScope } from '../api/support-workbench-types';

import { useUserStore } from '@vben/runtime/stores';

import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

import { toGenericSupportRequestScope } from '../api/support-request-scope';

export function buildSupportUserQuery(
  scope: Partial<SupportScope>,
  containsName = '',
) {
  return toGenericSupportRequestScope({
    tenantId: scope.tenantId,
    orgId: scope.orgId,
    enable: true,
    containsName,
    pageIndex: 1,
    pageSize: 100,
  });
}

export function buildMailboxSourceQuery(
  scope: SupportScope,
  local: boolean,
  search = '',
) {
  return toGenericSupportRequestScope({
    tenantId: scope.tenantId,
    enable: true,
    pageIndex: 1,
    pageSize: 100,
    ...(local
      ? {
          containsName: search,
          containsPublicData: false,
          lifecycleStatus: 'Active',
          emailReceivingEnabled: true,
        }
      : { containsLocalPart: search, syncStatus: 'Synced' }),
  });
}

export function usableMailboxSource(
  item: Record<string, any>,
  local: boolean,
  tenantId?: string,
) {
  // Platform responses can contain public rows; tenant responses may mask tenantId.
  if (
    (isPlatformUser(useUserStore().userInfo) ||
      (item.tenantId !== null && item.tenantId !== undefined)) &&
    item.tenantId !== tenantId
  )
    return false;
  if (item.enable !== true) return false;
  if (local) {
    if (
      item.lifecycleStatus !== 'Active' ||
      item.emailReceivingEnabled !== true
    )
      return false;
    if (item.domainExpiredTime) {
      const expiry = Date.parse(item.domainExpiredTime);
      if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
    }
    return true;
  }
  if (
    item.syncStatus !== 'Synced' ||
    !String(item.providerRouteId || '').trim()
  )
    return false;
  // targetList is deliberately masked for tenant users; server validates it on save/enable.
  return (
    !Array.isArray(item.targetList) ||
    item.targetList.some(
      (target: unknown) =>
        typeof target === 'string' && target.startsWith('mail-webhook:'),
    )
  );
}
