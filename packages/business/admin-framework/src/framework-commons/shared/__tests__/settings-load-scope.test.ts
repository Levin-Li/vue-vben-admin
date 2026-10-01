import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('设置加载范围回显', () => {
  it('页面展示设置只读取记录范围，并同时传递给原版与 V2 抽屉', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
      'utf8',
    );

    expect(source).toContain(
      'pageDisplayScope.value = resolveUiSettingRecordScope(resolution);',
    );
    expect(source).not.toContain(
      'pageDisplayScope.value = { ...pageDisplayScope.value, ...resolution.scope };',
    );
    expect(source).toContain(
      ':initial-scope="pageDisplayScope"',
    );
    expect(
      source.match(
        /:initial-scope="pageDisplayScope"/g,
      ),
    ).toHaveLength(2);
    expect(
      source.match(/:scope-load-version="pageDisplayScopeLoadVersion"/g),
    ).toHaveLength(2);
  });

  it('界面偏好设置打开或加载前均清除已有范围', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );

    expect(
      source.match(/Object\.keys\(adminUiPreferencesScope\)\.forEach/g),
    ).toHaveLength(2);
    expect(source).toContain('delete adminUiPreferencesScope');
    expect(source).not.toContain('Object.assign(adminUiPreferencesScope, {});');
    expect(source).toContain(
      'resolveAdminUiPreferencesUploadScope(resolution)',
    );
  });
});
