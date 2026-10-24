import type { Pinia } from 'pinia';

import { effectScope, watch } from 'vue';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';
import { cloneDeep } from '@vben/runtime/utils';

import { getActivePinia } from 'pinia';

import { collectUserRoleIdentityValues } from '../../shared/user-identity';
import {
  currentGlobalDomainIds,
  globalDomainContextMultiple,
} from '../global-domain-context-state';
import {
  currentGlobalOrgIds,
  currentGlobalOwnerIds,
  currentGlobalTenantId,
  globalOrgContextMultiple,
  isGlobalUserOrgContextEnabled,
} from '../global-org-context-state';
import { requestClient } from './request';

export const UI_SETTING_RETRIEVE_PATH = '/UiSetting/retrieve';

export interface UiSettingRuntimeRecord {
  code: string;
  createTime?: string;
  domain?: string;
  id?: string;
  lastUpdateTime?: string;
  name?: string;
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
  expiresAt: number;
  lastModified?: string;
  pending?: Promise<UiSettingRuntimeResolution>;
  value?: UiSettingRuntimeResolution;
}

// 设置结果与在途请求共享容量上限，失效后的响应不能重新插回缓存。
const CACHE_TTL = 20_000;
const CACHE_CAPACITY = 256;
const uiSettingCache = new Map<string, UiSettingCacheEntry>();
const piniaIdentities = new WeakMap<Pinia, number>();
let nextPiniaIdentity = 0;
let generation = 0;
let observedIdentity = '';
let watchedPinia: null | Pinia | undefined;
let stopIdentityWatch: (() => void) | undefined;

function identityFor(pinia: Pinia | undefined) {
  const scope = [
    typeof location === 'undefined' ? '' : location.origin,
    currentGlobalDomainIds.value,
    globalDomainContextMultiple.value,
    isGlobalUserOrgContextEnabled(),
    isGlobalUserOrgContextEnabled() ? currentGlobalTenantId.value : undefined,
    isGlobalUserOrgContextEnabled() ? currentGlobalOrgIds.value : [],
    isGlobalUserOrgContextEnabled() ? currentGlobalOwnerIds.value : [],
    globalOrgContextMultiple.value,
  ];
  if (!pinia) return JSON.stringify(['anonymous-without-store', scope]);
  if (!piniaIdentities.has(pinia))
    piniaIdentities.set(pinia, ++nextPiniaIdentity);
  const userStore = useUserStore(pinia);
  const access = useAccessStore(pinia);
  const user: Record<string, any> = userStore.userInfo || {};
  return JSON.stringify([
    piniaIdentities.get(pinia),
    Boolean(access.accessToken),
    access.loginExpired === true,
    [user.id, user.userId, user.loginName, user.username],
    [...new Set(access.accessCodes || [])].toSorted(),
    [
      ...new Set([
        ...(userStore.userRoles || []),
        ...collectUserRoleIdentityValues(user),
      ]),
    ].toSorted(),
    [
      'admin',
      'superAdmin',
      'isSuperAdmin',
      'platformUser',
      'isPlatformUser',
      'tenantAdmin',
      'isTenantAdmin',
      'topSuperAdmin',
      'isTopSuperAdmin',
      'tsa',
    ].map((key) => user[key]),
    [
      'domainId',
      'domain',
      'tenantId',
      'orgId',
      'currentOrgId',
      'ownerId',
      'userType',
      'userCategory',
      'orgType',
      'orgCategory',
    ].map((key) => user[key]),
    [
      user.tenant?.id,
      user.tenantInfo?.id,
      user.currentTenant?.id,
      user.org?.id,
      user.orgInfo?.id,
      user.currentOrg?.id,
    ],
    scope,
  ]);
}

function invalidateAll() {
  generation++;
  uiSettingCache.clear();
}

function currentIdentity() {
  const pinia = getActivePinia();
  const identity = identityFor(pinia);
  if (identity !== observedIdentity) {
    invalidateAll();
    observedIdentity = identity;
  }
  if (watchedPinia !== (pinia || null)) {
    stopIdentityWatch?.();
    watchedPinia = pinia || null;
    // 同步观察登录/角色变化，连 A→B→A 的短暂切换也废弃旧请求；token续期不改变签名。
    // 缓存属于模块；观察器不能随首次调用它的页面卸载而停止。
    const scope = effectScope(true);
    scope.run(() =>
      watch(
        () => identityFor(pinia),
        (next) => {
          if (next !== observedIdentity) {
            invalidateAll();
            observedIdentity = next;
          }
        },
        { flush: 'sync' },
      ),
    );
    stopIdentityWatch = () => scope.stop();
  }
  return identity;
}

