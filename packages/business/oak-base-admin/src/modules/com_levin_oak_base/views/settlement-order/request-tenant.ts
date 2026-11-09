import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

export function requestTenant(user: unknown, tenantId?: string) {
  const identity = user as null | {
    isTenantUser?: boolean;
    tenantUser?: boolean;
  };
  if (identity?.tenantUser === true || identity?.isTenantUser === true)
    return undefined;
  return isPlatformUser(user) ? tenantId : undefined;
}
