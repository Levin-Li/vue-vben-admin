import type { CrudFieldConfig } from './types';
import type {
  UserOrgSelectorLoadUsers,
  UserOrgSelectorResolveRecords,
} from './user-org-selector-types';

import { fetchCrudList } from '../api';
import { rbacService } from '../app/api/rbac-service';
import { filterTenantOrganizations } from './crud-org-selector';

/** 默认按当前组织逐页读取启用的可访问用户。 */
export function getCrudUserLoadApi(
  field: CrudFieldConfig,
  apiModuleBase: string,
  tenantId?: string,
): UserOrgSelectorLoadUsers {
  const userLoadApi = field.userLoadApi;
  if (userLoadApi && !tenantId) return userLoadApi;
  if (userLoadApi && tenantId)
    return async (context) => {
      const users = await userLoadApi(context);
      return users.filter(
        (item) =>
          String(item.tenantId || '') === tenantId &&
          String(item.orgId || '') === context.orgId,
      );
    };
  return async ({ orgId }) => {
    const users: Record<string, any>[] = [];
    let pageIndex = 1;
    const seenIds = new Set<string>();
    for (;;) {
      const page = await fetchCrudList<Record<string, any>>(
        tenantId ? '/User/selectorCandidates' : '/User/list',
        {
          ...(tenantId ? { tenantId } : {}),
          orgId,
          loadOrg: true,
          enable: field.userEnable ?? true,
          pageIndex,
          pageSize: 500,
        },
        apiModuleBase,
        tenantId
          ? { globalUserOrgContext: { tenantId, orgIds: [orgId] } }
          : { globalUserOrgContext: { orgIds: [orgId] } },
      );
      if (page.items.length === 0) {
        if (seenIds.size < page.totals) throw new Error('用户列表未完整加载');
        return users;
      }
      if (page.totals <= 0) throw new Error('用户列表缺少有效总数');
      for (const user of page.items) {
        const id = String(user.id ?? '');
        if (!id || seenIds.has(id)) throw new Error('用户列表分页数据不完整');
        seenIds.add(id);
        users.push(user);
      }
      if (seenIds.size >= page.totals) return users;
      pageIndex++;
    }
  };
}

/** 搜索只使用公共授权接口；自定义候选必须自行提供安全搜索。 */
export function getCrudUserSearchApi(
  field: CrudFieldConfig,
  apiModuleBase: string,
  tenantId?: string,
) {
  if (field.userLoadApi) return undefined;
  return async ({ orgId, keyword }: { keyword: string; orgId: string }) => {
    const users: Record<string, any>[] = [];
    const seen = new Set<string>();
    let pageIndex = 1;
    for (;;) {
      const page = await fetchCrudList<Record<string, any>>(
        tenantId ? '/User/selectorCandidates' : '/User/list',
        {
          ...(tenantId ? { tenantId, keyword } : { containsName: keyword }),
          orgId,
          enable: field.userEnable ?? true,
          pageIndex,
          pageSize: 500,
        },
        apiModuleBase,
        tenantId
          ? { globalUserOrgContext: { tenantId, orgIds: [orgId] } }
          : { globalUserOrgContext: { orgIds: [orgId] } },
      );
      for (const user of page.items) {
        const id = String(user.id || '');
        if (!id || seen.has(id)) throw new Error('用户搜索分页数据不完整');
        seen.add(id);
        users.push(user);
      }
      if (users.length >= page.totals) return users;
      if (page.items.length === 0) throw new Error('用户搜索结果未完整加载');
      pageIndex++;
    }
  };
}

/** 读取已有 ID 的名称，特殊候选范围由页面提供对应解析器。 */
export function getCrudUserResolveRecords(
  field: CrudFieldConfig,
  apiModuleBase: string,
  tenantId?: string,
): undefined | UserOrgSelectorResolveRecords {
  const userResolveRecords = field.userResolveRecords;
  if (userResolveRecords && !tenantId) return userResolveRecords;
  if (field.userLoadApi && !userResolveRecords) return undefined;
  return async (ids) => {
    // 回显缺少单个组织，显式使用当前授权组织，避免服务端回退到默认组织。
    const tree = tenantId
      ? filterTenantOrganizations(
          await rbacService.fetchAuthorizedOrgTreeByTenant(tenantId),
          tenantId,
        )
      : await rbacService.fetchAuthorizedOrgTree({ assembleTree: true });
    let orgIds: string[] = [];
    const visit = (nodes: Record<string, any>[]) => {
      for (const node of nodes) {
        if (node.id) orgIds.push(String(node.id));
        visit(node.children || []);
      }
    };
    visit(tree);
    orgIds = [...new Set(orgIds)];
    if (orgIds.length === 0) return [];
    if (userResolveRecords && tenantId) {
      const records = await userResolveRecords(ids);
      const authorized = new Set(orgIds);
      const requested = new Set(ids);
      return records.filter(
        (item) =>
          requested.has(item.id) &&
          String(item.tenantId || item.raw?.tenantId || '') === tenantId &&
          authorized.has(String(item.orgId || item.raw?.orgId || '')),
      );
    }
    const items: Record<string, any>[] = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100);
      const page = await fetchCrudList<Record<string, any>>(
        tenantId ? '/User/selectorCandidates' : '/User/list',
        {
          ...(tenantId ? { tenantId } : {}),
          idList: batch,
          pageIndex: 1,
          pageSize: batch.length,
        },
        apiModuleBase,
        tenantId
          ? { globalUserOrgContext: { tenantId, orgIds } }
          : { globalUserOrgContext: { orgIds } },
      );
      items.push(...(page.items || []));
    }
    const allowedIds = new Set(ids);
    return items
      .filter((item) => allowedIds.has(String(item.id)))
      .map((item) => ({
        id: String(item.id),
        kind: 'user' as const,
        name: String(item.name || item.id),
        raw: item,
      }));
  };
}
