import RbacPermissionMatchUtils from '../../rbac-permission-match';

export { RbacPermissionMatchUtils };
export default RbacPermissionMatchUtils;

export function simpleMatch(
  requirePermission: null | string | undefined,
  ownerPermission: null | string | undefined,
) {
  return RbacPermissionMatchUtils.simpleMatch(
    requirePermission,
    ownerPermission,
  );
}

export function simpleMatchList(
  requirePermission: null | string | undefined,
  ownerPermissions: null | string[] | undefined,
) {
  return RbacPermissionMatchUtils.simpleMatchList(
    requirePermission,
    ownerPermissions,
  );
}
