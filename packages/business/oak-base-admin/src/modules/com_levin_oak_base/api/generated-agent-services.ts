// 自动生成：node scripts/scan-agent-api-candidates.mjs
import { accessLogService as service0 } from './access-log-service';
import { aclTestService as service1 } from './acl-test-service';
import { addressService as service2 } from './address-service';
import { areaService as service3 } from './area-service';
import { articleChannelService as service4 } from './article-channel-service';
import { articleService as service5 } from './article-service';
import { auditReportService as service6 } from './audit-report-service';
import { backendFixedJobService as service7 } from './backend-fixed-job-service';
import { brandService as service8 } from './brand-service';
import { businessRegistryService as service9 } from './business-registry-service';
import { channelPartnerService as service10 } from './channel-partner-service';
import { clientAppService as service11 } from './client-app-service';
import { customerService as service12 } from './customer-service';
import { dailyAccessStatService as service13 } from './daily-access-stat-service';
import { dataMaskingSettingService as service14 } from './data-masking-setting-service';
import { dataModelService as service15 } from './data-model-service';
import { demoService as service16 } from './demo-service';
import { dictService as service17 } from './dict-service';
import { domainService as service18 } from './domain-service';
import { domainSslCertService as service19 } from './domain-ssl-cert-service';
import { electronicContractService as service20 } from './electronic-contract-service';
import { electronicContractTemplateService as service21 } from './electronic-contract-template-service';
import { electronicInvoiceProviderConnectionService as service22 } from './electronic-invoice-provider-connection-service';
import { electronicInvoiceService as service23 } from './electronic-invoice-service';
import { emailRelayRouteService as service24 } from './email-relay-route-service';
import { fileResService as service25 } from './file-res-service';
import { fundAccountLogService as service26 } from './fund-account-log-service';
import { fundAccountService as service27 } from './fund-account-service';
import { fundExchangeRuleService as service28 } from './fund-exchange-rule-service';
import { i18nResService as service29 } from './i18n-res-service';
import { importExportTemplateService as service30 } from './import-export-template-service';
import { inboxService as service31 } from './inbox-service';
import { invitationLinkService as service32 } from './invitation-link-service';
import { jobPostService as service33 } from './job-post-service';
import { legalSubjectService as service34 } from './legal-subject-service';
import { memberUserService as service35 } from './member-user-service';
import { menuService as service36 } from './menu-service';
import { nationService as service37 } from './nation-service';
import { noticeProcessLogService as service38 } from './notice-process-log-service';
import { noticeService as service39 } from './notice-service';
import { notificationAuditService as service40 } from './notification-audit-service';
import { onlineCodeGenService as service41 } from './online-code-gen-service';
import { openAreaService as service42 } from './open-area-service';
import { orgService as service43 } from './org-service';
import { partnerService as service44 } from './partner-service';
import { payChannelService as service45 } from './pay-channel-service';
import { payOrderService as service46 } from './pay-order-service';
import { paymentSimulationWorkbenchService as service47 } from './payment-simulation-workbench-service';
import { platformDomainService as service48 } from './platform-domain-service';
import { rbacPermissionItemService as service49 } from './rbac-permission-item-service';
import { reportCopyService as service50 } from './report-copy-service';
import { reportDefinitionManagementService as service51 } from './report-definition-management-service';
import { reportMenuService as service52 } from './report-menu-service';
import { reportPreviewService as service53 } from './report-preview-service';
import { reportRuntimeService as service54 } from './report-runtime-service';
import { robotNotifyGroupService as service55 } from './robot-notify-group-service';
import { roleService as service56 } from './role-service';
import { scheduledLogService as service57 } from './scheduled-log-service';
import { scheduledTaskService as service58 } from './scheduled-task-service';
import { servicePluginService as service59 } from './service-plugin-service';
import { servicePluginSettingService as service60 } from './service-plugin-setting-service';
import { settingHistoryDataService as service61 } from './setting-history-data-service';
import { settingService as service62 } from './setting-service';
import { settlementOrderService as service63 } from './settlement-order-service';
import { simpleApiService as service64 } from './simple-api-service';
import { simpleFormService as service65 } from './simple-form-service';
import { simplePageService as service66 } from './simple-page-service';
import { socialUserService as service67 } from './social-user-service';
import { supplierPartnerService as service68 } from './supplier-partner-service';
import { supportMailboxSettingService as service69 } from './support-mailbox-setting-service';
import { tenantCustomMenuService as service70 } from './tenant-custom-menu-service';
import { tenantService as service71 } from './tenant-service';
import { tenantSiteService as service72 } from './tenant-site-service';
import { ticketQueueService as service73 } from './ticket-queue-service';
import { ticketService as service74 } from './ticket-service';
import { trafficControlRuleService as service75 } from './traffic-control-rule-service';
import { uiSettingService as service76 } from './ui-setting-service';
import { urlExAclService as service77 } from './url-ex-acl-service';
import { userMessageService as service78 } from './user-message-service';
import { userPersonalSettingService as service79 } from './user-personal-setting-service';
import { userService as service80 } from './user-service';
import { workflowDefinitionService as service81 } from './workflow-definition-service';
import { workflowDefinitionVersionService as service82 } from './workflow-definition-version-service';
import { workflowExpenseService as service83 } from './workflow-expense-service';
import { workflowManagementService as service84 } from './workflow-management-service';
import { workflowNotificationRouteService as service85 } from './workflow-notification-route-service';
import { workflowRequestService as service86 } from './workflow-request-service';
import { workflowRuntimeService as service87 } from './workflow-runtime-service';

