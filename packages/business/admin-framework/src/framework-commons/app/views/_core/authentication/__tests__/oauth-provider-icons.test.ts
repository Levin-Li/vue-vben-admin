import { listIcons } from '@vben/icons';

import { describe, expect, it } from 'vitest';

import { resolveDefaultOAuthProviderIcon } from '../oauth-provider-icons';

describe('OAuth 供应商默认图标', () => {
  it('为常用平台和展示别名提供本地图标', () => {
    expect(resolveDefaultOAuthProviderIcon('WECHAT_OPEN')).toBe('oauth:wechat');
    expect(resolveDefaultOAuthProviderIcon('WECHAT_OAUTH')).toBe('oauth:wechat');
    expect(resolveDefaultOAuthProviderIcon('ALIPAY')).toBe('oauth:alipay');
    expect(resolveDefaultOAuthProviderIcon('QQ')).toBe('oauth:qq');
    expect(resolveDefaultOAuthProviderIcon('GITHUB')).toBe('oauth:github');
    expect(listIcons('', 'oauth')).toEqual(
      expect.arrayContaining(['oauth:alipay', 'oauth:qq', 'oauth:wechat']),
    );
  });

  it('为未知供应商提供本地中性兜底图标', () => {
    expect(resolveDefaultOAuthProviderIcon('PRIVATE_IDP')).toBe('lucide:log-in');
  });
});
