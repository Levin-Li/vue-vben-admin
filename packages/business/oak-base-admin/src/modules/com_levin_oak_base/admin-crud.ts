import type { RouteRecordRaw } from 'vue-router';

export interface OakBaseAdminCrudResource {
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
  { name: 'AccessLog', resource: 'AccessLog', title: '访问日志' },
  { name: 'Address', resource: 'Address', title: '地址管理' },
  { name: 'AppClient', resource: 'AppClient', title: '应用客户端' },
  { name: 'Area', resource: 'Area', title: '区域管理' },
  { name: 'Article', resource: 'Article', title: '文章管理' },
  { name: 'ArticleChannel', resource: 'ArticleChannel', title: '文章栏目' },
  { name: 'BankBranch', resource: 'BankBranch', title: '银行网点' },
  { name: 'Brand', resource: 'Brand', title: '品牌管理' },
  { name: 'Customer', resource: 'Customer', title: '客户管理' },
  { name: 'Demo', resource: 'Demo', title: '示例管理' },
  { name: 'Dict', resource: 'Dict', title: '数据字典' },
  { name: 'Domain', resource: 'Domain', title: '根域名管理' },
  { name: 'DomainSslCert', resource: 'DomainSslCert', title: 'SSL证书管理' },
  { name: 'FileRes', resource: 'FileRes', title: '文件资源' },
  { name: 'FundAccount', resource: 'FundAccount', title: '资金账户' },
  { name: 'FundAccountLog', resource: 'FundAccountLog', title: '资金账户日志' },
  { name: 'FundExchangeRule', resource: 'FundExchangeRule', title: '资金兑换规则' },
  { name: 'I18nRes', resource: 'I18nRes', title: '国际化资源' },
  { name: 'JobPost', resource: 'JobPost', title: '岗位管理' },
  { name: 'Menu', resource: 'Menu', title: '菜单管理' },
  { name: 'Nation', resource: 'Nation', title: '国家地区' },
  { name: 'Notice', resource: 'Notice', title: '通知公告' },
  { name: 'NoticeProcessLog', resource: 'NoticeProcessLog', title: '通知处理日志' },
  { name: 'Org', resource: 'Org', title: '组织管理' },
  { name: 'PayChannel', resource: 'PayChannel', title: '支付渠道' },
  { name: 'PayOrder', resource: 'PayOrder', title: '支付订单' },
  { name: 'Permission', resource: 'Permission', title: '权限管理' },
  { name: 'Role', resource: 'Role', title: '角色管理' },
  { name: 'ScheduledLog', resource: 'ScheduledLog', title: '定时任务日志' },
  { name: 'ScheduledTask', resource: 'ScheduledTask', title: '定时任务' },
  { name: 'ServicePlugin', resource: 'ServicePlugin', title: '服务插件' },
  { name: 'Setting', resource: 'Setting', title: '系统设置' },
  { name: 'SettingForTenant', resource: 'SettingForTenant', title: '租户系统设置' },
  { name: 'SimpleApi', resource: 'SimpleApi', title: '简单接口' },
  { name: 'SimpleForm', resource: 'SimpleForm', title: '简单表单' },
  { name: 'SimplePage', resource: 'SimplePage', title: '简单页面' },
  { name: 'SocialUser', resource: 'SocialUser', title: '社交用户' },
  { name: 'Tenant', resource: 'Tenant', title: '租户管理' },
  { name: 'TenantApp', resource: 'TenantApp', title: '租户应用' },
  { name: 'TenantSite', resource: 'TenantSite', title: '租户站点' },
  { name: 'UrlExAcl', resource: 'UrlExAcl', title: 'URL 访问控制' },
  { name: 'User', resource: 'User', title: '用户管理' },
  { name: 'UserSetting', resource: 'UserSetting', title: '用户设置' },
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
  Permission: () => import('./views/permission/index.vue'),
  Role: () => import('./views/role/index.vue'),
  ScheduledLog: () => import('./views/scheduled-log/index.vue'),
  ScheduledTask: () => import('./views/scheduled-task/index.vue'),
  ServicePlugin: () => import('./views/service-plugin/index.vue'),
  Setting: () => import('./views/setting/index.vue'),
  SettingForTenant: () => import('./views/setting-for-tenant/index.vue'),
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
    rootPath = '/admin-crud',
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
            icon: 'lucide:panel-right-open',
            title: item.title,
          },
          name: `AdminCrud${item.name}`,
          path: `/clob/V1/${item.resource}`,
        };
      }),
    },
  ];
}
