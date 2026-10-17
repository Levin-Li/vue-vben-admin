import type { WorkflowMessageActionTarget } from './shared/user-message-target';

import { guardDataAttrRequest } from './data-attr-policy';

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
    urlOrConfig: Record<string, any> | string,
    config?: Record<string, any>,
  ): Promise<T>;
  upload?<T = any>(
    url: string,
    data?: Record<string, any>,
    config?: Record<string, any>,
  ): Promise<T>;
}

export interface AdminUserMessage {
  actionTarget?: null | WorkflowMessageActionTarget;
  createTime?: string;
  id: string;
  priority?: string;
  readTime?: null | string;
  sourceId?: string;
  sourceType?: string;
  summary?: string;
  title?: string;
}

export interface AdminUserMessageService {
  list(params: {
    pageIndex: number;
    pageSize: number;
    unreadOnly: boolean;
  }): Promise<{
    items: AdminUserMessage[];
    totals: number;
  }>;
  markRead(data: { ids: string[] }): Promise<unknown>;
  unreadCount(): Promise<number>;
}

export interface AdminMenuSyncService {
  syncMenu(data?: any, options?: any): Promise<any>;
}

export interface AdminI18nLabelSyncService {
  runtimeLabels?(data?: any, options?: any): Promise<any>;
  serverLabels?(params?: any, options?: any): Promise<any>;
  syncLabels(data?: any, options?: any): Promise<any>;
  uploadModuleLabels?(data?: any, options?: any): Promise<any>;
}

export interface AdminUserSecurityService {
  resetMfaSecretKey(data?: any, options?: any): Promise<any>;
  viewMyMfaQrCode(params?: any, options?: any): Promise<any>;
}

export interface AdminFrameworkRuntime {
  i18nLabelSyncService?: AdminI18nLabelSyncService;
  menuSyncService?: AdminMenuSyncService;
  requestClient: AdminRequestClient;
  userMessageService?: AdminUserMessageService;
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

export function getAdminI18nLabelSyncService() {
  return runtime?.i18nLabelSyncService;
}

export function getAdminUserMessageService() {
  return runtime?.userMessageService;
}

export function getAdminUserSecurityService() {
  return runtime?.userSecurityService;
}

export const requestClient: AdminRequestClient = {
  async delete(url, config) {
    await guardDataAttrRequest('DELETE', url, config);
    return getAdminRequestClient().delete(url, config);
  },
  async get(url, config) {
    await guardDataAttrRequest('GET', url, config);
    return getAdminRequestClient().get(url, config);
  },
  async post(url, data, config) {
    await guardDataAttrRequest('POST', url, { ...config, data });
    return getAdminRequestClient().post(url, data, config);
  },
  async put(url, data, config) {
    await guardDataAttrRequest('PUT', url, { ...config, data });
    return getAdminRequestClient().put(url, data, config);
  },
  async request(urlOrConfig, config) {
    const options =
      typeof urlOrConfig === 'string' ? config || {} : urlOrConfig;
    const path =
      typeof urlOrConfig === 'string' ? urlOrConfig : String(options.url || '');
    await guardDataAttrRequest(String(options.method || 'GET'), path, options);
    return getAdminRequestClient().request(urlOrConfig, config);
  },
  async upload(url, data, config) {
    await guardDataAttrRequest('POST', url, { ...config, data });
    const upload = getAdminRequestClient().upload;
    if (!upload) {
      throw new Error('The host requestClient does not support upload().');
    }

    return upload(url, data, config);
  },
};
