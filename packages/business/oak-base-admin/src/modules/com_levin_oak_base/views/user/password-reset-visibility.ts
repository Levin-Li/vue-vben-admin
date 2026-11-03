import {
  isSuperAdminUser,
  isTenantAdminUser,
} from '@levin/admin-framework/framework-commons/shared/user-identity';

/** 仅改善按钮展示；后端仍独立核验管理员身份、动作权限和目标范围。 */
export function canShowPasswordResetAction(
  userInfo: unknown,
  targetId: unknown,
) {
  if (!userInfo || typeof userInfo !== 'object' || !targetId) return false;
  const user = userInfo as Record<string, unknown>;
  if (!user.id || String(user.id) === String(targetId)) return false;

  const administrator =
    user.admin === true ||
    user.isAdmin === true ||
    user.platformAdmin === true ||
    user.isPlatformAdmin === true ||
    isSuperAdminUser(userInfo) ||
    isTenantAdminUser(userInfo);
  return administrator;
}
