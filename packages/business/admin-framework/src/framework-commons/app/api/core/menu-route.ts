import type { AdminBackendRouteMapping } from '@levin/admin-framework';
import type { RouteRecordStringComponent } from '@vben/types';

export interface BackendMenuInfo {
  actionType?: null | string;
  alwaysShow?: boolean;
  children?: BackendMenuInfo[] | null;
  enable?: boolean;
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

const DEFAULT_LEAF_MENU_ICON = 'lucide:panel-right-open';
const DEFAULT_GROUP_MENU_ICON = 'lucide:folder-tree';
const DEFAULT_BACKEND_MENU_ICONS = new Set([
  DEFAULT_GROUP_MENU_ICON,
  DEFAULT_LEAF_MENU_ICON,
]);

const INFERRED_MENU_ICONS: Array<[RegExp, string]> = [
  [/合同模板|template/i, 'lucide:layout-template'],
  [/合同签署|签署|sign/i, 'lucide:pen-line'],
  [/合同文件|文件|file/i, 'lucide:folder-open'],
  [/合同|contract/i, 'lucide:scroll-text'],
  [/工作流|workflow/i, 'lucide:workflow'],
  [/审计|日志|log/i, 'lucide:history'],
  [/全域资金|资金账户|账户资产|资金|fund|asset|wallet/i, 'lucide:wallet'],
  [/动账|流水|明细|账单|receipt|bill/i, 'lucide:receipt-text'],
  [/订单|order/i, 'lucide:shopping-cart'],
  [/商品|product|goods/i, 'lucide:package'],
  [/商户信息|组织|org|organization/i, 'lucide:building-2'],
  [/商户|店铺|门店|merchant|shop|store/i, 'lucide:store'],
  [/合作商|partner/i, 'lucide:handshake'],
  [/项目管理|项目|project/i, 'lucide:folder-kanban'],
  [/开票|invoice/i, 'lucide:receipt'],
  [/结算|settlement/i, 'lucide:banknote'],
  [/终端|terminal/i, 'lucide:monitor'],
  [/交易|trade|transaction/i, 'lucide:chart-column'],
  [/扩展信息|扩展|extension/i, 'lucide:list-tree'],
  [/代码生成|code/i, 'lucide:code-xml'],
];

function createRouteMappingLookup(
  routeMappings: AdminBackendRouteMapping[] = [],
): RouteMappingLookup {
  const byPath = new Map<string, AdminBackendRouteMapping>();

  routeMappings.forEach((item) => {
    byPath.set(item.path, item);
    item.deprecatedPaths?.forEach((path) => {
      byPath.set(path, item);
    });
  });

  return {
    byPath,
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

function inferMenuIcon(item: BackendMenuInfo, normalizedPath: string) {
  const haystack = [
    item.name,
    item.path,
    normalizedPath,
    extractResourceFromMenuPath(normalizedPath),
  ]
    .filter(Boolean)
    .join(' ');

  return INFERRED_MENU_ICONS.find(([pattern]) => pattern.test(haystack))?.[1];
}

function resolveBackendMenuIcon(
  item: BackendMenuInfo,
  normalizedPath: string,
  fallbackIcon: string,
) {
  if (item.icon && !DEFAULT_BACKEND_MENU_ICONS.has(item.icon)) {
    return item.icon;
  }

  return inferMenuIcon(item, normalizedPath) || fallbackIcon;
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
        title: item.name || '首页',
      }),
      name: 'Index',
      path: '/index',
    };
  }

  const finalPath = normalizedPath;
  const actionType = normalizeActionType(item.actionType);
  const pageType = normalizePageType(item.pageType);
  const mapping = findRouteMapping(lookup, normalizedPath);
  const routePath = mapping?.path || finalPath;

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

  if (pageType === 'LocalPage' && mapping) {
    return {
      component: mapping.viewPath,
      meta: {
        authority: toAuthority(item),
        disabled: item.enable === false,
        icon: resolveLocalPageIcon(item.icon, mapping.icon),
        menuActionType: actionType,
        menuPageType: pageType,
        order: item.orderCode,
        title: mapping.title || item.name || normalizedPath || '未命名页面',
      },
      name: mapping.name,
      path: routePath,
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

  return {
    component: mapping?.viewPath || '/system/shared/controller-crud-page.vue',
    meta: toMeta(item, normalizedPath),
    name: toRouteName('Crud', item),
    path: routePath || `/menu/${item.id || 'unknown'}`,
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

  if (children.length > 0) {
    return {
      children,
      component: depth === 0 ? 'BasicLayout' : 'RouteView',
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
    if (existingPaths.has(mapping.path)) {
      return;
    }

    routes.push({
      component: mapping.viewPath,
      meta: {
        crudResource: mapping.resource,
        hideInMenu: true,
        icon: mapping.icon,
        title: mapping.title,
      },
      name: mapping.name,
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
