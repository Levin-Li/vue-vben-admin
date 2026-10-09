import { describe, expect, it } from 'vitest';

import {
  filterServiceProviderOption,
  resolveServiceProviderName,
} from '../service-provider-display-name';

describe('服务插件供应商展示名', () => {
  it('目录仍保存编码时展示中文，保留管理员自定义名称和协议编码', () => {
    expect(
      resolveServiceProviderName({ code: 'DINGTALK_V2', name: 'DINGTALK_V2' }),
    ).toBe('钉钉');
    expect(
      resolveServiceProviderName({
        code: 'WECHAT_ENTERPRISE_V2',
        name: 'WECHAT_ENTERPRISE_V2',
      }),
    ).toBe('企业微信');
    expect(resolveServiceProviderName({ code: 'FEISHU', name: 'FEISHU' })).toBe(
      '飞书',
    );
    expect(
      resolveServiceProviderName({ code: 'DINGTALK_V2', name: '公司专用钉钉' }),
    ).toBe('公司专用钉钉');
    expect(resolveServiceProviderName({ code: 'GITHUB', name: 'GitHub' })).toBe(
      'GitHub',
    );
  });

  it('供应商可按中文展示名或稳定编码搜索', () => {
    const option = { label: '钉钉', value: 'DINGTALK_V2' };
    expect(filterServiceProviderOption('钉钉', option)).toBe(true);
    expect(filterServiceProviderOption('dingtalk_v2', option)).toBe(true);
    expect(filterServiceProviderOption('飞书', option)).toBe(false);
  });
});
