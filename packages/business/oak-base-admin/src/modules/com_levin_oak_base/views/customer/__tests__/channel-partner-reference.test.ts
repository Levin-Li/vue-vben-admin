import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadChannelReferencePage } from '../channel-partner-reference';

const { post, authorizedOrganizationIds } = vi.hoisted(() => ({
  post: vi.fn(),
  authorizedOrganizationIds: vi.fn(),
}));
vi.mock('@levin/admin-framework', () => ({ requestClient: { post } }));
vi.mock('../../reference-candidate-options', () => ({
  authorizedOrganizationIds,
}));
vi.mock('../../api-module', () => ({ OAK_BASE_API_MODULE: '/module' }));

describe('目标租户渠道伙伴候选', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedOrganizationIds.mockResolvedValue(['b1', 'b2']);
    post.mockResolvedValue({
      items: [{ id: 'c1', name: '渠道一' }],
      totals: 51,
    });
  });
  it('使用完整授权组织和租户查询，按总数分页', async () => {
    const result = await loadChannelReferencePage('tenant-b', 1, 'c1');
    expect(result).toEqual({
      hasMore: true,
      options: [{ label: '渠道一', value: 'c1' }],
    });
    expect(post).toHaveBeenCalledWith(
      '/module/ChannelPartnerCandidates/list',
      { containsName: 'c1' },
      {
        baseURL: '',
        params: {
          targetTenantId: 'tenant-b',
          pageIndex: 1,
          pageSize: 50,
          requireTotals: true,
        },
        __globalUserOrgContext: { tenantId: 'tenant-b', orgIds: ['b1', 'b2'] },
      },
    );
  });
  it('回显按 ID 查找，无组织时不发送请求', async () => {
    await loadChannelReferencePage('tenant-b', 1, '', 'c1');
    expect(post.mock.calls[0]?.[1]).toEqual({ idList: ['c1'] });
    authorizedOrganizationIds.mockResolvedValue([]);
    post.mockClear();
    expect(await loadChannelReferencePage('tenant-b', 1)).toEqual({
      hasMore: false,
      options: [],
    });
    expect(post).not.toHaveBeenCalled();
  });
});
