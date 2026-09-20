import { requestClient } from './request';

export const UI_SETTING_RETRIEVE_PATH = '/UiSetting/retrieve';

export interface UiSettingRuntimeRecord {
  code: string;
  createTime?: string;
  domain?: string;
  id?: string;
  lastUpdateTime?: string;
  optimisticLock?: number;
  orgCategory?: string;
  orgType?: string;
  tenantId?: string;
  type?: string;
  userCategory?: string;
  userType?: string;
  valueContent?: Record<string, any>;
}

export interface UiSettingRuntimeResolution {
  scope: { domain?: string; tenantId?: string };
  setting: null | UiSettingRuntimeRecord;
}

interface UiSettingCacheEntry {
  etag?: string;
  lastModified?: string;
  scope: UiSettingRuntimeResolution['scope'];
  setting: null | UiSettingRuntimeRecord;
}

const uiSettingCache = new Map<string, UiSettingCacheEntry>();

function buildCacheKey(code: string, contextKey: string) {
  return `${contextKey}:${code}`;
}

export function clearUiSettingRuntimeCache() {
  uiSettingCache.clear();
}

export function replaceUiSettingRuntimeCache(
  code: string,
  contextKey: string,
  setting: null | UiSettingRuntimeRecord,
  headers?: Record<string, any>,
) {
  uiSettingCache.set(buildCacheKey(code, contextKey), {
    etag: headers?.etag,
    lastModified: headers?.['last-modified'],
    scope: {},
    setting,
  });
}

function getHeader(headers: Record<string, any> | undefined, name: string) {
  return (
    headers?.[name] ||
    headers?.[name.toLowerCase()] ||
    headers?.[name.toUpperCase()]
  );
}

export async function resolveUiSettingRuntimeWithScope(
  code: string,
  contextKey: string,
  options: { refresh?: boolean } = {},
): Promise<UiSettingRuntimeResolution> {
  const cacheKey = buildCacheKey(code, contextKey);
  const cached = uiSettingCache.get(cacheKey);

  // 全局选择器重载时重新向服务端确认，不能由旧缓存恢复已关闭的功能。
  if (cached && !options.refresh)
    return { scope: cached.scope, setting: cached.setting };

  const response: any = await requestClient.get('/UiSetting/use/resolve', {
    // 手动刷新使用唯一查询参数绕过浏览器的 ETag 304 空响应，确保拿到服务端实体。
    params: {
      code,
      refresh: options.refresh ? Date.now() : undefined,
    },
    responseReturn: 'raw',
    validateStatus: (status: number) => status === 200 || status === 304,
  });

  const payload = response.data;
  // ApiResp 的 data 为 null 时不能回退为整个响应壳，否则调用方会误认为已命中设置。
  const setting =
    payload && typeof payload === 'object' && 'data' in payload
      ? (payload.data ?? null)
      : (payload ?? null);
  const scope = {
    domain: getHeader(response.headers, 'x-ui-setting-domain') || undefined,
    tenantId:
      getHeader(response.headers, 'x-ui-setting-tenant-id') || undefined,
  };
  uiSettingCache.set(cacheKey, {
    etag: getHeader(response.headers, 'etag'),
    lastModified: getHeader(response.headers, 'last-modified'),
    scope,
    setting,
  });
  return { scope, setting };
}

export async function resolveUiSettingRuntime(
  code: string,
  contextKey: string,
  options: { refresh?: boolean } = {},
): Promise<null | UiSettingRuntimeRecord> {
  const resolution = await resolveUiSettingRuntimeWithScope(
    code,
    contextKey,
    options,
  );
  return resolution.setting;
}
