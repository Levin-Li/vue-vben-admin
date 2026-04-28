import type { App, Directive, DirectiveBinding } from 'vue';

import { useRbacAccess } from '#/utils/rbac-access';

type PermissionBindingValue =
  | null
  | string
  | string[]
  | { all?: string | string[]; any?: string | string[] }
  | undefined;

function isPermissionObject(
  value: PermissionBindingValue,
): value is { all?: string | string[]; any?: string | string[] } {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function canAccess(value: PermissionBindingValue) {
  const { hasAllPermissions, hasPermission } = useRbacAccess();

  if (!value) {
    return true;
  }

  if (isPermissionObject(value)) {
    if (value.all) {
      return hasAllPermissions(value.all);
    }

    if (value.any) {
      return hasPermission(value.any);
    }

    return true;
  }

  return hasPermission(value);
}

function applyPermission(
  el: HTMLElement,
  binding: DirectiveBinding<PermissionBindingValue>,
) {
  if (!canAccess(binding.value)) {
    el.remove();
  }
}

const rbacPermissionDirective: Directive = {
  mounted: applyPermission,
  updated: applyPermission,
};

export function registerRbacPermissionDirective(app: App) {
  app.directive('rbac-permission', rbacPermissionDirective);
}
