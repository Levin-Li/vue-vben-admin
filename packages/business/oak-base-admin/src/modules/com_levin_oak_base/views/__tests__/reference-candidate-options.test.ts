import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadReferenceCandidates } from '../reference-candidate-options';

const mocks = vi.hoisted(() => ({ tree: vi.fn(), post: vi.fn() }));
vi.mock('@levin/admin-framework', () => ({
  requestClient: { post: mocks.post },
}));
vi.mock(
  '@levin/admin-framework/framework-commons/app/api/rbac-service',
  () => ({
    rbacService: { fetchAuthorizedOrgTreeByTenant: mocks.tree },
  }),
);
vi.mock('../api-module', () => ({
  OAK_BASE_API_MODULE: '/com.levin.oak.base/V1/api',
}));

describe('业务引用候选', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({
      items: [{ id: 'subject', name: '主体' }],
      totals: 1,
    });
  });

  it('按目标租户发送完整已授权组织与关键词', async () => {
    mocks.tree.mockResolvedValue([
      {
        id: 'org-b1',
        tenantId: 'tenant-b',
        children: [{ id: 'org-b2', tenantId: 'tenant-b' }],
      },
    ]);
    const page = await loadReferenceCandidates(
      'legalSubjects',
      'tenant-b',
      '甲',
    );
    expect(page.items[0]?.name).toBe('主体');
    expect(mocks.post).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/ReferenceCandidates/legalSubjects',
      { keyword: '甲' },
      expect.objectContaining({
        __globalUserOrgContext: {
          tenantId: 'tenant-b',
          orgIds: ['org-b1', 'org-b2'],
        },
        params: expect.objectContaining({
          targetTenantId: 'tenant-b',
          requireTotals: true,
        }),
      }),
    );
  });

  it('缺失归属或出现其他租户时拒绝而不请求候选', async () => {
    mocks.tree.mockResolvedValue([{ id: 'org-a', tenantId: 'tenant-a' }]);
    await expect(
      loadReferenceCandidates('partners', 'tenant-b'),
    ).rejects.toThrow();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('无可访问组织时返回空且不回退当前全局组织', async () => {
    mocks.tree.mockResolvedValue([]);
    expect(await loadReferenceCandidates('partners', 'tenant-b')).toEqual({
      items: [],
      totals: 0,
    });
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
