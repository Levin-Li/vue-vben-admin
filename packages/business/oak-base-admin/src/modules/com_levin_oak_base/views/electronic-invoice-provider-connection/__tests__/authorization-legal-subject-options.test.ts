import { describe, expect, it, vi } from 'vitest';

import { electronicInvoiceProviderConnectionService } from '../../../api/electronic-invoice-provider-connection-service';
import { loadAuthorizationLegalSubjectPage } from '../authorization-legal-subject-options';

vi.mock('../../../api/electronic-invoice-provider-connection-service', () => ({
  electronicInvoiceProviderConnectionService: {
    availableLegalSubjects: vi.fn(),
  },
}));

describe('开票授权可选公司', () => {
  it('只调用授权专用接口并展示去重后的主体来源', async () => {
    vi.mocked(
      electronicInvoiceProviderConnectionService.availableLegalSubjects,
    ).mockResolvedValue({
      items: [
        {
          id: 'subject-1',
          sourceLabels: ['我的组织', '客户', '供应伙伴'],
          subjectName: '甲公司',
        },
        { id: 'subject-2', subjectName: '乙公司' },
      ],
      total: 2,
    });

    await expect(
      loadAuthorizationLegalSubjectPage(' 甲 ', 1, 'tenant-1'),
    ).resolves.toEqual({
      hasMore: false,
      options: [
        { label: '甲公司 · 我的组织、客户、供应伙伴', value: 'subject-1' },
        { label: '乙公司', value: 'subject-2' },
      ],
    });
    expect(
      electronicInvoiceProviderConnectionService.availableLegalSubjects,
    ).toHaveBeenCalledWith({
      keyword: '甲',
      pageIndex: 1,
      pageSize: 50,
      tenantId: 'tenant-1',
    });
  });

  it('优先使用接口返回的分页标识', async () => {
    vi.mocked(
      electronicInvoiceProviderConnectionService.availableLegalSubjects,
    ).mockResolvedValue({ data: { hasMore: true, items: [], total: 0 } });

    await expect(loadAuthorizationLegalSubjectPage('', 2)).resolves.toEqual({
      hasMore: true,
      options: [],
    });
  });
});
