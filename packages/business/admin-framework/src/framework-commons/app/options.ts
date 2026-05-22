import type {
  AdminFrontendModule,
  AdminI18nLabelSyncService,
  AdminMenuSyncService,
  AdminNoticeService,
  AdminPageMap,
  AdminUserSecurityService,
} from '../index';

export interface AdminApplicationOptions {
  i18nLabelSyncService?: AdminI18nLabelSyncService;
  menuSyncService?: AdminMenuSyncService;
  modules?: AdminFrontendModule[];
  noticeService?: AdminNoticeService;
  pageOverrides?: AdminPageMap;
  userSecurityService?: AdminUserSecurityService;
}

let applicationOptions: AdminApplicationOptions = {
  modules: [],
  pageOverrides: {},
};

export function configureAdminApplication(options: AdminApplicationOptions) {
  applicationOptions = {
    i18nLabelSyncService: options.i18nLabelSyncService,
    menuSyncService: options.menuSyncService,
    modules: options.modules || [],
    noticeService: options.noticeService,
    pageOverrides: options.pageOverrides || {},
    userSecurityService: options.userSecurityService,
  };
}

export function getEnabledFrontendModules() {
  return applicationOptions.modules || [];
}

export function getAdminPageOverrides() {
  return applicationOptions.pageOverrides || {};
}

export function getAdminApplicationServices() {
  return {
    menuSyncService: applicationOptions.menuSyncService,
    i18nLabelSyncService: applicationOptions.i18nLabelSyncService,
    noticeService: applicationOptions.noticeService,
    userSecurityService: applicationOptions.userSecurityService,
  };
}
