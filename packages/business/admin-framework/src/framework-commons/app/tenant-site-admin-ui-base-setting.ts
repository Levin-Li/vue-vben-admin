import { watch } from 'vue';

import { updatePreferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { onFrameworkEvent, type FrameworkEvent } from '../event-bus';
import type { ApiRequestEventPayload } from './api/request-events';
import {
  ADMIN_UI_BASE_SETTING_KEY,
  rbacService,
  type RbacApi,
} from './api/rbac-service';

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

let latestPreferServerSetting = false;
let stopUserRoleVisibilityWatcher: (() => void) | undefined;

function shouldShowPreferencesEntry(
  preferServerSetting: boolean,
  userInfo: Record<string, any>,
) {
  return userInfo.superAdmin === true || preferServerSetting !== true;
}

function syncPreferencesEntryVisibility() {
  const userInfo = (useUserStore().userInfo || {}) as Record<string, any>;

  updatePreferences({
    app: {
      enablePreferences: shouldShowPreferencesEntry(
        latestPreferServerSetting,
        userInfo,
      ),
    },
  });
}

function applyTenantSiteAdminUiBaseSetting(
  data: null | RbacApi.TenantSiteInfo | undefined,
) {
  const serverSetting = data?.uiExInfo?.[ADMIN_UI_BASE_SETTING_KEY];
  const setting = isRecord(serverSetting?.setting)
    ? serverSetting.setting
    : serverSetting;
  const preferServerSetting = !(
    isRecord(serverSetting) && serverSetting.preferServerSetting === false
  );

  if (!preferServerSetting) {
    latestPreferServerSetting = false;
    syncPreferencesEntryVisibility();
    return;
  }

  latestPreferServerSetting = true;

  if (isRecord(setting)) {
    updatePreferences(setting as any);
  }

  syncPreferencesEntryVisibility();
}

export function registerTenantSiteAdminUiBaseSettingListener() {
  const unsubscribe = onFrameworkEvent<
    ApiRequestEventPayload<RbacApi.TenantSiteInfo>
  >(
    'api.request',
    '*/rbac/tenantSiteInfo',
    (event: FrameworkEvent<ApiRequestEventPayload<RbacApi.TenantSiteInfo>>) => {
      if (event.data.error) {
        return;
      }

      applyTenantSiteAdminUiBaseSetting(event.data.data);
    },
    '应用租户站点后台界面设置',
  );

  stopUserRoleVisibilityWatcher?.();
  stopUserRoleVisibilityWatcher = watch(
    () =>
      (useUserStore().userInfo as Record<string, any> | undefined)?.superAdmin,
    () => {
      syncPreferencesEntryVisibility();
    },
  );

  return () => {
    unsubscribe();
    stopUserRoleVisibilityWatcher?.();
    stopUserRoleVisibilityWatcher = undefined;
  };
}

export async function loadTenantSiteAdminUiBaseSetting() {
  await rbacService.getTenantSiteInfo();
}
