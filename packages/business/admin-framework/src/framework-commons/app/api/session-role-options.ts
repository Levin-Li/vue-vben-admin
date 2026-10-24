import type { SelectOption } from '../../api';

import { fetchOptions } from '../../api';
import {
  currentGlobalDomainIds,
  globalDomainContextMultiple,
  onGlobalDomainContextChange,
} from '../global-domain-context-state';
import {
  currentGlobalOrgIds,
  currentGlobalOwnerIds,
  currentGlobalTenantId,
  globalOrgContextMultiple,
  isGlobalUserOrgContextEnabled,
  onGlobalUserOrgContextChange,
} from '../global-org-context-state';
import { registerAdminSessionInitializer } from '../session-resources';

// 按页面和实际查询条件合并角色请求，保留远程关键词搜索和空结果。
const pageOptions = new Map<string, Promise<SelectOption[]>>();
let generation = 0;

// 与 HTTP 注入规则一致：领域始终生效，租户、组织和个人范围只在开关启用时生效。
function contextKey() {
  const enabled = isGlobalUserOrgContextEnabled();
  const header = (values: readonly unknown[], multiple: boolean) =>
    values.length > 0 ? [multiple, multiple ? values : values[0]] : null;
  return JSON.stringify([
    enabled ? currentGlobalTenantId.value || null : null,
    header(currentGlobalDomainIds.value, globalDomainContextMultiple.value),
    enabled
      ? header(currentGlobalOrgIds.value, globalOrgContextMultiple.value)
      : null,
    enabled
      ? header(currentGlobalOwnerIds.value, globalOrgContextMultiple.value)
      : null,
  ]);
}

// 范围变化只撤销在途结果，不触发请求；已完成的各范围缓存仍可安全复用。
let context = contextKey();
let contextGeneration = 0;
function syncContext() {
  const current = contextKey();
  if (current !== context) {
    context = current;
    contextGeneration++;
  }
  return current;
}
onGlobalDomainContextChange(syncContext);
onGlobalUserOrgContextChange(syncContext);

registerAdminSessionInitializer('role-options', {
  // 角色不在登录时预取；此登记只负责退出和换号时撤销页面缓存。
  load: () => Promise.resolve(),
  clear: () => {
    ++generation;
    pageOptions.clear();
  },
});

export async function getSessionRoleOptions(
  keyword?: string,
  pageKey = typeof window === 'undefined' ? '/' : window.location.pathname,
  moduleBase = '/com.levin.oak.base/V1/api',
) {
  const request = generation;
  const scope = syncContext();
  const scopeGeneration = contextGeneration;
  const search = String(keyword || '').trim();
  const params = {
    codeForKey: false,
    pageIndex: 1,
    pageSize: 500,
    ...(search ? { containsName: search } : {}),
  };
  const normalizedModuleBase = moduleBase.trim().replace(/\/$/, '');
  const cacheKey = JSON.stringify([
    pageKey,
    normalizedModuleBase,
    params,
    scope,
  ]);
  let pending = pageOptions.get(cacheKey);
  if (!pending) {
    pending = Promise.resolve()
      .then(() => {
        syncContext();
        if (request !== generation || scopeGeneration !== contextGeneration) {
          if (pageOptions.get(cacheKey) === pending)
            pageOptions.delete(cacheKey);
          return [];
        }
        return fetchOptions(
          '/Role/listUserRoleCode',
          'label',
          'value',
          params,
          normalizedModuleBase,
        );
      })
      .then(
        (options) => {
          syncContext();
          if (request === generation && scopeGeneration === contextGeneration)
            return options;
          // HTTP 安全拦截器是异步的，切换中发出的请求不能归入旧范围缓存。
          if (pageOptions.get(cacheKey) === pending)
            pageOptions.delete(cacheKey);
          return [];
        },
        // 可选目录失败保留空结果，不由同页多个选择器重复重试。
        () => {
          syncContext();
          if (
            (request !== generation || scopeGeneration !== contextGeneration) &&
            pageOptions.get(cacheKey) === pending
          )
            pageOptions.delete(cacheKey);
          return [];
        },
      );
    pageOptions.set(cacheKey, pending);
  }
  const options = await pending;
  syncContext();
  if (request !== generation || scopeGeneration !== contextGeneration)
    return [];
  return options.map((item) => ({ ...item }));
}
