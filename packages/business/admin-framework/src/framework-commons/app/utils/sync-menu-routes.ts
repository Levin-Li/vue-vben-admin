import type {
  AdminBackendRouteMapping,
  AdminFrontendModule,
} from '@levin/admin-framework';
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
  sourceFile?: string;
  view?: string;
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
  return new Map(routeMappings.map((item) => [item.sourcePath, item]));
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
    sourceFile: mapping.sourceFile,
    view: mapping.view,
  };
}

function toSyncMenuItems(
  routes: RouteRecordRaw[],
  moduleId: string,
  routeMappingLookup = createRouteMappingLookup(),
  parentPath = '',
): SyncMenuItem[] {
  return routes.flatMap((route) => {
    const path = normalizePath(parentPath, route.path);
    const children = toSyncMenuItems(
      route.children || [],
      moduleId,
      routeMappingLookup,
      path,
    );

    if (shouldSkipRoute(route)) {
      return children;
    }

    const label = getRouteTitle(route);
    if (!label) {
      return children;
    }

    return [
      applyRouteMapping(
        {
          children,
          icon: getRouteIcon(route),
          label,
          moduleId,
          path,
          remark: String(route.name || ''),
        },
        routeMappingLookup.get(path),
      ),
    ];
  });
}

function collectSyncMenuPaths(items: SyncMenuItem[], paths = new Set<string>()) {
  items.forEach((item) => {
    paths.add(item.path);
    collectSyncMenuPaths(item.children || [], paths);
  });
  return paths;
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
    path: mapping.sourcePath,
    remark: mapping.name,
    sourceFile: mapping.sourceFile,
    view: mapping.view,
  };
}

function buildModuleMenuItems(module: AdminFrontendModule): SyncMenuItem[] {
  const routeMappings = module.backendRouteMappings || [];
  const routeMappingLookup = createRouteMappingLookup(routeMappings);
  const menuItems = toSyncMenuItems(
    module.routes || [],
    module.name,
    routeMappingLookup,
  );
  const menuPaths = collectSyncMenuPaths(menuItems);

  routeMappings.forEach((mapping) => {
    if (menuPaths.has(mapping.sourcePath)) {
      return;
    }

    menuItems.push(toSyncMenuItemFromMapping(mapping, module.name));
    menuPaths.add(mapping.sourcePath);
  });

  return menuItems;
}

export function buildModuleSyncMenuPayload(modules: AdminFrontendModule[]) {
  return {
    menuList: modules.flatMap((module) => buildModuleMenuItems(module)),
  };
}

export function buildSyncMenuPayload(
  routes: RouteRecordRaw[],
  moduleId = DEFAULT_SYNC_MENU_MODULE_ID,
  routeMappings: AdminBackendRouteMapping[] = [],
) {
  const routeMappingLookup = createRouteMappingLookup(routeMappings);
  const menuList = toSyncMenuItems(routes, moduleId, routeMappingLookup);
  const menuPaths = collectSyncMenuPaths(menuList);

  routeMappings.forEach((mapping) => {
    if (menuPaths.has(mapping.sourcePath)) {
      return;
    }

    menuList.push(toSyncMenuItemFromMapping(mapping, moduleId));
    menuPaths.add(mapping.sourcePath);
  });

  return {
    menuList,
  };
}
