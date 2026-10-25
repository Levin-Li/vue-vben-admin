import { computed } from 'vue';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import {
  currentGlobalDomainIds,
  globalDomainContextRevision,
} from '@levin/admin-framework/framework-commons/app/global-domain-context-state';
import {
  currentGlobalOrgIds,
  currentGlobalOwnerIds,
  currentGlobalTenantId,
  globalOrgContextRevision,
} from '@levin/admin-framework/framework-commons/app/global-org-context-state';

// 仅缓存当前主体的授权元数据，不缓存记录数据；失效会阻止在途旧响应重新入库。
export function createModelMetadataCache(
  ttl = 20_000,
  now = () => Date.now(),
  capacity = 256,
) {
  let generation = 0;
  let currentContext = '';
  const values = new Map<string, { expires: number; value: unknown }>();
  const pending = new Map<string, Promise<unknown>>();
  function invalidate() {
    generation++;
    values.clear();
    pending.clear();
  }
  async function read<T>(
    context: string,
    key: string,
    loader: () => Promise<T>,
    force = false,
  ): Promise<T> {
    if (context !== currentContext) {
      invalidate();
      currentContext = context;
    }
    if (force) invalidate();
    const hit = values.get(key);
    if (hit && hit.expires > now()) return structuredClone(hit.value) as T;
    const inflight = pending.get(key);
    if (inflight) {
      const version = generation;
      const value = await inflight;
      if (version !== generation || context !== currentContext)
        throw new Error('模型上下文已变化，请重新加载');
      return structuredClone(value) as T;
    }
    const version = generation;
    const request = loader();
    pending.set(key, request);
    try {
      const value = await request;
      if (version !== generation || context !== currentContext)
        throw new Error('模型上下文已变化，请重新加载');
      // 限制每个上下文的驻留项，清理过期项后淘汰最早写入项。
      const timestamp = now();
      for (const [entryKey, entry] of values)
        if (entry.expires <= timestamp) values.delete(entryKey);
      values.delete(key);
      while (values.size >= Math.max(1, capacity)) {
        const oldest = values.keys().next().value;
        if (oldest === undefined) break;
        values.delete(oldest);
      }
      values.set(key, {
        expires: timestamp + ttl,
        value: structuredClone(value),
      });
      return structuredClone(value);
    } finally {
      if (pending.get(key) === request) pending.delete(key);
    }
  }
  return { read, invalidate };
}

export const modelMetadataCache = createModelMetadataCache();
export const invalidateDataModelMetadata = () =>
  modelMetadataCache.invalidate();

// 权限与角色都是集合；规范化排序只去除重排噪声，角色对象的范围事实仍完整保留。
function canonicalRole(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalRole(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalRole(item)]),
    );
  return value;
}
function stableIdentitySet(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item) => item !== null && item !== undefined)
        .map((item) =>
          typeof item === 'string'
            ? `string:${item.trim()}`
            : `object:${JSON.stringify(canonicalRole(item))}`,
        ),
    ),
  ].toSorted();
}

// 登录、授权代际和可信全局上下文共同隔离目录投影，切换后立即停止消费旧目录。
export function useModelMetadataContext() {
  const access = useAccessStore();
  const user = useUserStore();
  return computed(() =>
    JSON.stringify([
      Boolean(access.accessToken),
      access.isAccessChecked,
      stableIdentitySet(access.accessCodes),
      user.userInfo?.id,
      user.userInfo?.tenantId,
      user.userInfo?.orgId,
      stableIdentitySet([
        ...(Array.isArray(user.userInfo?.roleList)
          ? user.userInfo.roleList
          : []),
        ...(Array.isArray(user.userInfo?.roles) ? user.userInfo.roles : []),
      ]),
      currentGlobalDomainIds.value,
      globalDomainContextRevision.value,
      currentGlobalTenantId.value,
      currentGlobalOrgIds.value,
      currentGlobalOwnerIds.value,
      globalOrgContextRevision.value,
    ]),
  );
}