export const generatedAgentServices: Record<string, object> = {
  "AccessLogService": service0,
  "AclTestService": service1,
  "AddressService": service2,
  "AreaService": service3,
  "ArticleChannelService": service4,
  "ArticleService": service5,
  "AuditReportService": service6,
  "BackendFixedJobService": service7,
  "BrandService": service8,
  "BusinessRegistryService": service9,
  "ChannelPartnerService": service10,
  "ClientAppService": service11,
  "CustomerService": service12,
  "DailyAccessStatService": service13,
  "DataMaskingSettingService": service14,
  "DataModelService": service15,
  "DemoService": service16,
  "DictService": service17,
  "DomainService": service18,
  "DomainSslCertService": service19,
  "ElectronicContractService": service20,
  "ElectronicContractTemplateService": service21,
  "ElectronicInvoiceProviderConnectionService": service22,
  "ElectronicInvoiceService": service23,
  "EmailRelayRouteService": service24,
  "FileResService": service25,
  "FundAccountLogService": service26,
  "FundAccountService": service27,
  "FundExchangeRuleService": service28,
  "I18nResService": service29,
  "ImportExportTemplateService": service30,
  "InboxService": service31,
  "InvitationLinkService": service32,
  "JobPostService": service33,
  "LegalSubjectService": service34,
  "MemberUserService": service35,
  "MenuService": service36,
  "NationService": service37,
  "NoticeProcessLogService": service38,
  "NoticeService": service39,
  "NotificationAuditService": service40,
  "OnlineCodeGenService": service41,
  "OpenAreaService": service42,
  "OrgService": service43,
  "PartnerService": service44,
  "PayChannelService": service45,
  "PayOrderService": service46,
  "PaymentSimulationWorkbenchService": service47,
  "PlatformDomainService": service48,
  "RbacPermissionItemService": service49,
  "ReportCopyService": service50,
  "ReportDefinitionManagementService": service51,
  "ReportMenuService": service52,
  "ReportPreviewService": service53,
  "ReportRuntimeService": service54,
  "RobotNotifyGroupService": service55,
  "RoleService": service56,
  "ScheduledLogService": service57,
  "ScheduledTaskService": service58,
  "ServicePluginService": service59,
  "ServicePluginSettingService": service60,
  "SettingHistoryDataService": service61,
  "SettingService": service62,
  "SettlementOrderService": service63,
  "SimpleApiService": service64,
  "SimpleFormService": service65,
  "SimplePageService": service66,
  "SocialUserService": service67,
  "SupplierPartnerService": service68,
  "SupportMailboxSettingService": service69,
  "TenantCustomMenuService": service70,
  "TenantService": service71,
  "TenantSiteService": service72,
  "TicketQueueService": service73,
  "TicketService": service74,
  "TrafficControlRuleService": service75,
  "UiSettingService": service76,
  "UrlExAclService": service77,
  "UserMessageService": service78,
  "UserPersonalSettingService": service79,
  "UserService": service80,
  "WorkflowDefinitionService": service81,
  "WorkflowDefinitionVersionService": service82,
  "WorkflowExpenseService": service83,
  "WorkflowManagementService": service84,
  "WorkflowNotificationRouteService": service85,
  "WorkflowRequestService": service86,
  "OakWorkflowRuntimeService": service87,
};
