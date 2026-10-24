import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue';

import {
  currentGlobalDomainIds,
  globalDomainContextMultiple,
} from '@levin/admin-framework/framework-commons/app/global-domain-context-state';
import {
  currentGlobalOrgIds,
  currentGlobalOwnerIds,
  currentGlobalTenantId,
  globalOrgContextMultiple,
  isGlobalUserOrgContextEnabled,
} from '@levin/admin-framework/framework-commons/app/global-org-context-state';

import { roleService } from '../api/role-service';

/** 仅用于列表角标回显；接口不可访问时不推断用户的继承规则。 */
export async function loadRolePermissionRecords() {
  const records: Array<Record<string, any>> = [];
  const pageSize = 500;
  for (let pageIndex = 1; pageIndex <= 20; pageIndex++) {
    const response: any = await roleService.list({ pageIndex, pageSize });
    const items = response?.items || response?.records || response;
    if (!Array.isArray(items)) break;
    records.push(...items);
    if (items.length < pageSize) break;
  }
  return records;
}

/** 每个页面实例独享结果与在途请求；范围变化不让后台标签发起查询。 */
export function usePageRolePermissionRecords(actor: () => unknown) {
  const records = ref<Array<Record<string, any>>>([]);
  const cache = new Map<string, Promise<Array<Record<string, any>>>>();
  const pendingRequests = new Map<
    string,
    Promise<Array<Record<string, any>>>
  >();
  let active = false;
  let generation = 0;
  const scope = computed(() => {
    const enabled = isGlobalUserOrgContextEnabled();
    const header = (values: readonly unknown[], multiple: boolean) =>
      values.length > 0 ? (multiple ? values : values[0]) : null;
    return JSON.stringify([
      actor(),
      header(currentGlobalDomainIds.value, globalDomainContextMultiple.value),
      enabled ? currentGlobalTenantId.value || null : null,
      enabled
        ? header(currentGlobalOrgIds.value, globalOrgContextMultiple.value)
        : null,
      enabled
        ? header(currentGlobalOwnerIds.value, globalOrgContextMultiple.value)
        : null,
    ]);
  });

  // 缓存空结果和失败，避免每次重新激活重复尝试；显式保存后可强制刷新。
  async function refresh(force = false) {
    const key = scope.value;
    if (force) {
      generation++;
      cache.delete(key);
    }
    const requestGeneration = generation;
    let pending = cache.get(key);
    if (!pending) {
      pending = loadRolePermissionRecords().catch(() => []);
      cache.set(key, pending);
      pendingRequests.set(key, pending);
    }
    const result = await pending;
    if (pendingRequests.get(key) === pending) pendingRequests.delete(key);
    if (requestGeneration === generation && key === scope.value) {
      records.value = result;
    } else if (cache.get(key) === pending) {
      // 已跨范围的在途响应不再作为该范围的缓存，防止切回时误用。
      cache.delete(key);
    }
  }

  function activate() {
    active = true;
    void refresh();
  }
  onMounted(activate);
  onActivated(activate);
  onDeactivated(() => {
    active = false;
  });
  watch(
    scope,
    () => {
      generation++;
      for (const [key, pending] of pendingRequests) {
        if (cache.get(key) === pending) cache.delete(key);
      }
      pendingRequests.clear();
      records.value = [];
      if (active) void refresh();
    },
    { flush: 'sync' },
  );

  return { records, refresh };
}
