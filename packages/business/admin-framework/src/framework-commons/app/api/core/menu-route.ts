import type { AdminBackendRouteMapping } from '@levin/admin-framework';
import type { RouteRecordStringComponent } from '@vben/types';

export interface BackendMenuInfo {
  actionType?: null | string;
  alwaysShow?: boolean;
  children?: BackendMenuInfo[] | null;
  icon?: null | string;
  id?: string;
  name?: string;
  opButtonList?: any[] | null;
  orderCode?: number;
  pageType?: null | string;
  path?: null | string;
  requireAuthorizations?: null | string[];
}

interface RouteMappingLookup {
  byPath: Map<string, AdminBackendRouteMapping>;
  byResource: Map<string, AdminBackendRouteMapping>;
}

function createRouteMappingLookup(
  routeMappings: AdminBackendRouteMapping[] = [],
): RouteMappingLookup {
  return {
    byPath: new Map(routeMappings.map((item) => [item.sourcePath, item])),
    byResource: new Map(
      routeMappings.map((item) => [item.resource.toLowerCase(), item]),
    ),
  };
}

function extractResourceFromMenuPath(path?: null | string) {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath.startsWith('/clob/V1/')) {
    return '';
  }

  return normalizedPath.replace('/clob/V1/', '').split('/')[0] || '';
}

function collectRoutePaths(
  routes: RouteRecordStringComponent[],
  paths = new Set<string>(),
) {
  routes.forEach((route) => {
    paths.add(route.path);
    if (route.children?.length) {
      collectRoutePaths(route.children as RouteRecordStringComponent[], paths);
    }
  });
  return paths;
}

function normalizeEnumValue(value?: null | string) {
  return String(value || '').split('-')[0] || '';
}

function normalizeActionType(value?: null | string) {
  const actionType = normalizeEnumValue(value) || 'Default';
  return actionType === 'TabPanelIFrame' ? 'TabPanel' : actionType;
}

function normalizePageType(value?: null | string) {
  return normalizeEnumValue(value) || 'LocalPage';
}

