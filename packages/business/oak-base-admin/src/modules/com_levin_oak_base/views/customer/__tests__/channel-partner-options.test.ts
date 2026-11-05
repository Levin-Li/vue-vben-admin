import { describe, expect, it, vi } from 'vitest';

import { loadChannelPartnerPage } from '../channel-partner-options';

const list = vi.fn();
vi.mock('../../api-module', () => ({
  moduleFetchCrudList: (...args: unknown[]) => list(...args),
}));

describe('渠道客户选择渠道伙伴', () => {
  it('仅查询可访问的启用渠道关系，且提交值为 Partner ID', async () => {
    list.mockResolvedValueOnce({
      items: [
        {
          id: 'channel-1',
          tenantId: 'tenant-1',
          enable: true,
          displayName: '甲公司',
          subjectOrgId: 'org-1',
          type: 'Dealer',
        },
        { id: 'channel-2', category: 'Channel', enable: false },
        { id: 'other', tenantId: 'tenant-2', enable: true },
        { id: 'missing-tenant', enable: true },
      ],
    });

    expect(await loadChannelPartnerPage(2, 'tenant-1', ' channel-1 ')).toEqual({
      hasMore: false,
      options: [
        { label: '甲公司 · 组织 org-1 · Dealer', value: 'channel-1' },
        {
          label: '渠道伙伴 missing-tenant · 组织 未配置 · 渠道',
          value: 'missing-tenant',
        },
      ],
    });
    expect(list).toHaveBeenCalledWith('/ChannelPartner/list', {
      enable: true,
      containsDisplayName: 'channel-1',
      pageIndex: 2,
      pageSize: 50,
      tenantId: 'tenant-1',
    });
  });
});
