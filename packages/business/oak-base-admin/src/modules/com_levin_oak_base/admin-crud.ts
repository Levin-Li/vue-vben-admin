import type { RouteRecordRaw } from 'vue-router';

export interface OakBaseAdminCrudResource {
  icon: string;
  name: string;
  resource: string;
  title: string;
}

export interface CreateOakBaseAdminCrudRoutesOptions {
  fallbackComponent?: NonNullable<RouteRecordRaw['component']>;
  icon?: string;
  localViewMap?: Record<string, NonNullable<RouteRecordRaw['component']>>;
  order?: number;
  rootName?: string;
  rootPath?: string;
  title?: string;
}

export const oakBaseAdminCrudResources: OakBaseAdminCrudResource[] = [
  {
    icon: 'lucide:history',
    name: 'AccessLog',
    resource: 'AccessLog',
    title: '访问日志',
  },
  {
    icon: 'lucide:map-pin',
    name: 'Address',
    resource: 'Address',
    title: '地址管理',
  },
  {
    icon: 'lucide:app-window',
    name: 'AppClient',
    resource: 'AppClient',
    title: '应用客户端',
  },
  { icon: 'lucide:map', name: 'Area', resource: 'Area', title: '区域管理' },
  {
    icon: 'lucide:file-text',
    name: 'Article',
    resource: 'Article',
    title: '文章管理',
  },
  {
    icon: 'lucide:newspaper',
    name: 'ArticleChannel',
    resource: 'ArticleChannel',
    title: '文章栏目',
  },
  {
    icon: 'lucide:landmark',
    name: 'BankBranch',
    resource: 'BankBranch',
    title: '银行网点',
  },
  { icon: 'lucide:badge', name: 'Brand', resource: 'Brand', title: '品牌管理' },
  {
    icon: 'lucide:users',
    name: 'Customer',
    resource: 'Customer',
    title: '客户管理',
  },
  {
    icon: 'lucide:flask-conical',
    name: 'Demo',
    resource: 'Demo',
    title: '示例管理',
  },
  {
    icon: 'lucide:book-open',
    name: 'Dict',
    resource: 'Dict',
    title: '数据字典',
  },
  {
    icon: 'lucide:globe',
    name: 'Domain',
    resource: 'Domain',
    title: '根域名管理',
  },
  {
    icon: 'lucide:shield-check',
    name: 'DomainSslCert',
    resource: 'DomainSslCert',
    title: 'SSL证书管理',
  },
  {
    icon: 'lucide:folder-open',
    name: 'FileRes',
    resource: 'FileRes',
    title: '文件资源',
  },
  {
    icon: 'lucide:wallet',
    name: 'FundAccount',
    resource: 'FundAccount',
    title: '资金账户',
  },
  {
    icon: 'lucide:receipt-text',
    name: 'FundAccountLog',
    resource: 'FundAccountLog',
    title: '资金账户日志',
  },
  {
    icon: 'lucide:repeat',
    name: 'FundExchangeRule',
    resource: 'FundExchangeRule',
    title: '资金兑换规则',
  },
  {
    icon: 'lucide:languages',
    name: 'I18nRes',
    resource: 'I18nRes',
    title: '国际化资源',
  },
  {
    icon: 'lucide:briefcase-business',
    name: 'JobPost',
    resource: 'JobPost',
    title: '岗位管理',
  },
  { icon: 'lucide:menu', name: 'Menu', resource: 'Menu', title: '菜单管理' },
  {
    icon: 'lucide:flag',
    name: 'Nation',
    resource: 'Nation',
    title: '国家地区',
  },
  {
    icon: 'lucide:megaphone',
    name: 'Notice',
    resource: 'Notice',
    title: '通知公告',
  },
  {
    icon: 'lucide:list-checks',
    name: 'NoticeProcessLog',
    resource: 'NoticeProcessLog',
    title: '通知处理日志',
  },
  {
    icon: 'lucide:building-2',
    name: 'Org',
    resource: 'Org',
    title: '组织管理',
  },
  {
    icon: 'lucide:credit-card',
    name: 'PayChannel',
    resource: 'PayChannel',
    title: '支付渠道',
  },
  {
    icon: 'lucide:receipt',
    name: 'PayOrder',
    resource: 'PayOrder',
    title: '支付订单',
  },
  {
    icon: 'lucide:key-round',
    name: 'RbacPermissionItem',
    resource: 'RbacPermissionItem',
    title: '权限项定义',
  },
  { icon: 'lucide:shield', name: 'Role', resource: 'Role', title: '角色管理' },
  {
    icon: 'lucide:clipboard-clock',
    name: 'ScheduledLog',
    resource: 'ScheduledLog',
    title: '定时任务日志',
  },
  {
    icon: 'lucide:calendar-clock',
    name: 'ScheduledTask',
    resource: 'ScheduledTask',
    title: '定时任务',
  },
  {
    icon: 'lucide:plug',
    name: 'ServicePlugin',
    resource: 'ServicePlugin',
    title: '服务插件',
  },
  {
    icon: 'lucide:settings',
    name: 'Setting',
    resource: 'Setting',
    title: '系统设置',
  },
  {
    icon: 'lucide:building',
    name: 'SettingForTenant',
    resource: 'SettingForTenant',
    title: '租户系统设置',
  },
  {
    icon: 'lucide:user-cog',
    name: 'MySetting',
    resource: 'MySetting',
    title: '我的设置',
  },
  {
    icon: 'lucide:workflow',
    name: 'SimpleApi',
    resource: 'SimpleApi',
    title: '简单接口',
  },
  {
    icon: 'lucide:clipboard-list',
    name: 'SimpleForm',
    resource: 'SimpleForm',
    title: '简单表单',
  },
  {
    icon: 'lucide:file',
    name: 'SimplePage',
    resource: 'SimplePage',
    title: '简单页面',
  },
  {
    icon: 'lucide:user-round',
    name: 'SocialUser',
    resource: 'SocialUser',
    title: '社交用户',
  },
  {
    icon: 'lucide:building',
    name: 'Tenant',
    resource: 'Tenant',
    title: '租户管理',
  },
  {
    icon: 'lucide:panels-top-left',
    name: 'TenantApp',
    resource: 'TenantApp',
    title: '租户应用',
  },
  {
    icon: 'lucide:monitor',
    name: 'TenantSite',
    resource: 'TenantSite',
    title: '租户站点',
  },
  {
    icon: 'lucide:lock-keyhole',
    name: 'UrlExAcl',
    resource: 'UrlExAcl',
    title: 'URL 访问控制',
  },
  { icon: 'lucide:user', name: 'User', resource: 'User', title: '用户管理' },
  {
    icon: 'lucide:user-cog',
    name: 'UserSetting',
    resource: 'UserSetting',
    title: '用户设置',
  },
];

