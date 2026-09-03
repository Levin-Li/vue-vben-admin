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
      "areaCodeList,\n      forceUpdateFields: ['areaCodeList'],",
    );
  });

  it('保持表格内布尔开关快捷更新不变', () => {
    const quickSwitchSource = crudPageSource.slice(
      crudPageSource.indexOf('async function updateBooleanEnableField'),
      crudPageSource.indexOf('function canShowBuiltinDetail'),
    );

    expect(quickSwitchSource).not.toContain('autoForceUpdateField');
    expect(quickSwitchSource).not.toContain('forceUpdateFields');
  });
});
