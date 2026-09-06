import type {
  AdminBackendRouteMapping,
  AdminFrontendModule,
  AdminPageOperation,
  MenuFixedQuery,
} from '@levin/admin-framework';

import type { RouteRecordRaw } from 'vue-router';

import { toPathRouteName } from '../../page-registry';

export const DEFAULT_SYNC_MENU_MODULE_ID = 'com.levin.oak.base';
const MENU_REMARK_MAX_LENGTH = 512;

export interface SyncMenuItem {
  children?: SyncMenuItem[];
  enable?: boolean;
  icon?: string;
  label: string;
  moduleId?: string;
  name?: string;
  opButtonList?: SyncMenuOperation[];
  overrideExisting?: boolean;
  pageName?: string;
  params?: MenuFixedQuery | null;
  paramsEditor?: string;
  path: string;
  remark?: string;
  sourceFilePath?: string;
  viewPath?: string;
}

export interface SyncMenuOperation {
  label: string;
  opName: string;
  remark: string;
  requireAuthorizations: string[];
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

function createRouteMappingLookup(
  routeMappings: AdminBackendRouteMapping[] = [],
) {
  routeMappings.forEach((mapping) => {
    if (
      !hasText(mapping.description) ||
      !hasText(mapping.name) ||
      !hasText(mapping.sourceFilePath) ||
      !hasText(mapping.title) ||
      !hasText(mapping.viewPath)
    ) {
      throw new Error(
        `页面映射不完整：${mapping.path}。必须同时提供 name、title、description、viewPath 和 sourceFilePath。`,
      );
    }
  });

  return new Map(routeMappings.map((item) => [item.path, item]));
}

function normalizeSyncMenuModuleId(moduleId?: string) {
  return String(moduleId || DEFAULT_SYNC_MENU_MODULE_ID).trim();
}

function normalizeSyncMenuPath(path: string) {
  return String(path || '').trim();
}

function truncateMenuRemark(value: string) {
  return value.slice(0, MENU_REMARK_MAX_LENGTH);
}

function getSyncMenuKey(moduleId: string | undefined, path: string) {
  return `${normalizeSyncMenuModuleId(moduleId)}\n${normalizeSyncMenuPath(path)}`;
}

function applyRouteMapping(
  item: SyncMenuItem,
  mapping?: AdminBackendRouteMapping,
): SyncMenuItem {
  if (!mapping) {
    return item;
  }

  return {
    ...item,
    ...(mapping.operations
      ? { opButtonList: toSyncMenuOperations(mapping.operations) }
      : {}),
    name: mapping.name,
    remark: truncateMenuRemark(mapping.description),
    sourceFilePath: mapping.sourceFilePath,
    viewPath: mapping.viewPath,
  };
}

function toSyncMenuOperations(
  operations: AdminPageOperation[],
): SyncMenuOperation[] {
  return operations.map((operation) => ({
    label: operation.label,
    opName: operation.opName,
    remark: operation.description,
    requireAuthorizations: operation.requireAuthorizations,
  }));
}

function toSyncMenuItems(
  routes: RouteRecordRaw[],
  moduleId: string,
  routeMappingLookup = createRouteMappingLookup(),
  parentPath = '',
  requirePageMapping = false,
): SyncMenuItem[] {
  return routes.flatMap((route) => {
    const path = normalizePath(parentPath, route.path);
    const children = toSyncMenuItems(
      route.children || [],
      moduleId,
      routeMappingLookup,
      path,
      requirePageMapping,
    );

    if (shouldSkipRoute(route)) {
      return children;
    }

    const label = getRouteTitle(route);
    if (!label) {
      return children;
    }

    const mapping = routeMappingLookup.get(path);
    if (requirePageMapping && children.length === 0 && !mapping) {
      throw new Error(
        `页面路由缺少完整映射：${path}。请在 backendRouteMappings 中提供 name、title、description、viewPath 和 sourceFilePath。`,
      );
    }

    return [
      applyRouteMapping(
        {
          children,
          icon: getRouteIcon(route),
          label,
          moduleId,
          name: mapping?.name || label,
          path,
          remark: mapping?.description
            ? truncateMenuRemark(mapping.description)
            : toPathRouteName(path),
        },
        mapping,
      ),
    ];
  });
}

function collectSyncMenuKeys(items: SyncMenuItem[], keys = new Set<string>()) {
  items.forEach((item) => {
    keys.add(getSyncMenuKey(item.moduleId, item.path));
    collectSyncMenuKeys(item.children || [], keys);
  });
  return keys;
}

function dedupeSyncMenuItems(
  items: SyncMenuItem[],
  keys = new Set<string>(),
): SyncMenuItem[] {
  return items.flatMap((item) => {
    const key = getSyncMenuKey(item.moduleId, item.path);

    if (keys.has(key)) {
      return [];
    }

    keys.add(key);

    return [
      {
        ...item,
        children: dedupeSyncMenuItems(item.children || [], keys),
      },
    ];
  });
}

function toSyncMenuItemFromMapping(
  mapping: AdminBackendRouteMapping,
  moduleId: string,
): SyncMenuItem {
  return {
    children: [],
    icon: mapping.icon,
    label: mapping.title,
    moduleId,
    ...(mapping.operations
      ? { opButtonList: toSyncMenuOperations(mapping.operations) }
      : {}),
    path: mapping.path,
    name: mapping.name,
    remark: truncateMenuRemark(mapping.description),
    sourceFilePath: mapping.sourceFilePath,
    viewPath: mapping.viewPath,
  };
}

function buildModuleMenuItems(module: AdminFrontendModule): SyncMenuItem[] {
  const routeMappings = module.backendRouteMappings || [];
  const routeMappingLookup = createRouteMappingLookup(routeMappings);
  const menuItems = toSyncMenuItems(
    module.routes || [],
    module.name,
    routeMappingLookup,
    '',
    true,
  );
  const menuKeys = collectSyncMenuKeys(menuItems);

  routeMappings.forEach((mapping) => {
    const key = getSyncMenuKey(module.name, mapping.path);

    if (menuKeys.has(key)) {
      return;
    }

    menuItems.push(toSyncMenuItemFromMapping(mapping, module.name));
    menuKeys.add(key);
  });

  return dedupeSyncMenuItems(menuItems);
}

export function buildModuleSyncMenuPayload(modules: AdminFrontendModule[]) {
  return {
    menuList: dedupeSyncMenuItems(
      modules.flatMap((module) => buildModuleMenuItems(module)),
    ),
  };
}

export function buildSyncMenuPayload(
  routes: RouteRecordRaw[],
  moduleId = DEFAULT_SYNC_MENU_MODULE_ID,
  routeMappings: AdminBackendRouteMapping[] = [],
) {
  const routeMappingLookup = createRouteMappingLookup(routeMappings);
  const menuList = toSyncMenuItems(routes, moduleId, routeMappingLookup);
  const menuKeys = collectSyncMenuKeys(menuList);

  routeMappings.forEach((mapping) => {
    const key = getSyncMenuKey(moduleId, mapping.path);

    if (menuKeys.has(key)) {
      return;
    }

    menuList.push(toSyncMenuItemFromMapping(mapping, moduleId));
    menuKeys.add(key);
  });

  return {
    menuList: dedupeSyncMenuItems(menuList),
  };
}
