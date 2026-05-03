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

interface LocalRouteMapping {
  icon: string;
  name: string;
  resource: string;
  sourcePath: string;
  title: string;
  view: string;
}

function extractResourceFromMenuPath(path?: null | string) {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath.startsWith('/clob/V1/')) {
    return '';
  }

  return normalizedPath.replace('/clob/V1/', '').split('/')[0] || '';
}

const LOCAL_ROUTE_MAPPINGS: LocalRouteMapping[] = [
  {
    resource: 'Role',
    icon: 'lucide:badge-check',
    name: 'RoleCrudPage',
    sourcePath: '/clob/V1/Role',
    title: '角色管理',
    view: '/system/com_levin_oak_base/role/index.vue',
  },
  {
    resource: 'Menu',
    icon: 'lucide:menu-square',
    name: 'MenuCrudPage',
    sourcePath: '/clob/V1/Menu',
    title: '菜单管理',
    view: '/system/com_levin_oak_base/menu/index.vue',
  },
  {
    resource: 'Org',
    icon: 'lucide:building-2',
    name: 'OrgCrudPage',
    sourcePath: '/clob/V1/Org',
    title: '组织管理',
    view: '/system/com_levin_oak_base/org/index.vue',
  },
  {
    resource: 'User',
    icon: 'lucide:users',
    name: 'UserCrudPage',
    sourcePath: '/clob/V1/User',
    title: '用户管理',
    view: '/system/com_levin_oak_base/user/index.vue',
  },
  {
    resource: 'Dict',
    icon: 'lucide:book-copy',
    name: 'DictCrudPage',
    sourcePath: '/clob/V1/Dict',
    title: '数据字典管理',
    view: '/system/com_levin_oak_base/dict/index.vue',
  },
  {
    resource: 'Tenant',
    icon: 'lucide:landmark',
    name: 'TenantCrudPage',
    sourcePath: '/clob/V1/Tenant',
    title: '租户管理',
    view: '/system/com_levin_oak_base/tenant/index.vue',
  },
  {
    resource: 'TenantSite',
    icon: 'lucide:globe',
    name: 'TenantSiteCrudPage',
    sourcePath: '/clob/V1/TenantSite',
    title: '租户站点管理',
    view: '/system/com_levin_oak_base/tenant-site/index.vue',
  },
  {
    resource: 'Domain',
    icon: 'lucide:globe-2',
    name: 'DomainCrudPage',
    sourcePath: '/clob/V1/Domain',
    title: '根域名管理',
    view: '/system/com_levin_oak_base/domain/index.vue',
  },
  {
    resource: 'DomainSslCert',
    icon: 'lucide:shield-check',
    name: 'DomainSslCertCrudPage',
    sourcePath: '/clob/V1/DomainSslCert',
    title: 'SSL证书管理',
    view: '/system/com_levin_oak_base/domain-ssl-cert/index.vue',
  },
  {
    resource: 'AccessLog',
    icon: 'lucide:history',
    name: 'AccessLogCrudPage',
    sourcePath: '/clob/V1/AccessLog',
    title: '访问日志',
    view: '/system/com_levin_oak_base/access-log/index.vue',
  },
  {
    resource: 'Address',
    icon: 'lucide:map-pinned',
    name: 'AddressCrudPage',
    sourcePath: '/clob/V1/Address',
    title: '地址管理',
    view: '/system/com_levin_oak_base/address/index.vue',
  },
  {
    resource: 'AppClient',
    icon: 'lucide:app-window',
    name: 'AppClientCrudPage',
    sourcePath: '/clob/V1/AppClient',
    title: '应用客户端',
    view: '/system/com_levin_oak_base/app-client/index.vue',
  },
  {
    resource: 'Area',
    icon: 'lucide:map',
    name: 'AreaCrudPage',
    sourcePath: '/clob/V1/Area',
    title: '区域管理',
    view: '/system/com_levin_oak_base/area/index.vue',
  },
  {
    resource: 'Article',
    icon: 'lucide:newspaper',
    name: 'ArticleCrudPage',
    sourcePath: '/clob/V1/Article',
    title: '文章管理',
    view: '/system/com_levin_oak_base/article/index.vue',
  },
  {
    resource: 'ArticleChannel',
    icon: 'lucide:layout-list',
    name: 'ArticleChannelCrudPage',
    sourcePath: '/clob/V1/ArticleChannel',
    title: '文章栏目',
    view: '/system/com_levin_oak_base/article-channel/index.vue',
  },
  {
    resource: 'BankBranch',
    icon: 'lucide:building',
    name: 'BankBranchCrudPage',
    sourcePath: '/clob/V1/BankBranch',
    title: '银行网点',
    view: '/system/com_levin_oak_base/bank-branch/index.vue',
  },
  {
    resource: 'Brand',
    icon: 'lucide:badge-cent',
    name: 'BrandCrudPage',
    sourcePath: '/clob/V1/Brand',
    title: '品牌管理',
    view: '/system/com_levin_oak_base/brand/index.vue',
  },
  {
    resource: 'Customer',
    icon: 'lucide:contact-round',
    name: 'CustomerCrudPage',
    sourcePath: '/clob/V1/Customer',
    title: '客户管理',
    view: '/system/com_levin_oak_base/customer/index.vue',
  },
  {
    resource: 'Demo',
    icon: 'lucide:flask-conical',
    name: 'DemoCrudPage',
    sourcePath: '/clob/V1/Demo',
    title: '示例管理',
    view: '/system/com_levin_oak_base/demo/index.vue',
  },
  {
    resource: 'FileRes',
    icon: 'lucide:file-stack',
    name: 'FileResCrudPage',
    sourcePath: '/clob/V1/FileRes',
    title: '文件资源',
    view: '/system/com_levin_oak_base/file-res/index.vue',
  },
  {
    resource: 'FundAccount',
    icon: 'lucide:wallet',
    name: 'FundAccountCrudPage',
    sourcePath: '/clob/V1/FundAccount',
    title: '资金账户',
    view: '/system/com_levin_oak_base/fund-account/index.vue',
  },
  {
    resource: 'FundAccountLog',
    icon: 'lucide:receipt-text',
    name: 'FundAccountLogCrudPage',
    sourcePath: '/clob/V1/FundAccountLog',
    title: '资金账户日志',
    view: '/system/com_levin_oak_base/fund-account-log/index.vue',
  },
  {
    resource: 'FundExchangeRule',
    icon: 'lucide:coins',
    name: 'FundExchangeRuleCrudPage',
    sourcePath: '/clob/V1/FundExchangeRule',
    title: '资金兑换规则',
    view: '/system/com_levin_oak_base/fund-exchange-rule/index.vue',
  },
  {
    resource: 'I18nRes',
    icon: 'lucide:languages',
    name: 'I18nResCrudPage',
    sourcePath: '/clob/V1/I18nRes',
    title: '国际化资源',
    view: '/system/com_levin_oak_base/i18n-res/index.vue',
  },
  {
    resource: 'JobPost',
    icon: 'lucide:briefcase-business',
    name: 'JobPostCrudPage',
    sourcePath: '/clob/V1/JobPost',
    title: '岗位管理',
    view: '/system/com_levin_oak_base/job-post/index.vue',
  },
  {
    resource: 'Nation',
    icon: 'lucide:earth',
    name: 'NationCrudPage',
    sourcePath: '/clob/V1/Nation',
    title: '国家地区',
    view: '/system/com_levin_oak_base/nation/index.vue',
  },
  {
    resource: 'Notice',
    icon: 'lucide:bell-ring',
    name: 'NoticeCrudPage',
    sourcePath: '/clob/V1/Notice',
    title: '通知公告',
    view: '/system/com_levin_oak_base/notice/index.vue',
  },
  {
    resource: 'NoticeProcessLog',
    icon: 'lucide:logs',
    name: 'NoticeProcessLogCrudPage',
    sourcePath: '/clob/V1/NoticeProcessLog',
    title: '通知处理日志',
    view: '/system/com_levin_oak_base/notice-process-log/index.vue',
  },
  {
    resource: 'MyMessages',
    icon: 'lucide:bell',
    name: 'MyMessagesPage',
    sourcePath: '/clob/V1/MyMessages',
    title: '我的消息',
    view: '/system/com_levin_oak_base/my-messages/index.vue',
  },
  {
    resource: 'PayChannel',
    icon: 'lucide:credit-card',
    name: 'PayChannelCrudPage',
    sourcePath: '/clob/V1/PayChannel',
    title: '支付渠道',
    view: '/system/com_levin_oak_base/pay-channel/index.vue',
  },
  {
    resource: 'PayOrder',
    icon: 'lucide:circle-dollar-sign',
    name: 'PayOrderCrudPage',
    sourcePath: '/clob/V1/PayOrder',
    title: '支付订单',
    view: '/system/com_levin_oak_base/pay-order/index.vue',
  },
  {
    resource: 'Permission',
    icon: 'lucide:key-round',
    name: 'PermissionCrudPage',
    sourcePath: '/clob/V1/Permission',
    title: '权限管理',
    view: '/system/com_levin_oak_base/permission/index.vue',
  },
  {
    resource: 'ScheduledLog',
    icon: 'lucide:clipboard-list',
    name: 'ScheduledLogCrudPage',
    sourcePath: '/clob/V1/ScheduledLog',
    title: '定时任务日志',
    view: '/system/com_levin_oak_base/scheduled-log/index.vue',
  },
  {
    resource: 'ScheduledTask',
    icon: 'lucide:clock-3',
    name: 'ScheduledTaskCrudPage',
    sourcePath: '/clob/V1/ScheduledTask',
    title: '定时任务',
    view: '/system/com_levin_oak_base/scheduled-task/index.vue',
  },
  {
    resource: 'ServicePlugin',
    icon: 'lucide:puzzle',
    name: 'ServicePluginCrudPage',
    sourcePath: '/clob/V1/ServicePlugin',
    title: '服务插件',
    view: '/system/com_levin_oak_base/service-plugin/index.vue',
  },
  {
    resource: 'Setting',
    icon: 'lucide:settings-2',
    name: 'SettingCrudPage',
    sourcePath: '/clob/V1/Setting',
    title: '系统设置',
    view: '/system/com_levin_oak_base/setting/index.vue',
  },
  {
    resource: 'SettingForTenant',
    icon: 'lucide:sliders-horizontal',
    name: 'SettingForTenantCrudPage',
    sourcePath: '/clob/V1/SettingForTenant',
    title: '租户系统设置',
    view: '/system/com_levin_oak_base/setting-for-tenant/index.vue',
  },
  {
    resource: 'SimpleApi',
    icon: 'lucide:braces',
    name: 'SimpleApiCrudPage',
    sourcePath: '/clob/V1/SimpleApi',
    title: '简单接口',
    view: '/system/com_levin_oak_base/simple-api/index.vue',
  },
  {
    resource: 'SimpleForm',
    icon: 'lucide:clipboard-pen-line',
    name: 'SimpleFormCrudPage',
    sourcePath: '/clob/V1/SimpleForm',
    title: '简单表单',
    view: '/system/com_levin_oak_base/simple-form/index.vue',
  },
  {
    resource: 'SimplePage',
    icon: 'lucide:file-box',
    name: 'SimplePageCrudPage',
    sourcePath: '/clob/V1/SimplePage',
    title: '简单页面',
    view: '/system/com_levin_oak_base/simple-page/index.vue',
  },
  {
    resource: 'SocialUser',
    icon: 'lucide:users-round',
    name: 'SocialUserCrudPage',
    sourcePath: '/clob/V1/SocialUser',
    title: '社交用户',
    view: '/system/com_levin_oak_base/social-user/index.vue',
  },
  {
    resource: 'TenantApp',
    icon: 'lucide:box',
    name: 'TenantAppCrudPage',
    sourcePath: '/clob/V1/TenantApp',
    title: '租户应用',
    view: '/system/com_levin_oak_base/tenant-app/index.vue',
  },
  {
    resource: 'UrlExAcl',
    icon: 'lucide:shield-check',
    name: 'UrlExAclCrudPage',
    sourcePath: '/clob/V1/UrlExAcl',
    title: 'URL访问控制',
    view: '/system/com_levin_oak_base/url-ex-acl/index.vue',
  },
  {
    resource: 'UserSetting',
    icon: 'lucide:sliders-horizontal',
    name: 'UserSettingCrudPage',
    sourcePath: '/clob/V1/UserSetting',
    title: '用户设置',
    view: '/system/com_levin_oak_base/user-setting/index.vue',
  },
];

