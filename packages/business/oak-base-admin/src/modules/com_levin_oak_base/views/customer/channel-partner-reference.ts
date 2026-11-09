import { requestClient } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from '../api-module';
import { authorizedOrganizationIds } from '../reference-candidate-options';

const PAGE_SIZE = 50;
type Candidate = { id: string; name: string };

/** 目标租户的渠道候选只能使用完整的已授权组织范围。 */
export async function loadChannelReferencePage(
  tenantId: string,
  pageIndex: number,
  keyword = '',
  id?: string,
) {
  const orgIds = await authorizedOrganizationIds(tenantId);
  if (orgIds.length === 0) return { hasMore: false, options: [] };
  // ID 回显与交互搜索互斥，仅发送允许的候选字段。
  const query: { containsName?: string; idList?: string[] } = {};
  if (id) query.idList = [id];
  else if (keyword.trim()) query.containsName = keyword.trim();
  const response = await requestClient.post<{
    items: Candidate[];
    totals: number;
  }>(`${OAK_BASE_API_MODULE}/ChannelPartnerCandidates/list`, query, {
    baseURL: '',
    params: {
      targetTenantId: tenantId,
      pageIndex,
      pageSize: PAGE_SIZE,
      requireTotals: true,
    },
    __globalUserOrgContext: { tenantId, orgIds },
  });
  return {
    hasMore: pageIndex * PAGE_SIZE < response.totals,
    options: (response.items || []).map((item) => ({
      label: item.name || item.id,
      value: item.id,
    })),
  };
}
