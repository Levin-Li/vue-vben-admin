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
let latestTenantSiteInfo: null | RbacApi.TenantSiteInfo | undefined;
let stopUserRoleVisibilityWatcher: (() => void) | undefined;

export interface AdminUiBaseSettingPayload {
  preferServerSetting: boolean;
  setting: Record<string, any>;
  uploadTarget: AdminUiBaseSettingUploadTarget;
}

export type AdminUiBaseSettingUploadTarget =
  | 'Platform'
  | 'Tenant'
  | 'TenantSite';

export const DEFAULT_ADMIN_UI_BASE_SETTING_UPLOAD_TARGET: AdminUiBaseSettingUploadTarget =
  'TenantSite';

function stripAdminUiBaseSettingArtifacts(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripAdminUiBaseSettingArtifacts(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          key !== ADMIN_UI_BASE_SETTING_KEY &&
          key !== 'preferServerSetting' &&
          key !== 'uploadTarget',
      )
      .map(([key, item]) => [key, stripAdminUiBaseSettingArtifacts(item)]),
  );
}

function shouldShowPreferencesEntry(
  preferServerSetting: boolean,
  userInfo: Record<string, any>,
) {
  return userInfo.superAdmin === true || preferServerSetting !== true;
}

export function buildAdminUiBaseSettingPayload(
  setting: Record<string, any>,
  preferServerSetting: boolean,
  uploadTarget: AdminUiBaseSettingUploadTarget = DEFAULT_ADMIN_UI_BASE_SETTING_UPLOAD_TARGET,
): AdminUiBaseSettingPayload {
  return {
    preferServerSetting,
    setting: stripAdminUiBaseSettingArtifacts(setting) as Record<string, any>,
    uploadTarget,
  };
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
  latestTenantSiteInfo = data;
  const serverSetting = data?.uiExInfo?.[ADMIN_UI_BASE_SETTING_KEY];
  const preferServerSetting = !(
    isRecord(serverSetting) && serverSetting.preferServerSetting === false
  );
  const setting = isRecord(serverSetting?.setting)
    ? (stripAdminUiBaseSettingArtifacts(serverSetting.setting) as Record<
        string,
        any
      >)
    : undefined;

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

export function getCurrentTenantSiteInfo() {
  return latestTenantSiteInfo;
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