function buildCacheKey(code: string, contextKey: string, identity: string) {
  return JSON.stringify([identity, contextKey, code]);
}

function remember(key: string, entry: UiSettingCacheEntry) {
  uiSettingCache.delete(key);
  uiSettingCache.set(key, entry);
  while (uiSettingCache.size > CACHE_CAPACITY) {
    const oldest = uiSettingCache.keys().next().value;
    if (oldest === undefined) break;
    uiSettingCache.delete(oldest);
  }
}

export function clearUiSettingRuntimeCache() {
  invalidateAll();
}

export function replaceUiSettingRuntimeCache(
  code: string,
  contextKey: string,
  setting: null | UiSettingRuntimeRecord,
  headers?: Record<string, any>,
) {
  remember(buildCacheKey(code, contextKey, currentIdentity()), {
    expiresAt: Date.now() + CACHE_TTL,
    etag: getHeader(headers, 'etag'),
    lastModified: getHeader(headers, 'last-modified'),
    value: cloneDeep({ scope: {}, setting }),
  });
}

function getHeader(headers: Record<string, any> | undefined, name: string) {
  return (
    headers?.[name] ||
    headers?.[name.toLowerCase()] ||
    headers?.[name.toUpperCase()]
  );
}

/** 空对象、空列表和非记录响应都表示当前上下文没有匹配的设置。 */
function normalizeUiSettingRuntimeRecord(
  value: unknown,
): null | UiSettingRuntimeRecord {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  return Object.keys(value).length > 0
    ? (value as UiSettingRuntimeRecord)
    : null;
}

export async function resolveUiSettingRuntimeWithScope(
  code: string,
  contextKey: string,
  options: { refresh?: boolean } = {},
): Promise<UiSettingRuntimeResolution> {
  const identity = currentIdentity();
  const cacheKey = buildCacheKey(code, contextKey, identity);
  const cached = uiSettingCache.get(cacheKey);
  if (cached && !options.refresh) {
    if (cached.pending) {
      remember(cacheKey, cached);
      return cloneDeep(await cached.pending);
    }
    if (cached.value && cached.expiresAt > Date.now()) {
      remember(cacheKey, cached);
      return cloneDeep(cached.value);
    }
  }

  const epoch = generation;
  const entry: UiSettingCacheEntry = { expiresAt: 0 };
  remember(cacheKey, entry);
  const pending = (async () => {
    const response: any = await requestClient.get('/UiSetting/use/resolve', {
      // 手动刷新继续绕过浏览器的 ETag 304 空响应，且只废弃当前设置的旧请求。
      params: { code, refresh: options.refresh ? Date.now() : undefined },
      responseReturn: 'raw',
      validateStatus: (status: number) => status === 200 || status === 304,
    });
    const payload = response.data;
    // ApiResp 的空 data 不能回退到响应壳，避免误判为命中设置。
    const settingPayload =
      payload && typeof payload === 'object' && 'data' in payload
        ? payload.data
        : payload;
    const value = cloneDeep({
      scope: {
        domain: getHeader(response.headers, 'x-ui-setting-domain') || undefined,
        tenantId:
          getHeader(response.headers, 'x-ui-setting-tenant-id') || undefined,
      },
      setting: normalizeUiSettingRuntimeRecord(settingPayload),
    });
    if (
      currentIdentity() !== identity ||
      generation !== epoch ||
      uiSettingCache.get(cacheKey) !== entry
    )
      throw new Error('展示设置上下文已变化，请重新加载');
    entry.etag = getHeader(response.headers, 'etag');
    entry.lastModified = getHeader(response.headers, 'last-modified');
    entry.value = value;
    entry.expiresAt = Date.now() + CACHE_TTL;
    entry.pending = undefined;
    return value;
  })();
  entry.pending = pending;
  try {
    return cloneDeep(await pending);
  } catch (error) {
    if (uiSettingCache.get(cacheKey) === entry) uiSettingCache.delete(cacheKey);
    throw error;
  }
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
