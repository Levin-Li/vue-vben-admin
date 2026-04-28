import { useAccessStore } from '@vben/stores';

import RbacPermissionMatchUtils from './RbacPermissionMatchUtils';

type PermissionValue = null | string | string[] | undefined;

function normalizePermissionValue(permission: PermissionValue): string[] {
  if (!permission) {
    return [];
  }

  return (Array.isArray(permission) ? permission : [permission])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function deduplicate(list: string[]) {
  return [...new Set(list.filter(Boolean))];
}

export function matchRbacPermissionList(
  requirePermission: string,
  ownerPermissions: string[],
) {
  if (!String(requirePermission || '').trim()) {
    return true;
  }

  return RbacPermissionMatchUtils.simpleMatchList(
    requirePermission,
    ownerPermissions,
  );
}

export function isPageReloadNavigation() {
  if (typeof window === 'undefined' || !window.performance) {
    return false;
  }

  const [navigationEntry] = performance.getEntriesByType(
    'navigation',
  ) as PerformanceNavigationTiming[];

  return navigationEntry?.type === 'reload';
}

export function shouldRefreshAuthorizedPermissions(accessCodes: string[]) {
  return accessCodes.length === 0 || isPageReloadNavigation();
}

export function useRbacAccess() {
  const accessStore = useAccessStore();

  function hasPermission(permission: PermissionValue) {
    const permissions = deduplicate(normalizePermissionValue(permission));

    if (permissions.length === 0) {
      return true;
    }

    const ownerPermissions = deduplicate(accessStore.accessCodes || []);

    return permissions.some((item) => {
      return matchRbacPermissionList(item, ownerPermissions);
    });
  }

  function hasAllPermissions(permission: PermissionValue) {
    const permissions = deduplicate(normalizePermissionValue(permission));

    if (permissions.length === 0) {
      return true;
    }

    return permissions.every((item) => hasPermission(item));
  }

  return {
    hasAllPermissions,
    hasPermission,
  };
}
