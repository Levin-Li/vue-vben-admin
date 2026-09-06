import type { AdminBackendRouteMapping } from '@levin/admin-framework';

import type { RouteRecordStringComponent } from '@vben/types';

import type { MenuFixedQuery } from '../../../menu-fixed-query';

import { parseMenuFixedQuery } from '../../../menu-fixed-query';
import { toPathRouteName } from '../../../page-registry';

export interface BackendMenuInfo {
  actionType?: null | string;
  alwaysShow?: boolean;
  children?: BackendMenuInfo[] | null;
  enable?: boolean;
  icon?: null | string;
  id?: string;
  label?: null | string;
  name?: string;
  opButtonList?: any[] | null;
  orderCode?: number;
  pageType?: null | string;
  params?: MenuFixedQuery | null;
  path?: null | string;
  remark?: null | string;
  requireAuthorizations?: null | string[];
  viewPath?: null | string;
}

interface RouteMappingLookup {
  byPath: Map<string, AdminBackendRouteMapping>;
  byResource: Map<string, AdminBackendRouteMapping>;
  byViewPath: Map<string, AdminBackendRouteMapping>;
}

const DEFAULT_LEAF_MENU_ICON = 'lucide:panel-right-open';
const DEFAULT_GROUP_MENU_ICON = 'lucide:folder-tree';
const FORBIDDEN_PAGE_COMPONENT = '/_core/fallback/forbidden.vue';
const NOT_FOUND_PAGE_COMPONENT = '/_core/fallback/not-found.vue';
const DEFAULT_BACKEND_MENU_ICONS = new Set([
  DEFAULT_GROUP_MENU_ICON,
  DEFAULT_LEAF_MENU_ICON,
]);

