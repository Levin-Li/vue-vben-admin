import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('设置加载范围回显', () => {
  it('页面展示设置以服务端范围整体替换当前页面上下文', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
      'utf8',
    );

    expect(source).toContain(
      'pageDisplayScope.value = { ...resolution.scope };',
    );
    expect(source).not.toContain(
      'pageDisplayScope.value = { ...pageDisplayScope.value, ...resolution.scope };',
    );
  });

  it('界面偏好设置加载前清除已有范围', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );

    expect(source).toContain('Object.keys(adminUiPreferencesScope).forEach');
    expect(source).toContain('delete adminUiPreferencesScope');
    expect(source).toContain(
      'Object.assign(adminUiPreferencesScope, resolution.scope);',
    );
  });
});
