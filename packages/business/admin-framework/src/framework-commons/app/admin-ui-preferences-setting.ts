import { updatePreferences } from '@vben/preferences';

import { fetchDictOptions, fetchEnumOptions, fetchOptions } from '../api';
import {
  type UiSettingRuntimeRecord,
  resolveUiSettingRuntimeWithScope,
} from './api/ui-setting-runtime';
import { saveUiSettingWithCandidates } from './api/ui-setting-candidate-save';

const ADMIN_UI_PREFERENCES_CONTEXT = 'admin-ui-preferences';
const OAK_BASE_API_MODULE = '/com.levin.oak.base/V1/api';
export const ADMIN_UI_PREFERENCES_SETTING_CODE = '界面偏好设置';

export interface AdminUiPreferencesScope {
  domain?: string;
  orgCategory?: string;
  orgType?: string;
  tenantId?: string;
  userCategory?: string;
  userType?: string;
}

export interface AdminUiPreferencesScopeOptions {
  orgCategories: Array<{ label: string; value: string }>;
  orgTypes: Array<{ label: string; value: string }>;
  sites: Array<{ label: string; value: string }>;
  tenants: Array<{ label: string; value: string }>;
  userCategories: Array<{ label: string; value: string }>;
  userTypes: Array<{ label: string; value: string }>;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptions(options: any[]) {
  return options
    .map((option) => ({
      label: String(option.label ?? option.name ?? option.value ?? ''),
      value: String(option.value ?? option.id ?? option.name ?? ''),
    }))
    .filter((option) => option.value);
}

function normalizeScope(scope: AdminUiPreferencesScope) {
  return {
    domain: scope.domain || undefined,
    orgCategory: scope.orgCategory || undefined,
    orgType: scope.orgType || undefined,
    tenantId: scope.tenantId || undefined,
    userCategory: scope.userCategory || undefined,
    userType: scope.userType || undefined,
  };
}

export async function loadAdminUiPreferencesScopeOptions(
  tenantId?: string,
): Promise<AdminUiPreferencesScopeOptions> {
  const [tenants, sites, userTypes, userCategories, orgCategories, orgTypes] =
    await Promise.all([
      fetchOptions(
        '/Tenant/list',
        'name',
        'id',
        { pageIndex: 1, pageSize: 500 },
        OAK_BASE_API_MODULE,
      ),
      tenantId
        ? fetchOptions(
            '/TenantSite/list',
            'domain',
            'domain',
            { enable: true, pageIndex: 1, pageSize: 500, tenantId },
            OAK_BASE_API_MODULE,
          )
        : Promise.resolve([]),
      fetchDictOptions(
        'com.levin.oak.base.entities.User.type',
        OAK_BASE_API_MODULE,
      ),
      fetchEnumOptions(
        'com.levin.oak.base.entities.User$Category',
        OAK_BASE_API_MODULE,
      ),
      fetchDictOptions(
        'com.levin.oak.base.entities.Org.category',
        OAK_BASE_API_MODULE,
      ),
      fetchEnumOptions(
        'com.levin.oak.base.entities.Org$Type',
        OAK_BASE_API_MODULE,
      ),
    ]);
  return {
    orgCategories: normalizeOptions(orgCategories || []),
    orgTypes: normalizeOptions(orgTypes || []),
    sites: normalizeOptions(sites || []),
    tenants: normalizeOptions(tenants || []),
    userCategories: normalizeOptions(userCategories || []),
    userTypes: normalizeOptions(userTypes || []),
  };
}

export async function loadAdminUiPreferencesSetting() {
  const resolution = await resolveUiSettingRuntimeWithScope(
    ADMIN_UI_PREFERENCES_SETTING_CODE,
    ADMIN_UI_PREFERENCES_CONTEXT,
    { refresh: true },
  );
  const preferences = resolution.setting?.valueContent?.preferences;
  // 仅应用独立界面偏好记录，未命中或格式无效时保留当前本地默认值。
  if (isRecord(preferences)) updatePreferences(preferences as any);
  return resolution;
}

export async function saveAdminUiPreferencesSetting(
  preferences: Record<string, any>,
  scope: AdminUiPreferencesScope,
  selectCandidate?: (
    candidates: UiSettingRuntimeRecord[],
    total: number,
  ) => Promise<UiSettingRuntimeRecord | undefined>,
) {
  const normalizedScope = normalizeScope(scope);
  const data = {
    ...normalizedScope,
    code: ADMIN_UI_PREFERENCES_SETTING_CODE,
    name: ADMIN_UI_PREFERENCES_SETTING_CODE,
    type: 'Preferences',
    valueContent: { preferences },
  };
  return saveUiSettingWithCandidates(data, selectCandidate);
}