function normalizePath(path?: null | string) {
  if (!path) {
    return '';
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return path.startsWith('/') ? path : `/${path}`;
}

function toAuthority(item: BackendMenuInfo) {
  return item.requireAuthorizations?.filter(Boolean).length
    ? item.requireAuthorizations.filter(Boolean)
    : undefined;
}

function toRouteName(prefix: string, item: BackendMenuInfo) {
  const raw = item.path || item.name || item.id || prefix;
  const normalized =
    raw.replaceAll(/[^a-z0-9]+/gi, '_').replaceAll(/^_+|_+$/g, '') || prefix;

  return `${prefix}_${normalized}`;
}

function buildIframeSrc(path: string) {
  if (!path || path === '/') {
    return '/admin';
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `/admin/m${path}`;
}

function toMeta(
  item: BackendMenuInfo,
  normalizedPath: string,
  extra: Record<string, any> = {},
) {
  return {
    authority: toAuthority(item),
    backendIframeSrc: buildIframeSrc(normalizedPath),
    crudResource: extractResourceFromMenuPath(normalizedPath),
    icon: item.icon || 'lucide:panel-right-open',
    menuActionType: normalizeActionType(item.actionType),
    menuPageType: normalizePageType(item.pageType),
    order: item.orderCode,
    title: item.name || normalizedPath || '未命名页面',
    ...extra,
  };
}

function findRouteMapping(lookup: RouteMappingLookup, normalizedPath: string) {
  return (
    lookup.byPath.get(normalizedPath) ||
    lookup.byResource.get(
      extractResourceFromMenuPath(normalizedPath).toLowerCase(),
    )
  );
}

function convertLeafRoute(
  item: BackendMenuInfo,
  normalizedPath: string,
  lookup: RouteMappingLookup,
): RouteRecordStringComponent {
  const finalPath = normalizedPath === '/' ? '/backend/home' : normalizedPath;
  const actionType = normalizeActionType(item.actionType);
  const pageType = normalizePageType(item.pageType);
  const mapping = findRouteMapping(lookup, normalizedPath);

  if (actionType === 'NewWindow') {
    return {
      component: 'IFrameView',
      meta: toMeta(item, normalizedPath, {
        link: normalizedPath,
        openInNewWindow: true,
      }),
      name: toRouteName('NewWindow', item),
      path: finalPath,
    };
  }

  if (actionType === 'Redirect') {
    return {
      component: 'IFrameView',
      meta: toMeta(item, normalizedPath, {
        link: normalizedPath,
        redirectPath: normalizedPath,
      }),
      name: toRouteName('Redirect', item),
      path: finalPath,
    };
  }

  if (actionType === 'ModalWindow') {
    return {
      component: '/system/shared/menu-modal-page.vue',
      meta: toMeta(item, normalizedPath),
      name: toRouteName('Modal', item),
      path: finalPath,
    };
  }

  if (actionType === 'ServerSideAction') {
    return {
      component: '/system/shared/server-action-page.vue',
      meta: toMeta(item, normalizedPath),
      name: toRouteName('ServerAction', item),
      path: finalPath,
    };
  }

  if ((pageType === 'LocalPage' || pageType === 'AmisPage') && mapping) {
    return {
      component: mapping.view,
      meta: {
        authority: toAuthority(item),
        icon: item.icon || mapping.icon,
        menuActionType: actionType,
        menuPageType: pageType,
        order: item.orderCode,
        title: mapping.title || item.name || normalizedPath || '未命名页面',
      },
      name: mapping.name,
      path: finalPath,
    };
  }

  if (pageType === 'HtmlPage') {
    return {
      component: 'IFrameView',
      meta: toMeta(item, normalizedPath, {
        link: buildIframeSrc(normalizedPath),
      }),
      name: toRouteName('Html', item),
      path: finalPath,
    };
  }

  if (pageType === 'AmisPage') {
    return {
      component: '/system/shared/amis-page.vue',
      meta: toMeta(item, normalizedPath, {
        localFallbackView:
          mapping?.view || '/system/shared/controller-crud-page.vue',
      }),
      name: toRouteName('Amis', item),
      path: finalPath,
    };
  }

  return {
    component: mapping?.view || '/system/shared/controller-crud-page.vue',
    meta: toMeta(item, normalizedPath),
    name: toRouteName('Crud', item),
    path: finalPath || `/menu/${item.id || 'unknown'}`,
  };
}

export function convertMenuNode(
  item: BackendMenuInfo,
  lookup: RouteMappingLookup = createRouteMappingLookup(),
): null | RouteRecordStringComponent {
  const normalizedPath = normalizePath(item.path);
  const children = (item.children || [])
    .map((child) => convertMenuNode(child, lookup))
    .filter(Boolean) as RouteRecordStringComponent[];

  if (children.length > 0) {
    return {
      children,
      component: 'BasicLayout',
      meta: {
        authority: toAuthority(item),
        alwaysShow: item.alwaysShow,
        icon: item.icon || 'lucide:folder-tree',
        menuActionType: normalizeActionType(item.actionType),
        menuPageType: normalizePageType(item.pageType),
        order: item.orderCode,
        title: item.name || normalizedPath || '未命名分组',
      },
      name: toRouteName('Group', item),
      path:
        normalizedPath && normalizedPath !== '/'
          ? normalizedPath
          : `/menu/${item.id || 'root'}`,
      redirect: children[0]?.path,
    };
  }

  if (!normalizedPath) {
    return null;
  }

  return convertLeafRoute(item, normalizedPath, lookup);
}

export function buildMenuRoutes(
  backendMenus: BackendMenuInfo[],
  routeMappings: AdminBackendRouteMapping[] = [],
) {
  const lookup = createRouteMappingLookup(routeMappings);
  const routes = backendMenus
    .map((item) => convertMenuNode(item, lookup))
    .filter(Boolean) as RouteRecordStringComponent[];

  const existingPaths = collectRoutePaths(routes);

  routeMappings.forEach((mapping) => {
    if (existingPaths.has(mapping.sourcePath)) {
      return;
    }

    routes.push({
      component: mapping.view,
      meta: {
        crudResource: mapping.resource,
        hideInMenu: true,
        icon: mapping.icon,
        title: mapping.title,
      },
      name: mapping.name,
      path: mapping.sourcePath,
    });
    existingPaths.add(mapping.sourcePath);
  });

  return routes;
}

export function convertMenuNodeForTest(
  item: BackendMenuInfo,
  routeMappings: AdminBackendRouteMapping[] = [],
) {
  return convertMenuNode(item, createRouteMappingLookup(routeMappings));
}