const LOCAL_ROUTE_MAPPING_MAP = new Map(
  LOCAL_ROUTE_MAPPINGS.map((item) => [item.sourcePath, item]),
);
const LOCAL_ROUTE_MAPPING_BY_RESOURCE = new Map(
  LOCAL_ROUTE_MAPPINGS.map((item) => [item.resource.toLowerCase(), item]),
);

function collectRoutePaths(
  routes: RouteRecordStringComponent[],
  paths = new Set<string>(),
) {
  routes.forEach((route) => {
    paths.add(route.path);
    if (route.children?.length) {
      collectRoutePaths(
        route.children as RouteRecordStringComponent[],
        paths,
      );
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

function convertLeafRoute(
  item: BackendMenuInfo,
  normalizedPath: string,
): RouteRecordStringComponent {
  const finalPath = normalizedPath === '/' ? '/backend/home' : normalizedPath;
  const actionType = normalizeActionType(item.actionType);
  const pageType = normalizePageType(item.pageType);
  const mapping =
    LOCAL_ROUTE_MAPPING_MAP.get(normalizedPath) ||
    LOCAL_ROUTE_MAPPING_BY_RESOURCE.get(
      extractResourceFromMenuPath(normalizedPath).toLowerCase(),
    );

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
): null | RouteRecordStringComponent {
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

  return convertLeafRoute(item, normalizedPath);
}

export function buildMenuRoutes(backendMenus: BackendMenuInfo[]) {
  const routes = backendMenus
    .map((item) => convertMenuNode(item))
    .filter(Boolean) as RouteRecordStringComponent[];

  const existingPaths = collectRoutePaths(routes);

  LOCAL_ROUTE_MAPPINGS.forEach((mapping) => {
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

export const convertMenuNodeForTest = convertMenuNode;
