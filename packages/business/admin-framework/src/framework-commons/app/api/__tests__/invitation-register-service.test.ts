import { beforeEach, describe, expect, it, vi } from 'vitest';

import { invitationRegisterService } from '../invitation-register-service';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('../request', () => ({ baseRequestClient: { post } }));

describe('公开邀请注册 API 路径', () => {
  beforeEach(() => post.mockReset());

  it('通过已有模块前缀的请求客户端访问控制器相对路径', async () => {
    // 客户端会统一添加模块前缀，业务服务不能再次拼完整 API 基址。
    await invitationRegisterService.preview('signed-token');
    expect(post).toHaveBeenCalledWith('/InvitationRegister/preview', {
      token: 'signed-token',
    });

    await invitationRegisterService.redeem({
      account: '13800138000',
      name: '受邀人',
      password: 'test-password',
      token: 'signed-token',
      verificationCode: '123456',
      verifyCodeType: 'Sms',
    });
    expect(post).toHaveBeenLastCalledWith(
      '/InvitationRegister/redeem',
      expect.objectContaining({ token: 'signed-token' }),
    );
  });
});
