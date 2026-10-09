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

  it('keeps provider-scoped saving and opens a guide from the dialog title', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('编辑供应商配置');
    expect(source).toContain('<ProviderGuidance');
    expect(source).toContain('<template #title>');
    expect(source).not.toContain('editingOauthProvider');
    expect(source).toContain('buildProviderConfigurationUpdate');
  });

  it('shows plugin type names while choosing the plugin', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('function getPluginOptionLabel');
    expect(source).toMatch(/`\$\{name\}（\$\{pluginTypeName\}）`/);
    expect(source).toContain('label: getPluginOptionLabel(plugin)');
  });

  it('uses the shared local plugin option filter in search and form fields', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain(
      "import { filterServicePluginOption } from './plugin-option-search'",
    );
    expect(
      source.match(/:filter-option="filterServicePluginOption"/g),
    ).toHaveLength(2);
  });
});
