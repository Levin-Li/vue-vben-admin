import type { RouteRecordRaw } from 'vue-router';

export const DEFAULT_SYNC_MENU_MODULE_ID = 'com.levin.oak.base';

export interface SyncMenuItem {
  children?: SyncMenuItem[];
  icon?: string;
  label: string;
  moduleId?: string;
  params?: string;
  path: string;
  remark?: string;
}

export interface SyncMenuPayload {
  menuList: SyncMenuItem[];
}

function hasText(value: unknown) {
  return String(value ?? '').trim().length > 0;
}

function normalizePath(parentPath: string, path: string) {
  if (path.startsWith('/')) {
    return path;
  }

  return `${parentPath.replace(/\/$/, '')}/${path}`.replaceAll(/\/+/g, '/');
}

function getRouteTitle(route: RouteRecordRaw) {
  const title = route.meta?.title;
  return typeof title === 'string' ? title.trim() : '';
}

function getRouteIcon(route: RouteRecordRaw) {
  const icon = route.meta?.icon;
  return typeof icon === 'string' && icon.trim() ? icon.trim() : undefined;
}

function shouldSkipRoute(route: RouteRecordRaw) {
  return (
    route.meta?.hideInMenu === true ||
    Boolean(route.redirect) ||
    Boolean(route.meta?.link) ||
    !hasText(route.path)
  );
}

function toSyncMenuItems(
  routes: RouteRecordRaw[],
  moduleId: string,
  parentPath = '',
): SyncMenuItem[] {
  return routes.flatMap((route) => {
    const path = normalizePath(parentPath, route.path);
    const children = toSyncMenuItems(route.children || [], moduleId, path);

    if (shouldSkipRoute(route)) {
      return children;
    }

    const label = getRouteTitle(route);
    if (!label) {
      return children;
    }

    return [
      {
        children,
        icon: getRouteIcon(route),
        label,
        moduleId,
        path,
        remark: String(route.name || ''),
      },
    ];
  });
}

export function buildSyncMenuPayload(
  routes: RouteRecordRaw[],
  moduleId = DEFAULT_SYNC_MENU_MODULE_ID,
) {
  return {
    menuList: toSyncMenuItems(routes, moduleId),
  };
}
