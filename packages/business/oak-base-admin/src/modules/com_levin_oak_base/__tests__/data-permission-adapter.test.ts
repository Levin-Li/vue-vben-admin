import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataPermissionCallbacks } from '../data-permission-adapter';

const mocks = vi.hoisted(() => ({
  roleRetrieve: vi.fn(),
  roleUpdate: vi.fn(),
  userRetrieve: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock('../api/role-service', () => ({
  roleService: { retrieve: mocks.roleRetrieve, update: mocks.roleUpdate },
}));
vi.mock('../api/user-service', () => ({
  userService: { retrieve: mocks.userRetrieve, update: mocks.userUpdate },
}));

describe('数据权限目标回调', () => {
  beforeEach(() => vi.clearAllMocks());

  it('用户详情缺少角色字段时按列表记录和租户还原继承规则', async () => {
    mocks.userRetrieve.mockResolvedValue({
      id: 'u1',
      password: '不可进入弹窗',
      tenantScopeList: null,
    });
    const callbacks = createDataPermissionCallbacks(
      { id: 'u1', roleList: ['R_A'], tenantId: 'tenant-1' },
      'user',
      () => [
        { code: 'R_A', tenantId: 'tenant-1', tenantScopeList: ['tenant-a'] },
        { code: 'R_A', tenantId: 'tenant-2', tenantScopeList: ['tenant-b'] },
      ],
    );
    const loaded = await callbacks.loadTarget();
    expect(loaded).toMatchObject({
      canInherit: true,
      inheritedScopes: { tenantScopeList: ['tenant-a'] },
      label: '用户',
    });
    expect(loaded.detail).not.toHaveProperty('password');
    expect(mocks.userRetrieve).toHaveBeenCalledWith({ id: 'u1' });
    expect(mocks.roleRetrieve).not.toHaveBeenCalled();
  });

  it('角色目标通过自己的回调读取并保存改动', async () => {
    mocks.roleRetrieve.mockResolvedValue({ id: 'r1', name: '运营角色' });
    mocks.roleUpdate.mockResolvedValue({ optimisticLock: 2 });
    const callbacks = createDataPermissionCallbacks({ id: 'r1' }, 'role');
    await expect(callbacks.loadTarget()).resolves.toMatchObject({
      canInherit: false,
      label: '角色',
    });
    await expect(
      callbacks.saveTarget({
        id: 'r1',
        optimisticLock: 1,
        orgScopeList: ['o1|Self'],
      }),
    ).resolves.toEqual({ optimisticLock: 2 });
    expect(mocks.roleUpdate).toHaveBeenCalledWith({
      id: 'r1',
      optimisticLock: 1,
      orgScopeList: ['o1|Self'],
    });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
