import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';
import { extractResourceFromMenuPath } from '#/api/openapi-crud';

interface BackendMenuInfo {
  alwaysShow?: boolean;
  children?: BackendMenuInfo[] | null;
  icon?: null | string;
  id?: string;
  name?: string;
  orderCode?: number;
  pageType?: null | string;
  path?: null | string;
  requireAuthorizations?: null | string[];
}

interface LocalRouteMapping {
  icon: string;
  name: string;
  sourcePath: string;
  title: string;
  view: string;
}

const LOCAL_ROUTE_MAPPINGS: LocalRouteMapping[] = [
  {
    icon: 'lucide:badge-check',
    name: 'RoleCrudPage',
    sourcePath: '/clob/V1/Role',
    title: '角色管理',
    view: '/system/role/index.vue',
  },
  {
    icon: 'lucide:menu-square',
    name: 'MenuCrudPage',
    sourcePath: '/clob/V1/Menu',
    title: '菜单管理',
    view: '/system/menu/index.vue',
  },
  {
    icon: 'lucide:building-2',
    name: 'OrgCrudPage',
    sourcePath: '/clob/V1/Org',
    title: '组织管理',
    view: '/system/org/index.vue',
  },
  {
    icon: 'lucide:users',
    name: 'UserCrudPage',
    sourcePath: '/clob/V1/User',
    title: '用户管理',
    view: '/system/user/index.vue',
  },
  {
    icon: 'lucide:book-copy',
    name: 'DictCrudPage',
    sourcePath: '/clob/V1/Dict',
    title: '数据字典管理',
    view: '/system/dict/index.vue',
  },
  {
    icon: 'lucide:landmark',
    name: 'TenantCrudPage',
    sourcePath: '/clob/V1/Tenant',
    title: '租户管理',
    view: '/system/tenant/index.vue',
  },
  {
    icon: 'lucide:globe',
    name: 'TenantSiteCrudPage',
    sourcePath: '/clob/V1/TenantSite',
    title: '租户站点管理',
    view: '/system/tenant-site/index.vue',
  },
];

const LOCAL_ROUTE_MAPPING_MAP = new Map(
  LOCAL_ROUTE_MAPPINGS.map((item) => [item.sourcePath, item]),
);

function normalizePath(path?: null | string) {
  if (!path) {
    return '';
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
    raw.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || prefix;

  return `${prefix}_${normalized}`;
}

function buildIframeSrc(path: string) {
  if (!path || path === '/') {
    return '/admin';
  }

  return `/admin/m${path}`;
}

function convertLeafRoute(
  item: BackendMenuInfo,
  normalizedPath: string,
): RouteRecordStringComponent {
  const finalPath = normalizedPath === '/' ? '/backend/home' : normalizedPath;
  const mapping = LOCAL_ROUTE_MAPPING_MAP.get(normalizedPath);

  if (mapping) {
    return {
      component: mapping.view,
      meta: {
        authority: toAuthority(item),
        icon: item.icon || mapping.icon,
        order: item.orderCode,
        title: item.name || mapping.title,
      },
      name: mapping.name,
      path: finalPath,
    };
  }

  return {
    component: '/system/shared/openapi-crud-page.vue',
    meta: {
      authority: toAuthority(item),
      backendIframeSrc: buildIframeSrc(normalizedPath),
      crudResource: extractResourceFromMenuPath(normalizedPath),
      icon: item.icon || 'lucide:panel-right-open',
      order: item.orderCode,
      title: item.name || normalizedPath || '未命名页面',
    },
    name: toRouteName('Crud', item),
    path: finalPath || `/menu/${item.id || 'unknown'}`,
  };
}

function convertMenuNode(item: BackendMenuInfo): null | RouteRecordStringComponent {
  const normalizedPath = normalizePath(item.path);
  const children = (item.children || [])
    .map((child) => convertMenuNode(child))
    .filter(Boolean) as RouteRecordStringComponent[];

  if (children.length > 0) {
    return {
      children,
      component: 'BasicLayout',
      meta: {
        authority: toAuthority(item),
        alwaysShow: item.alwaysShow,
        icon: item.icon || 'lucide:folder-tree',
        order: item.orderCode,
        title: item.name || normalizedPath || '未命名分组',
      },
      name: toRouteName('Group', item),
      path: normalizedPath && normalizedPath !== '/' ? normalizedPath : `/menu/${item.id || 'root'}`,
      redirect: children[0]?.path,
    };
  }

  if (!normalizedPath) {
    return null;
  }

  return convertLeafRoute(item, normalizedPath);
}

function buildMenuRoutes(backendMenus: BackendMenuInfo[]) {
  return backendMenus
    .map((item) => convertMenuNode(item))
    .filter(Boolean) as RouteRecordStringComponent[];
}

export async function getAllMenusApi() {
  const backendMenus = await requestClient.get<BackendMenuInfo[]>(
    '/rbac/authorizedMenuList',
  );

  return buildMenuRoutes(backendMenus);
}
