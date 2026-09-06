import type { AdminFrontendModule } from '@levin/admin-framework';

/** 显式复用各页面静态配置，避免扫描组件或猜测查询字段。 */
export const oakBaseQueryConfigLoaders: NonNullable<
  AdminFrontendModule['queryConfigLoaders']
> = {
  '/system/com_levin_oak_base/setting-history-data/index.vue': () =>
    import('./views/setting-history-data/config').then(
      (module) => module.settingHistoryDataPageCrudConfig,
    ),
  '/system/com_levin_oak_base/access-log/index.vue': () =>
    import('./views/access-log/config').then(
      (module) => module.accessLogPageCrudConfig,
    ),
  '/system/com_levin_oak_base/address/index.vue': () =>
    import('./views/address/config').then(
      (module) => module.addressPageCrudConfig,
    ),
  '/system/com_levin_oak_base/area/index.vue': () =>
    import('./views/area/config').then((module) => module.areaPageCrudConfig),
  '/system/com_levin_oak_base/article/index.vue': () =>
    import('./views/article/config').then(
      (module) => module.articlePageCrudConfig,
    ),
  '/system/com_levin_oak_base/article-channel/index.vue': () =>
    import('./views/article-channel/config').then(
      (module) => module.articleChannelPageCrudConfig,
    ),
  '/system/com_levin_oak_base/brand/index.vue': () =>
    import('./views/brand/config').then((module) => module.brandPageCrudConfig),
  '/system/com_levin_oak_base/client-app/index.vue': () =>
    import('./views/client-app/config').then(
      (module) => module.clientAppPageCrudConfig,
    ),
  '/system/com_levin_oak_base/customer/index.vue': () =>
    import('./views/customer/config').then(
      (module) => module.customerPageCrudConfig,
    ),
  '/system/com_levin_oak_base/demo/index.vue': () =>
    import('./views/demo/config').then((module) => module.demoPageCrudConfig),
  '/system/com_levin_oak_base/dict/index.vue': () =>
    import('./views/dict/config').then((module) => module.dictPageCrudConfig),
  '/system/com_levin_oak_base/domain/index.vue': () =>
    import('./views/domain/config').then(
      (module) => module.domainPageCrudConfig,
    ),
  '/system/com_levin_oak_base/domain-ssl-cert/index.vue': () =>
    import('./views/domain-ssl-cert/config').then(
      (module) => module.domainSslCertPageCrudConfig,
    ),
  '/system/com_levin_oak_base/electronic-contract/index.vue': () =>
    import('./views/electronic-contract/config').then(
      (module) => module.electronicContractPageCrudConfig,
    ),
  '/system/com_levin_oak_base/electronic-contract-template/index.vue': () =>
    import('./views/electronic-contract-template/config').then(
      (module) => module.electronicContractTemplatePageCrudConfig,
    ),
  '/system/com_levin_oak_base/electronic-invoice/index.vue': () =>
    import('./views/electronic-invoice/config').then(
      (module) => module.electronicInvoicePageCrudConfig,
    ),
  '/system/com_levin_oak_base/electronic-invoice-provider-connection/index.vue':
    () =>
      import('./views/electronic-invoice-provider-connection/config').then(
        (module) => module.electronicInvoiceProviderConnectionPageCrudConfig,
      ),
  '/system/com_levin_oak_base/email-relay-route/index.vue': () =>
    import('./views/email-relay-route/config').then(
      (module) => module.emailRelayRoutePageCrudConfig,
    ),
  '/system/com_levin_oak_base/file-res/index.vue': () =>
    import('./views/file-res/config').then(
      (module) => module.fileResPageCrudConfig,
    ),
  '/system/com_levin_oak_base/fund-account/index.vue': () =>
    import('./views/fund-account/config').then(
      (module) => module.fundAccountPageCrudConfig,
    ),
  '/system/com_levin_oak_base/fund-account-log/index.vue': () =>
    import('./views/fund-account-log/config').then(
      (module) => module.fundAccountLogPageCrudConfig,
    ),
  '/system/com_levin_oak_base/fund-exchange-rule/index.vue': () =>
    import('./views/fund-exchange-rule/config').then(
      (module) => module.fundExchangeRulePageCrudConfig,
    ),
  '/system/com_levin_oak_base/global-org-selector-setting/index.vue': () =>
    import('./views/global-org-selector-setting/config').then(
      (module) => module.globalOrgSelectorSettingPageCrudConfig,
    ),
  '/system/com_levin_oak_base/i18n-res/index.vue': () =>
    import('./views/i18n-res/config').then(
      (module) => module.i18nResPageCrudConfig,
    ),
  '/system/com_levin_oak_base/import-export-template/index.vue': () =>
    import('./views/import-export-template/config').then(
      (module) => module.importExportTemplatePageCrudConfig,
    ),
  '/system/com_levin_oak_base/job-post/index.vue': () =>
    import('./views/job-post/config').then(
      (module) => module.jobPostPageCrudConfig,
    ),
  '/system/com_levin_oak_base/legal-subject/index.vue': () =>
    import('./views/legal-subject/config').then(
      (module) => module.legalSubjectPageCrudConfig,
    ),
  '/system/com_levin_oak_base/nation/index.vue': () =>
    import('./views/nation/config').then(
      (module) => module.nationPageCrudConfig,
    ),
  '/system/com_levin_oak_base/notice/index.vue': () =>
    import('./views/notice/config').then(
      (module) => module.noticePageCrudConfig,
    ),
  '/system/com_levin_oak_base/notice-process-log/index.vue': () =>
    import('./views/notice-process-log/config').then(
      (module) => module.noticeProcessLogPageCrudConfig,
    ),
  '/system/com_levin_oak_base/online-code-gen/index.vue': () =>
    import('./views/online-code-gen/config').then(
      (module) => module.onlineCodeGenPageCrudConfig,
    ),
  '/system/com_levin_oak_base/open-area/index.vue': () =>
    import('./views/open-area/config').then(
      (module) => module.openAreaPageCrudConfig,
    ),
  '/system/com_levin_oak_base/org/index.vue': () =>
    import('./views/org/config').then((module) => module.orgPageCrudConfig),
  '/system/com_levin_oak_base/partner/index.vue': () =>
    import('./views/partner/config').then(
      (module) => module.partnerPageCrudConfig,
    ),
  '/system/com_levin_oak_base/pay-channel/index.vue': () =>
    import('./views/pay-channel/config').then(
      (module) => module.payChannelPageCrudConfig,
    ),
  '/system/com_levin_oak_base/pay-order/index.vue': () =>
    import('./views/pay-order/config').then(
      (module) => module.payOrderPageCrudConfig,
    ),
  '/system/com_levin_oak_base/rbac-permission-item/index.vue': () =>
    import('./views/rbac-permission-item/config').then(
      (module) => module.rbacPermissionItemPageCrudConfig,
    ),
  '/system/com_levin_oak_base/role/index.vue': () =>
    import('./views/role/config').then((module) => module.rolePageCrudConfig),
  '/system/com_levin_oak_base/scheduled-log/index.vue': () =>
    import('./views/scheduled-log/config').then(
      (module) => module.scheduledLogPageCrudConfig,
    ),
  '/system/com_levin_oak_base/scheduled-task/index.vue': () =>
    import('./views/scheduled-task/config').then(
      (module) => module.scheduledTaskPageCrudConfig,
    ),
  '/system/com_levin_oak_base/service-plugin/index.vue': () =>
    import('./views/service-plugin/config').then(
      (module) => module.servicePluginPageCrudConfig,
    ),
  '/system/com_levin_oak_base/service-plugin-setting/index.vue': () =>
    import('./views/service-plugin-setting/config').then(
      (module) => module.servicePluginSettingPageCrudConfig,
    ),
  '/system/com_levin_oak_base/setting/index.vue': () =>
    import('./views/setting/config').then(
      (module) => module.settingPageCrudConfig,
    ),
  '/system/com_levin_oak_base/social-user/index.vue': () =>
    import('./views/social-user/config').then(
      (module) => module.socialUserPageCrudConfig,
    ),
  '/system/com_levin_oak_base/tenant/index.vue': () =>
    import('./views/tenant/config').then(
      (module) => module.tenantPageCrudConfig,
    ),
  '/system/com_levin_oak_base/tenant-app/index.vue': () =>
    import('./views/tenant-app/config').then(
      (module) => module.tenantAppPageCrudConfig,
    ),
  '/system/com_levin_oak_base/tenant-custom-menu/index.vue': () =>
    import('./views/tenant-custom-menu/config').then(
      (module) => module.tenantCustomMenuPageCrudConfig,
    ),
  '/system/com_levin_oak_base/tenant-site/index.vue': () =>
    import('./views/tenant-site/config').then(
      (module) => module.tenantSitePageCrudConfig,
    ),
  '/system/com_levin_oak_base/traffic-control-rule/index.vue': () =>
    import('./views/traffic-control-rule/config').then(
      (module) => module.trafficControlRulePageCrudConfig,
    ),
  '/system/com_levin_oak_base/ui-setting/index.vue': () =>
    import('./views/ui-setting/config').then(
      (module) => module.uiSettingPageCrudConfig,
    ),
  '/system/com_levin_oak_base/url-ex-acl/index.vue': () =>
    import('./views/url-ex-acl/config').then(
      (module) => module.urlExAclPageCrudConfig,
    ),
  '/system/com_levin_oak_base/user/index.vue': () =>
    import('./views/user/config').then((module) => module.userPageCrudConfig),
  '/system/com_levin_oak_base/user-setting/index.vue': () =>
    import('./views/user-setting/config').then(
      (module) => module.userSettingPageCrudConfig,
    ),
};
