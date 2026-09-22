import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('设置加载范围回显', () => {
  it('页面展示设置未命中时清空范围，并同时传递给原版与 V2 抽屉', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
      'utf8',
    );

    expect(source).toContain(
      'pageDisplayScope.value = setting ? { ...resolution.scope } : {};',
    );
    expect(source).not.toContain(
      'pageDisplayScope.value = { ...pageDisplayScope.value, ...resolution.scope };',
    );
    expect(source).toContain(
      ':initial-scope="pageDisplaySettingRecord || pageDisplayInitialScope"',
    );
    expect(source.match(/:initial-scope="pageDisplaySettingRecord \|\| pageDisplayInitialScope"/g)).toHaveLength(2);
  });

  it('界面偏好设置加载前清除已有范围', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );

    expect(source).toContain('Object.keys(adminUiPreferencesScope).forEach');
    expect(source).toContain('delete adminUiPreferencesScope');
    expect(source).toContain('resolveAdminUiPreferencesUploadScope(resolution)');
  });
});
