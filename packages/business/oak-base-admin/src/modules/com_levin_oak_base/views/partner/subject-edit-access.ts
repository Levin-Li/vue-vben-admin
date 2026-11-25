import {
  isPlatformUser,
  isSuperAdminUser,
  isTenantAdminUser,
  isTopSuperAdminUser,
} from '@levin/admin-framework/framework-commons/shared/user-identity';

const knownStatuses = new Set([
  'Draft',
  'AuditPending',
  'AuditRejected',
  'Certified',
  'Revoked',
]);

// 只决定界面按钮；实际权限、数据范围和状态由主体更新接口再次校验。
export function canEditSubject(
  subject: Record<string, unknown> | null,
  user: unknown,
  hasUpdatePermission: boolean,
): boolean {
  if (
    !subject ||
    !hasUpdatePermission ||
    !knownStatuses.has(String(subject.certificationStatus))
  )
    return false;
  if (subject.certificationStatus !== 'Certified') return true;
  if (
    isPlatformUser(user) &&
    (isSuperAdminUser(user) || isTopSuperAdminUser(user))
  )
    return true;
  if (!user || typeof user !== 'object' || !isTenantAdminUser(user))
    return false;
  const tenantId = (user as Record<string, unknown>).tenantId;
  return Boolean(tenantId && subject.tenantId && tenantId === subject.tenantId);
}