export const oakBaseAdminResourceViewMap: Record<
  string,
  NonNullable<RouteRecordRaw['component']>
> = {
  AccessLog: () => import('./views/access-log/index.vue'),
  Address: () => import('./views/address/index.vue'),
  AppClient: () => import('./views/app-client/index.vue'),
  Area: () => import('./views/area/index.vue'),
  Article: () => import('./views/article/index.vue'),
  ArticleChannel: () => import('./views/article-channel/index.vue'),
  BankBranch: () => import('./views/bank-branch/index.vue'),
  Brand: () => import('./views/brand/index.vue'),
  Customer: () => import('./views/customer/index.vue'),
  Demo: () => import('./views/demo/index.vue'),
  Dict: () => import('./views/dict/index.vue'),
  Domain: () => import('./views/domain/index.vue'),
  DomainSslCert: () => import('./views/domain-ssl-cert/index.vue'),
  FileRes: () => import('./views/file-res/index.vue'),
  FundAccount: () => import('./views/fund-account/index.vue'),
  FundAccountLog: () => import('./views/fund-account-log/index.vue'),
  FundExchangeRule: () => import('./views/fund-exchange-rule/index.vue'),
  I18nRes: () => import('./views/i18n-res/index.vue'),
  JobPost: () => import('./views/job-post/index.vue'),
  Menu: () => import('./views/menu/index.vue'),
  Nation: () => import('./views/nation/index.vue'),
  Notice: () => import('./views/notice/index.vue'),
  NoticeProcessLog: () => import('./views/notice-process-log/index.vue'),
  Org: () => import('./views/org/index.vue'),
  PayChannel: () => import('./views/pay-channel/index.vue'),
  PayOrder: () => import('./views/pay-order/index.vue'),
  RbacPermissionItem: () => import('./views/rbac-permission-item/index.vue'),
  Role: () => import('./views/role/index.vue'),
  ScheduledLog: () => import('./views/scheduled-log/index.vue'),
  ScheduledTask: () => import('./views/scheduled-task/index.vue'),
  ServicePlugin: () => import('./views/service-plugin/index.vue'),
  Setting: () => import('./views/setting/index.vue'),
  SettingForTenant: () => import('./views/setting-for-tenant/index.vue'),
  MySetting: () => import('./views/my-setting/index.vue'),
  SimpleApi: () => import('./views/simple-api/index.vue'),
  SimpleForm: () => import('./views/simple-form/index.vue'),
  SimplePage: () => import('./views/simple-page/index.vue'),
  SocialUser: () => import('./views/social-user/index.vue'),
  Tenant: () => import('./views/tenant/index.vue'),
  TenantApp: () => import('./views/tenant-app/index.vue'),
  TenantSite: () => import('./views/tenant-site/index.vue'),
  UrlExAcl: () => import('./views/url-ex-acl/index.vue'),
  User: () => import('./views/user/index.vue'),
  UserSetting: () => import('./views/user-setting/index.vue'),
};

export function createOakBaseAdminCrudRoutes(
  options: CreateOakBaseAdminCrudRoutesOptions = {},
): RouteRecordRaw[] {
  const {
    fallbackComponent,
    icon = 'lucide:database',
    localViewMap = {},
    order = 120,
    rootName = 'AdminCrudPages',
    rootPath = '/clob/V1/index',
    title = '后台管理',
  } = options;

  return [
    {
      meta: {
        icon,
        order,
        title,
      },
      name: rootName,
      path: rootPath,
      children: oakBaseAdminCrudResources.map<RouteRecordRaw>((item) => {
        const component =
          localViewMap[item.resource] ||
          oakBaseAdminResourceViewMap[item.resource] ||
          fallbackComponent;

        if (!component) {
          throw new Error(`Missing admin page component for ${item.resource}.`);
        }

        return {
          component,
          meta: {
            crudResource: item.resource,
            icon: item.icon,
            title: item.title,
          },
          name: `AdminCrud${item.name}`,
          path: `/clob/V1/${item.resource}`,
        };
      }),
    },
  ];
}
