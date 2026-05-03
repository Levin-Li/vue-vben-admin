import type { RouteRecordRaw } from 'vue-router';

interface AdminCrudRoute {
  name: string;
  resource: string;
  title: string;
}

const adminCrudRoutes: AdminCrudRoute[] = [
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
  {
    name: 'DomainSslCert',
    resource: 'DomainSslCert',
    title: 'SSL证书管理',
  },
  { name: 'FileRes', resource: 'FileRes', title: '文件资源' },
  { name: 'FundAccount', resource: 'FundAccount', title: '资金账户' },
  { name: 'FundAccountLog', resource: 'FundAccountLog', title: '资金账户日志' },
  {
    name: 'FundExchangeRule',
    resource: 'FundExchangeRule',
    title: '资金兑换规则',
  },
  { name: 'I18nRes', resource: 'I18nRes', title: '国际化资源' },
  { name: 'JobPost', resource: 'JobPost', title: '岗位管理' },
  { name: 'Menu', resource: 'Menu', title: '菜单管理' },
  { name: 'Nation', resource: 'Nation', title: '国家地区' },
  { name: 'Notice', resource: 'Notice', title: '通知公告' },
  {
    name: 'NoticeProcessLog',
    resource: 'NoticeProcessLog',
    title: '通知处理日志',
  },
  { name: 'Org', resource: 'Org', title: '组织管理' },
  { name: 'PayChannel', resource: 'PayChannel', title: '支付渠道' },
  { name: 'PayOrder', resource: 'PayOrder', title: '支付订单' },
  { name: 'Permission', resource: 'Permission', title: '权限管理' },
  { name: 'Role', resource: 'Role', title: '角色管理' },
  { name: 'ScheduledLog', resource: 'ScheduledLog', title: '定时任务日志' },
  { name: 'ScheduledTask', resource: 'ScheduledTask', title: '定时任务' },
  { name: 'ServicePlugin', resource: 'ServicePlugin', title: '服务插件' },
  { name: 'Setting', resource: 'Setting', title: '系统设置' },
  {
    name: 'SettingForTenant',
    resource: 'SettingForTenant',
    title: '租户系统设置',
  },
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

const genericCrudPage = () =>
  import('#/views/system/shared/controller-crud-page.vue');

const localViewMap: Record<string, NonNullable<RouteRecordRaw['component']>> = {
  AccessLog: () =>
    import('#/views/system/com_levin_oak_base/access-log/index.vue'),
  Address: () => import('#/views/system/com_levin_oak_base/address/index.vue'),
  AppClient: () =>
    import('#/views/system/com_levin_oak_base/app-client/index.vue'),
  Area: () => import('#/views/system/com_levin_oak_base/area/index.vue'),
  Article: () => import('#/views/system/com_levin_oak_base/article/index.vue'),
  ArticleChannel: () =>
    import('#/views/system/com_levin_oak_base/article-channel/index.vue'),
  BankBranch: () =>
    import('#/views/system/com_levin_oak_base/bank-branch/index.vue'),
  Brand: () => import('#/views/system/com_levin_oak_base/brand/index.vue'),
  Customer: () =>
    import('#/views/system/com_levin_oak_base/customer/index.vue'),
  Demo: () => import('#/views/system/com_levin_oak_base/demo/index.vue'),
  Dict: () => import('#/views/system/com_levin_oak_base/dict/index.vue'),
  Domain: () => import('#/views/system/com_levin_oak_base/domain/index.vue'),
  DomainSslCert: () =>
    import('#/views/system/com_levin_oak_base/domain-ssl-cert/index.vue'),
  FileRes: () => import('#/views/system/com_levin_oak_base/file-res/index.vue'),
  FundAccount: () =>
    import('#/views/system/com_levin_oak_base/fund-account/index.vue'),
  FundAccountLog: () =>
    import('#/views/system/com_levin_oak_base/fund-account-log/index.vue'),
  FundExchangeRule: () =>
    import('#/views/system/com_levin_oak_base/fund-exchange-rule/index.vue'),
  I18nRes: () => import('#/views/system/com_levin_oak_base/i18n-res/index.vue'),
  JobPost: () => import('#/views/system/com_levin_oak_base/job-post/index.vue'),
  Menu: () => import('#/views/system/com_levin_oak_base/menu/index.vue'),
  Nation: () => import('#/views/system/com_levin_oak_base/nation/index.vue'),
  Notice: () => import('#/views/system/com_levin_oak_base/notice/index.vue'),
  NoticeProcessLog: () =>
    import('#/views/system/com_levin_oak_base/notice-process-log/index.vue'),
  Org: () => import('#/views/system/com_levin_oak_base/org/index.vue'),
  PayChannel: () =>
    import('#/views/system/com_levin_oak_base/pay-channel/index.vue'),
  PayOrder: () =>
    import('#/views/system/com_levin_oak_base/pay-order/index.vue'),
  Permission: () =>
    import('#/views/system/com_levin_oak_base/permission/index.vue'),
  Role: () => import('#/views/system/com_levin_oak_base/role/index.vue'),
  ScheduledLog: () =>
    import('#/views/system/com_levin_oak_base/scheduled-log/index.vue'),
  ScheduledTask: () =>
    import('#/views/system/com_levin_oak_base/scheduled-task/index.vue'),
  ServicePlugin: () =>
    import('#/views/system/com_levin_oak_base/service-plugin/index.vue'),
  Setting: () => import('#/views/system/com_levin_oak_base/setting/index.vue'),
  SettingForTenant: () =>
    import('#/views/system/com_levin_oak_base/setting-for-tenant/index.vue'),
  SimpleApi: () =>
    import('#/views/system/com_levin_oak_base/simple-api/index.vue'),
  SimpleForm: () =>
    import('#/views/system/com_levin_oak_base/simple-form/index.vue'),
  SimplePage: () =>
    import('#/views/system/com_levin_oak_base/simple-page/index.vue'),
  SocialUser: () =>
    import('#/views/system/com_levin_oak_base/social-user/index.vue'),
  Tenant: () => import('#/views/system/com_levin_oak_base/tenant/index.vue'),
  TenantApp: () =>
    import('#/views/system/com_levin_oak_base/tenant-app/index.vue'),
  TenantSite: () =>
    import('#/views/system/com_levin_oak_base/tenant-site/index.vue'),
  UrlExAcl: () =>
    import('#/views/system/com_levin_oak_base/url-ex-acl/index.vue'),
  User: () => import('#/views/system/com_levin_oak_base/user/index.vue'),
  UserSetting: () =>
    import('#/views/system/com_levin_oak_base/user-setting/index.vue'),
};

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:database',
      order: 120,
      title: '后台管理',
    },
    name: 'AdminCrudPages',
    path: '/admin-crud',
    children: adminCrudRoutes.map<RouteRecordRaw>((item) => ({
      component: localViewMap[item.resource] || genericCrudPage,
      meta: {
        crudResource: item.resource,
        icon: 'lucide:panel-right-open',
        title: item.title,
      },
      name: `AdminCrud${item.name}`,
      path: `/clob/V1/${item.resource}`,
    })),
  },
];

export default routes;
