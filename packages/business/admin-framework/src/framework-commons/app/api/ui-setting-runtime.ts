import { requestClient } from './request';

export interface UiSettingRuntimeRecord {
  code: string;
  createTime?: string;
  id?: string;
  lastUpdateTime?: string;
  orgCategory?: string;
  orgType?: string;
  optimisticLock?: number;
  tenantId?: string;
  type?: string;
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
  setting: null | UiSettingRuntimeRecord;
  scope: UiSettingRuntimeResolution['scope'];
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
): Promise<UiSettingRuntimeResolution> {
  const cacheKey = buildCacheKey(code, contextKey);
  const cached = uiSettingCache.get(cacheKey);

  if (cached) return { scope: cached.scope, setting: cached.setting };

  const response: any = await requestClient.get('/UiSetting/use/resolve', {
    params: { code },
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
): Promise<null | UiSettingRuntimeRecord> {
  return (await resolveUiSettingRuntimeWithScope(code, contextKey)).setting;
}
