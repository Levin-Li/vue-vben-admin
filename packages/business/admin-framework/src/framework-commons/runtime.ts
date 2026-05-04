export interface AdminRequestClient {
  delete<T = any>(url: string, config?: Record<string, any>): Promise<T>;
  get<T = any>(url: string, config?: Record<string, any>): Promise<T>;
  post<T = any>(
    url: string,
    data?: any,
    config?: Record<string, any>,
  ): Promise<T>;
  put<T = any>(
    url: string,
    data?: any,
    config?: Record<string, any>,
  ): Promise<T>;
  request<T = any>(
    urlOrConfig: string | Record<string, any>,
    config?: Record<string, any>,
  ): Promise<T>;
  upload?<T = any>(
    url: string,
    data?: Record<string, any>,
    config?: Record<string, any>,
  ): Promise<T>;
}

export interface AdminNoticeService {
  myMessages(params?: any, options?: any): Promise<any>;
  processMyMessage(data?: any, options?: any): Promise<any>;
}

export interface AdminMenuSyncService {
  syncMenu(data?: any, options?: any): Promise<any>;
}

export interface AdminUserSecurityService {
  resetMfaSecretKey(data?: any, options?: any): Promise<any>;
  viewMyMfaQrCode(params?: any, options?: any): Promise<any>;
}

export interface AdminFrameworkRuntime {
  getAuthorizedMenuListApi?: () => Promise<any[]>;
  menuSyncService?: AdminMenuSyncService;
  noticeService?: AdminNoticeService;
  requestClient: AdminRequestClient;
  userSecurityService?: AdminUserSecurityService;
}

let runtime: AdminFrameworkRuntime | undefined;

function assertRuntime() {
  if (!runtime) {
    throw new Error(
      '@levin/admin-framework runtime is not configured. Call setAdminFrameworkRuntime() in the host app before mounting admin modules.',
    );
  }

  return runtime;
}

export function setAdminFrameworkRuntime(nextRuntime: AdminFrameworkRuntime) {
  runtime = nextRuntime;
}

export function getAdminFrameworkRuntime() {
  return assertRuntime();
}

export function getAdminRequestClient() {
  return assertRuntime().requestClient;
}

export function getAdminMenuSyncService() {
  return runtime?.menuSyncService;
}

export function getAdminNoticeService() {
  return runtime?.noticeService;
}

export function getAdminUserSecurityService() {
  return runtime?.userSecurityService;
}

export const requestClient: AdminRequestClient = {
  delete(url, config) {
    return getAdminRequestClient().delete(url, config);
  },
  get(url, config) {
    return getAdminRequestClient().get(url, config);
  },
  post(url, data, config) {
    return getAdminRequestClient().post(url, data, config);
  },
  put(url, data, config) {
    return getAdminRequestClient().put(url, data, config);
  },
  request(urlOrConfig, config) {
    return getAdminRequestClient().request(urlOrConfig, config);
  },
  upload(url, data, config) {
    const upload = getAdminRequestClient().upload;
    if (!upload) {
      throw new Error('The host requestClient does not support upload().');
    }

    return upload(url, data, config);
  },
};

export async function getAuthorizedMenuListApi() {
  const getAuthorizedMenuList = assertRuntime().getAuthorizedMenuListApi;

  if (!getAuthorizedMenuList) {
    return [];
  }

  return getAuthorizedMenuList();
}
