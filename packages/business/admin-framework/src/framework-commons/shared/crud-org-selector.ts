import type { CrudFieldConfig } from './types';
import type { UserOrgSelectorLoadOrgTree } from './user-org-selector-types';

import { rbacService } from '../app/api/rbac-service';

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
