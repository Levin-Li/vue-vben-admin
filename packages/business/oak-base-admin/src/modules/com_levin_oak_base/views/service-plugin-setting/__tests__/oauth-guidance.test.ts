import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pagePath =
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/service-plugin-setting/index.vue';

describe('service plugin setting oauth guidance', () => {
  it('does not show a migration notice in the oauth settings list', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).not.toContain('message="OAuth 多供应商配置说明"');
    expect(source).not.toContain('迁移期请在这里维护凭据');
  });

  it('explains that quick edit only updates the current provider entry', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('编辑供应商配置');
    expect(source).toContain('message="OAuth 当前供应商配置说明"');
    expect(source).toContain('value.${providerCode}');
    expect(source).toContain('不会覆盖其它供应商配置');
  });

  it('shows plugin type names while choosing the plugin', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('function getPluginOptionLabel');
    expect(source).toContain('`${name}（${pluginTypeName}）`');
    expect(source).toContain('label: getPluginOptionLabel(plugin)');
  });
});
