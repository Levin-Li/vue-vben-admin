import type {
  AdminFrontendModule,
  AdminMenuSyncService,
  AdminNoticeService,
  AdminPageMap,
  AdminUserSecurityService,
} from '../index';

export interface AdminApplicationOptions {
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
    noticeService: applicationOptions.noticeService,
    userSecurityService: applicationOptions.userSecurityService,
  };
}
