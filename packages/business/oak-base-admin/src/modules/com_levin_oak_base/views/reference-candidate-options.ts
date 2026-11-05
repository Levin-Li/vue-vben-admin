import { requestClient } from '@levin/admin-framework';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';

import { OAK_BASE_API_MODULE } from './api-module';

type Candidate = { id: string; name: string };
type OrgNode = { children?: OrgNode[]; id?: string; tenantId?: string };

// 使用服务端授权树收集目标租户的完整组织；任何缺失归属或不合法 ID 都终止请求。
export async function authorizedOrganizationIds(
  tenantId: string,
): Promise<string[]> {
  const tree = (await rbacService.fetchAuthorizedOrgTreeByTenant(
    tenantId,
  )) as OrgNode[];
  const ids = new Set<string>();
  const visit = (nodes: OrgNode[]) => {
    for (const node of nodes) {
      const id = String(node.id || '').trim();
      if (!id || id.includes(',') || node.tenantId !== tenantId)
        throw new Error('授权组织数据不完整，请刷新重试');
      ids.add(id);
      visit(node.children || []);
    }
  };
  if (!Array.isArray(tree)) throw new Error('授权组织数据无效');
  visit(tree);
  return [...ids];
}

/** 候选只使用已授权组织全集；服务端再次验证列表完整性和业务权限。 */
export async function loadReferenceCandidates(
  type: 'legalSubjects' | 'partners',
  tenantId: string,
  keyword = '',
  pageIndex = 1,
  id?: string,
) {
  const orgIds = await authorizedOrganizationIds(tenantId);
  if (orgIds.length === 0) return { items: [] as Candidate[], totals: 0 };
  const query = {
    ...(id ? { idList: [id] } : {}),
    ...(!id && keyword.trim() ? { keyword: keyword.trim() } : {}),
  };
  return requestClient.post<{ items: Candidate[]; totals: number }>(
    `${OAK_BASE_API_MODULE}/ReferenceCandidates/${type}`,
    query,
    {
      baseURL: '',
      params: {
        targetTenantId: tenantId,
        pageIndex,
        pageSize: 50,
        requireTotals: true,
      },
      __globalUserOrgContext: { tenantId, orgIds },
    },
  );
}
