import { useUserStore } from '@vben/runtime/stores';

import { omitNonPlatformTenantId } from '@levin/admin-framework/framework-commons/shared/crud-retrieve-context';
import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

/** Generic tenant DTOs obtain tenant identity from the server for tenant actors. */
export function toGenericSupportRequestScope<T extends Record<string, any>>(
  params: T,
): T {
  const scopedParams =
    typeof params.orgId === 'string' &&
    params.orgId.trim() &&
    !Object.hasOwn(params, 'orgIdList')
      ? { ...params, orgIdList: [params.orgId] }
      : params;
  return omitNonPlatformTenantId(
    scopedParams,
    isPlatformUser(useUserStore().userInfo),
  );
}
