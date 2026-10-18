import { describe, expect, it, vi } from 'vitest';

import {
  loadIssuerRelationPage,
  loadIssuerSubjectPage,
} from '../issuer-partner-options';

const list = vi.fn();
vi.mock('../../api-module', () => ({
  moduleFetchCrudList: (...args: unknown[]) => list(...args),
}));

describe('发票销方两步选择', () => {
  it('先按主体名称和租户分页查询可访问的法律主体', async () => {
    list.mockResolvedValueOnce({
      items: [{ id: 'subject-1', subjectName: '甲公司' }],
    });

    expect(await loadIssuerSubjectPage(' 甲 ', 2, 'tenant-1')).toEqual({
      hasMore: false,
      options: [{ label: '甲公司', value: 'subject-1' }],
    });
    expect(list).toHaveBeenCalledWith('/LegalSubject/list', {
      containsSubjectName: '甲',
      pageIndex: 2,
      pageSize: 50,
      tenantId: 'tenant-1',
    });
  });

  it('再按主体、供应链类别和启用状态分页查询关系，并保留 Partner ID', async () => {
    list.mockResolvedValueOnce({
      items: [
        {
          id: 'partner-1',
          legalSubjectId: 'subject-1',
          displayName: '甲公司',
          orgId: 'org-1',
          type: 'Goods',
          enable: true,
        },
        {
          id: 'partner-2',
          legalSubjectId: 'subject-1',
          displayName: '甲公司',
          orgId: 'org-2',
          type: 'RawMaterials',
          enable: true,
        },
      ],
    });

    expect(await loadIssuerRelationPage('subject-1', 3, 'tenant-1')).toEqual({
      hasMore: false,
      options: [
        { label: '甲公司 · 组织 org-1 · Goods', value: 'partner-1' },
        { label: '甲公司 · 组织 org-2 · RawMaterials', value: 'partner-2' },
      ],
    });
    expect(list).toHaveBeenCalledWith('/SupplierPartner/list', {
      enable: true,
      legalSubjectId: 'subject-1',
      pageIndex: 3,
      pageSize: 50,
      tenantId: 'tenant-1',
    });
  });

  it('首批满 50 条时继续读取后续主体页', async () => {
    list.mockResolvedValueOnce({
      items: Array.from({ length: 50 }, (_, index) => ({
        id: `subject-${index}`,
        subjectName: `主体 ${index}`,
      })),
    });
    list.mockResolvedValueOnce({
      items: [{ id: 'subject-50', subjectName: '第 51 家主体' }],
    });

    const firstPage = await loadIssuerSubjectPage('', 1, 'tenant-1');
    const secondPage = await loadIssuerSubjectPage('', 2, 'tenant-1');

    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.options).toHaveLength(50);
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.options).toEqual([
      { label: '第 51 家主体', value: 'subject-50' },
    ]);
  });
});
