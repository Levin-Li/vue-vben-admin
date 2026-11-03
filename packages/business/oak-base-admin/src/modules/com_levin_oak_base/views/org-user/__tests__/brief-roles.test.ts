import { describe, expect, it, vi } from 'vitest';

import { assignBriefRolesAfterSave } from '../brief-roles';

describe('组织与用户简要表单角色保存', () => {
  it('用户创建后通过独立接口分配角色', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    expect(
      await assignBriefRolesAfterSave({
        canAssign: true,
        created: true,
        id: 'user-1',
        roles: ['staff'],
        send,
      }),
    ).toBeUndefined();
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith('user-1', ['staff']);
  });

  it('编辑时未改变角色不重复分配', async () => {
    const send = vi.fn();
    await assignBriefRolesAfterSave({
      canAssign: true,
      created: false,
      id: 'user-1',
      previousRoles: ['staff', 'viewer'],
      roles: ['viewer', 'staff'],
      send,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('角色接口失败只返回部分成功提示，供现有用户重试', async () => {
    const send = vi.fn().mockRejectedValue(new Error('forbidden'));
    expect(
      await assignBriefRolesAfterSave({
        canAssign: true,
        created: true,
        id: 'user-1',
        roles: ['staff'],
        send,
      }),
    ).toContain('用户资料已保存，角色未分配');
    expect(send).toHaveBeenCalledOnce();
  });
});
