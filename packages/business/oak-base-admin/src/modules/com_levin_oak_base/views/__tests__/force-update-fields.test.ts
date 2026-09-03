import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const fileResourceSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/file-res/resource-preview-view.vue',
  'utf8',
);
const openAreaSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/open-area/index.vue',
  'utf8',
);
const orgUserSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/org-user/index.vue',
  'utf8',
);
const crudPageSource = readFileSync(
  'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
  'utf8',
);
const explicitForceUpdateSources = [
  'packages/business/admin-framework/src/framework-commons/shared/data-permission-dialog.vue',
  'packages/business/admin-framework/src/framework-commons/shared/resource-permission-dialog.vue',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/index.vue',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/menu-form-drawer.vue',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/open-area/index.vue',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/service-plugin-setting/index.vue',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/service-plugin/index.vue',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/setting-crud-page.vue',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/setting-for-tenant/setting-for-tenant.ts',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/simple-content-resource-page.vue',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/tenant-custom-menu/index.vue',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/tenant-plugin-setting/index.vue',
].map((path) => readFileSync(path, 'utf8'));

describe('自定义更新字段语义', () => {
  it('为完整表单更新启用自动强制更新', () => {
    expect(fileResourceSource).toContain(
      "if (editorMode.value !== 'create') {\n    payload.autoForceUpdateField = true;",
    );
    expect(orgUserSource).toContain(
      "if (orgModalMode.value === 'edit') {\n      payload.autoForceUpdateField = true;",
    );
  });

  it('明确强制更新可清空的开通区域列表', () => {
    expect(openAreaSource).toContain(
      "areaCodeList,\n      autoForceUpdateField: false,\n      forceUpdateFields: ['areaCodeList'],",
    );
  });

  it('为所有指定字段更新显式关闭自动强制更新', () => {
    for (const source of explicitForceUpdateSources) {
      let forceIndex = source.indexOf('forceUpdateFields');

      while (forceIndex >= 0) {
        expect(
          source.slice(Math.max(0, forceIndex - 1500), forceIndex + 80),
        ).toMatch(/autoForceUpdateField\s*(?:=|:)\s*false/);
        forceIndex = source.indexOf('forceUpdateFields', forceIndex + 1);
      }
    }
  });

  it('为表格内布尔开关快捷更新显式关闭自动强制更新', () => {
    const quickSwitchSource = crudPageSource.slice(
      crudPageSource.indexOf('async function updateBooleanEnableField'),
      crudPageSource.indexOf('function canShowBuiltinDetail'),
    );

    expect(quickSwitchSource).toContain('autoForceUpdateField: false');
    expect(quickSwitchSource).not.toContain('forceUpdateFields');
  });
});
