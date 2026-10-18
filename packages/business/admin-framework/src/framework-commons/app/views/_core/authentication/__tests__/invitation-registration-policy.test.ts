import type { InvitationPreview } from '../../../../api/invitation-register-service';

import { describe, expect, it } from 'vitest';

import {
  accountChannel,
  channelAllowed,
} from '../invitation-registration-policy';

function preview(
  registrationChannel: InvitationPreview['registrationChannel'],
): InvitationPreview {
  return {
    targetType: 'Customer',
    expiresAt: '2030-01-01T00:00:00Z',
    registrationChannel,
  };
}

describe('邀请注册方式', () => {
  it('拒绝普通用户名和无效联系方式', () => {
    for (const account of ['alice', 'alice@invalid', 'abc@x..com', '123456']) {
      expect(accountChannel(account)).toBe('');
    }
  });

  it('仅放行链接指定的手机号或邮箱类型', () => {
    expect(
      channelAllowed(preview('Phone'), accountChannel('13800138000')),
    ).toBe(true);
    expect(
      channelAllowed(preview('Phone'), accountChannel('a@example.com')),
    ).toBe(false);
    expect(
      channelAllowed(preview('Email'), accountChannel('a@example.com')),
    ).toBe(true);
    expect(
      channelAllowed(preview('Email'), accountChannel('13800138000')),
    ).toBe(false);
  });

  it('第三方专用邀请不允许通过账号密码表单兑换', () => {
    expect(
      channelAllowed(preview('ThirdParty'), accountChannel('a@example.com')),
    ).toBe(false);
    expect(
      channelAllowed(preview('ThirdParty'), accountChannel('13800138000')),
    ).toBe(false);
    expect(
      channelAllowed(preview('Unrestricted'), accountChannel('alice')),
    ).toBe(false);
  });
});