function createRouteMappingLookup(
  routeMappings: AdminBackendRouteMapping[] = [],
): RouteMappingLookup {
  const byPath = new Map<string, AdminBackendRouteMapping>();

  routeMappings.forEach((item) => {
    byPath.set(item.path, item);
  });

  return {
    byPath,
    byViewPath: new Map(routeMappings.map((item) => [item.viewPath, item])),
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

function toRouteName(path: string) {
  return toPathRouteName(path);
}

function toDefaultChildRouteName(routeName: string) {
  return `${routeName}__default`;
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

function resolveBackendMenuIcon(
  item: BackendMenuInfo,
  _normalizedPath: string,
  fallbackIcon: string,
) {
  if (item.icon && !DEFAULT_BACKEND_MENU_ICONS.has(item.icon)) {
    return item.icon;
  }

  return fallbackIcon;
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
    disabled: item.enable === false,
    icon: resolveBackendMenuIcon(item, normalizedPath, DEFAULT_LEAF_MENU_ICON),
    menuActionType: normalizeActionType(item.actionType),
    pageDescription: item.remark || '',
    pageName: item.name || '',
    pageOperations: item.opButtonList || [],
    menuPageType: normalizePageType(item.pageType),
    order: item.orderCode,
    title: item.label || item.name || normalizedPath || '未命名页面',
    ...extra,
  };
}

function toMissingRouteMeta(item: BackendMenuInfo, normalizedPath: string) {
  const { backendIframeSrc: _backendIframeSrc, ...meta } = toMeta(
    item,
    normalizedPath,
    {
      hideInTab: true,
      menuRouteMissingPage: true,
      title: item.name || '404',
    },
  );

  return meta;
}

function findRouteMapping(lookup: RouteMappingLookup, normalizedPath: string) {
  return (
    lookup.byPath.get(normalizedPath) ||
    lookup.byResource.get(
      extractResourceFromMenuPath(normalizedPath).toLowerCase(),
    )
  );
}

function resolveLocalPageIcon(
  backendIcon: null | string | undefined,
  mappingIcon: string,
) {
  return backendIcon && backendIcon !== DEFAULT_LEAF_MENU_ICON
    ? backendIcon
    : mappingIcon;
}

function convertLeafRoute(
  item: BackendMenuInfo,
  normalizedPath: string,
  lookup: RouteMappingLookup,
): RouteRecordStringComponent {
  if (normalizedPath === '/') {
    return {
      component: '/_core/home/index.vue',
      meta: toMeta(item, '/index', {
        title: item.label || item.name || '首页',
      }),
      name: toRouteName('/index'),
      path: '/index',
    };
  }

  const finalPath = normalizedPath;
  const actionType = normalizeActionType(item.actionType);
  const pageType = normalizePageType(item.pageType);
  const mapping = item.viewPath
    ? lookup.byViewPath.get(item.viewPath)
    : findRouteMapping(lookup, normalizedPath);
  const isSeparatePageEntry = Boolean(
    item.viewPath && mapping && normalizedPath !== mapping.path,
  );
  let fixedQuery;
  let fixedQueryError = '';
  try {
    fixedQuery = parseMenuFixedQuery(item.params);
    if (
      (Object.keys(fixedQuery).length > 0 || isSeparatePageEntry) &&
      !item.id
    ) {
      throw new Error('独立页面菜单缺少菜单标识');
    }
    if (
      Object.keys(fixedQuery).length > 0 &&
      (pageType !== 'LocalPage' ||
        !['Default', 'TabPanel'].includes(actionType))
    ) {
      throw new Error('固定查询条件仅支持本地页面菜单');
    }
    if (pageType === 'LocalPage' && /[?#]/.test(normalizedPath)) {
      throw new Error('页面路径不能包含查询参数，请通过固定查询条件配置');
    }
  } catch (error) {
    fixedQueryError = (error as Error).message;
  }
  const hasFixedQuery = Boolean(
    fixedQuery && Object.keys(fixedQuery).length > 0,
  );
  const independentEntry = hasFixedQuery || isSeparatePageEntry;
  const routePath =
    independentEntry || fixedQueryError
      ? `/menu/${encodeURIComponent(item.id || normalizedPath)}`
      : mapping?.path || finalPath;
  if (fixedQueryError) {
    return {
      component: NOT_FOUND_PAGE_COMPONENT,
      meta: { ...toMissingRouteMeta(item, normalizedPath), fixedQueryError },
      name: toRouteName(routePath),
      path: routePath,
    };
  }

  if (actionType === 'NewWindow') {
    return {
      component: 'IFrameView',
      meta: toMeta(item, normalizedPath, {
        link: normalizedPath,
        openInNewWindow: true,
      }),
      name: toRouteName(finalPath),
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
      name: toRouteName(finalPath),
      path: finalPath,
    };
  }

  if (actionType === 'ModalWindow') {
    return {
      component: '/system/shared/menu-modal-page.vue',
      meta: toMeta(item, normalizedPath),
      name: toRouteName(finalPath),
      path: finalPath,
    };
  }

  if (actionType === 'ServerSideAction') {
    return {
      component: '/system/shared/server-action-page.vue',
      meta: toMeta(item, normalizedPath),
      name: toRouteName(finalPath),
      path: finalPath,
    };
  }

  if (pageType === 'LocalPage' && mapping) {
    return {
      component: mapping.viewPath,
      meta: {
        ...(independentEntry
          ? { fixedQuery, sourcePagePath: mapping.path }
          : {}),
        crudResource: mapping.resource,
        authority: toAuthority(item),
        disabled: item.enable === false,
        icon: resolveLocalPageIcon(item.icon, mapping.icon),
        menuActionType: actionType,
        menuPageType: pageType,
        order: item.orderCode,
        pageDescription: item.remark || mapping.description,
        pageName: item.name || mapping.name,
        pageOperations: item.opButtonList || mapping.operations || [],
        title:
          item.label ||
          item.name ||
          mapping.title ||
          normalizedPath ||
          '未命名页面',
      },
      name: toRouteName(routePath),
      path: routePath,
    };
  }

  if (pageType === 'LocalPage') {
    return {
      component: NOT_FOUND_PAGE_COMPONENT,
      meta: toMissingRouteMeta(item, normalizedPath),
      name: toRouteName(routePath),
      path: routePath,
    };
  }

  if (pageType === 'HtmlPage') {
    return {
      component: 'IFrameView',
      meta: toMeta(item, normalizedPath, {
        link: buildIframeSrc(normalizedPath),
      }),
      name: toRouteName(finalPath),
      path: finalPath,
    };
  }

  return {
    component: mapping?.viewPath || NOT_FOUND_PAGE_COMPONENT,
    meta: mapping
      ? toMeta(item, normalizedPath)
      : toMissingRouteMeta(item, normalizedPath),
    name: toRouteName(routePath),
    path: routePath,
  };
}

export function convertMenuNode(
  item: BackendMenuInfo,
  lookup: RouteMappingLookup = createRouteMappingLookup(),
  depth = 0,
): null | RouteRecordStringComponent {
  const normalizedPath = normalizePath(item.path);
  const children = (item.children || [])
    .map((child) => convertMenuNode(child, lookup, depth + 1))
    .filter(Boolean) as RouteRecordStringComponent[];

  const groupPageCandidate =
    children.length > 0 && Boolean(normalizedPath) && normalizedPath !== '/'
      ? convertLeafRoute(item, normalizedPath, lookup)
      : undefined;
  const groupPageRoute = groupPageCandidate?.meta?.menuRouteMissingPage
    ? undefined
    : groupPageCandidate;
  const groupChildren = groupPageRoute
    ? [
        {
          ...groupPageRoute,
          meta: { ...groupPageRoute.meta, hideInMenu: true },
          name: toDefaultChildRouteName(groupPageRoute.name),
          path: '',
        },
        ...children,
      ]
    : children;

  if (groupChildren.length > 0) {
    const groupPath =
      normalizedPath && normalizedPath !== '/'
        ? normalizedPath
        : `/menu/${item.id || 'root'}`;
    const routePath = groupPageRoute?.meta?.fixedQuery
      ? groupPageRoute.path
      : groupPath;

    return {
      children: groupChildren,
      component: groupPageRoute || depth > 0 ? 'RouteView' : 'BasicLayout',
      meta: {
        authority: toAuthority(item),
        alwaysShow: item.alwaysShow,
        disabled: item.enable === false,
        icon: resolveBackendMenuIcon(
          item,
          normalizedPath,
          DEFAULT_GROUP_MENU_ICON,
        ),
        menuActionType: normalizeActionType(item.actionType),
        menuPageType: normalizePageType(item.pageType),
        navigateOnClick: Boolean(groupPageRoute),
        order: item.orderCode,
        preserveComponentWhenChildren: Boolean(groupPageRoute),
        title: item.label || item.name || normalizedPath || '未命名分组',
      },
      name: toRouteName(routePath),
      path: routePath,
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
    if (existingPaths.has(mapping.path)) {
      return;
    }

    routes.push({
      component: FORBIDDEN_PAGE_COMPONENT,
      meta: {
        crudResource: mapping.resource,
        hideInMenu: true,
        icon: mapping.icon,
        menuRouteForbidden: true,
        title: mapping.title,
      },
      name: toRouteName(mapping.path),
      path: mapping.path,
    });
    existingPaths.add(mapping.path);
  });

  return routes;
}

export function convertMenuNodeForTest(
  item: BackendMenuInfo,
  routeMappings: AdminBackendRouteMapping[] = [],
) {
  return convertMenuNode(item, createRouteMappingLookup(routeMappings));
}
