import { describe, expect, it, vi } from 'vitest';

import { UserService } from '../api/user-service';

describe('用户服务只登记已启用接口', () => {
  it('后端禁用全部批量操作时不再暴露批量导入或预取其字段策略', () => {
    const service = new UserService();
    for (const method of ['batchCreate', 'batchDelete', 'batchUpdate']) {
      expect(Reflect.get(service, method)).toBeUndefined();
    }
    for (const method of ['list', 'retrieve', 'resetPassword', 'update'])
      expect(Reflect.get(service, method)).toBeTypeOf('function');
  });

  it('重置密码请求不会向通用事件总线广播凭据', async () => {
    const user = new UserService();
    const userPut = vi.spyOn(user as any, 'put').mockResolvedValue(undefined);
    const userPost = vi.spyOn(user as any, 'post').mockResolvedValue(undefined);
    const userGet = vi.spyOn(user as any, 'get').mockResolvedValue(undefined);

    await user.resetPassword({ id: 'user-1', newPassword: 'NewPass123' });
    await user.create({ loginName: 'new-user', password: 'NewPass123' });
    await user.resetMfaSecretKey({ id: 'user-1' });
    await user.viewMfaQrCode({ id: 'user-1' });
    await user.viewMyMfaQrCode();

    expect(userPut).toHaveBeenCalledWith(
      'resetPassword',
      expect.objectContaining({ __sensitiveResponse: true }),
    );
    expect(userPost).toHaveBeenCalledWith(
      'create',
      expect.objectContaining({ __sensitiveResponse: true }),
    );
    expect(userPut).toHaveBeenCalledWith(
      'resetMfaSecretKey',
      expect.objectContaining({ __sensitiveResponse: true }),
    );
    for (const method of ['viewMfaQrCode', 'viewMyMfaQrCode']) {
      expect(userGet).toHaveBeenCalledWith(
        method,
        expect.objectContaining({ __sensitiveResponse: true }),
      );
    }
  });
});
