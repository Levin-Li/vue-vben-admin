import { describe, expect, it, vi } from 'vitest';

import { UserService } from '../../../api/user-service';

const actor = vi.hoisted(() => ({
  userInfo: { tenantId: 'tenant-own' },
}));

vi.mock('@vben/runtime/stores', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/runtime/stores')>()),
  useUserStore: () => actor,
}));

describe('用户组织查询范围', () => {
  it('将页面的组织单选带入授权列表条件，保留显式组织多选', async () => {
    const service = new UserService();
    const get = vi
      .spyOn(service as unknown as { get: () => Promise<unknown> }, 'get')
      .mockResolvedValue({ items: [] });

    await service.list({ orgId: 'org-one', tenantId: 'tenant-other' });
    expect(get).toHaveBeenLastCalledWith('list', {
      params: { orgId: 'org-one', orgIdList: ['org-one'] },
    });

    const orgIdList = ['org-one', 'org-two'];
    await service.list({ orgId: 'org-one', orgIdList });
    expect(get).toHaveBeenLastCalledWith('list', {
      params: { orgId: 'org-one', orgIdList },
    });
  });
});
