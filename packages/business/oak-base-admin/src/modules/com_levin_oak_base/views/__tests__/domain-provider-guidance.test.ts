import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildTenantSiteCapabilityOptions } from '../tenant-site-capability';

const domainPageSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/domain/index.vue',
  'utf8',
);
const tenantPluginSettingSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/tenant-plugin-setting/index.vue',
  'utf8',
);

describe('供应商申请引导', () => {
  it('按供应商保存并返回接入引导', () => {
    const guidance = {
      applicationUrl: 'https://vendor.example/register',
      documentationUrl: 'https://docs.vendor.example/api',
      prerequisites: ['准备管理员邮箱'],
      steps: ['注册账户'],
    };

    const options = buildTenantSiteCapabilityOptions([
      {
        name: '示例供应商',
        onboardingGuidance: guidance,
        supportedDomainSuffixes: ['.example'],
      },
    ]);

    expect(options.vendorOnboardingGuidanceMap['示例供应商']).toEqual(guidance);
  });

  it('在域名申请页随供应商切换展示安全外链和简要步骤', () => {
    expect(domainPageSource).toContain('selectedProviderGuidance');
    expect(domainPageSource).toContain('getTenantSiteVendorOnboardingGuidance');
    expect(domainPageSource).toContain('简要步骤');
    expect(domainPageSource).toContain('前往申请/注册');
    expect(domainPageSource).toContain('target="_blank"');
    expect(domainPageSource).toContain('rel="noopener noreferrer"');
  });

  it('在租户插件配置弹窗展示同一份引导', () => {
    expect(tenantPluginSettingSource).toContain('currentProviderGuidance');
    expect(tenantPluginSettingSource).toContain('供应商申请与配置准备');
    expect(tenantPluginSettingSource).toContain('target="_blank"');
    expect(tenantPluginSettingSource).toContain('rel="noopener noreferrer"');
  });
});
