import { describe, expect, it } from 'vitest';

import { filterServicePluginOption } from '../plugin-option-search';

describe('service plugin option search', () => {
  const option = {
    label: 'Google MFA验证码插件（身份认证）',
    value: 'plugin-google-mfa',
  };

  it('matches plugin labels case-insensitively', () => {
    expect(filterServicePluginOption('google mfa', option)).toBe(true);
    expect(filterServicePluginOption('验证码', option)).toBe(true);
    expect(filterServicePluginOption('cloudflare', option)).toBe(false);
  });

  it('matches plugin ids and keeps all options for an empty keyword', () => {
    expect(filterServicePluginOption('GOOGLE-MFA', option)).toBe(true);
    expect(filterServicePluginOption('   ', option)).toBe(true);
  });
});
