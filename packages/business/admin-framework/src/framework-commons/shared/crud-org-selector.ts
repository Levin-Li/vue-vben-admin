import type { CrudFieldConfig } from './types';
import type { UserOrgSelectorLoadOrgTree } from './user-org-selector-types';

import { rbacService } from '../app/api/rbac-service';

/** 登录资料未暴露租户时，只从服务端授权组织树解析目标组织的租户。 */
export async function getAuthorizedOrgTenantId(orgId: string): Promise<string> {
  if (!orgId) throw new Error('请选择可访问的组织');
  const tree = await rbacService.fetchAuthorizedOrgTree({ assembleTree: true });
  const matches = new Set<string>();
  let missingTenant = false;
  const visited = new WeakSet<object>();
  const visit = (nodes: Record<string, any>[]) => {
    for (const node of nodes || []) {
      if (!node || typeof node !== 'object' || visited.has(node)) continue;
      visited.add(node);
      if (String(node.id || '') === orgId) {
        const tenant = String(node.tenantId || '').trim();
        if (tenant) matches.add(tenant); else missingTenant = true;
      }
      if (Array.isArray(node.children)) visit(node.children);
    }
  };
  visit(tree || []);
  if (missingTenant || matches.size !== 1) throw new Error('所选组织的授权租户不可确定');
  return [...matches][0]!;
}

// 严格使用服务端返回的租户归属，缺失归属的节点不可选。
export function filterTenantOrganizations(
  items: Record<string, any>[],
  tenantId: string,
): Record<string, any>[] {
  return items.flatMap((item) => {
    const children = filterTenantOrganizations(item.children || [], tenantId);
    if (String(item.tenantId || '') !== tenantId) return children;
    return [{ ...item, children }];
  });
}

/** 页面显式候选优先；缺省交由通用选择器读取当前授权组织。 */
export function getCrudOrgLoadApi(
  field: CrudFieldConfig,
  tenantId?: string,
): undefined | UserOrgSelectorLoadOrgTree {
  if (tenantId)
    return async () => {
      let data: Record<string, any>[];
      if (field.tenantLoadOptions)
        data = await field.tenantLoadOptions(tenantId, '');
      else if (field.loadOptions) data = await field.loadOptions('');
      else if (field.options) data = field.options;
      else data = await rbacService.fetchAuthorizedOrgTreeByTenant(tenantId);
      return filterTenantOrganizations(data, tenantId);
    };
  const loader = field.loadOptions;
  if (loader) return () => loader('');
  const options = field.options;
  if (options) return async () => options;
  return undefined;
}
