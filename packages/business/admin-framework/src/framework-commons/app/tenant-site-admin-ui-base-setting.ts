import { onFrameworkEvent, type FrameworkEvent } from '../event-bus';
import type { ApiRequestEventPayload } from './api/request-events';
import { rbacService, type RbacApi } from './api/rbac-service';

let latestTenantSiteInfo: null | RbacApi.TenantSiteInfo | undefined;

export function getCurrentTenantSiteInfo() {
  return latestTenantSiteInfo;
}

export function registerTenantSiteAdminUiBaseSettingListener() {
  return onFrameworkEvent<ApiRequestEventPayload<RbacApi.TenantSiteInfo>>(
    'api.request',
    '*/rbac/tenantSiteInfo',
    (event: FrameworkEvent<ApiRequestEventPayload<RbacApi.TenantSiteInfo>>) => {
      // 租户站点信息仅供页面上下文使用，不再承载或应用界面偏好设置。
      if (!event.data.error) latestTenantSiteInfo = event.data.data;
    },
    '缓存当前租户站点上下文',
  );
}

export async function loadTenantSiteAdminUiBaseSetting() {
  await rbacService.getTenantSiteInfo();
}
