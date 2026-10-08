import { describe, expect, it } from 'vitest';

import { resolveOAuthPlatformName } from '../oauth-platform-name';

describe('平台显示名称', () => {
  it.each([
    ['FEISHU', '飞书'],
    ['WECHAT_ENTERPRISE_V2', '企业微信'],
    ['DINGTALK_V2', '钉钉'],
  ])('目录和真实绑定字段统一显示%s', (code, name) => {
    expect(resolveOAuthPlatformName({ code, name: code })).toBe(name);
    expect(
      resolveOAuthPlatformName({ sourcePlatform: code, name: '成员昵称' }),
    ).toBe(name);
  });

  it('未知来源不误用成员昵称，保留显式平台名称', () => {
    expect(
      resolveOAuthPlatformName({ sourcePlatform: 'CUSTOM', name: '成员昵称' }),
    ).toBe('CUSTOM');
    expect(
      resolveOAuthPlatformName({
        sourcePlatform: 'CUSTOM',
        platformName: '合作平台',
      }),
    ).toBe('合作平台');
    expect(resolveOAuthPlatformName({ code: 'GITHUB', name: 'GitHub' })).toBe(
      'GitHub',
    );
  });
});
