import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/ui-setting/index.vue',
  'utf8',
);
const sharedPageSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/setting-crud-page.vue',
  'utf8',
);

describe('UiSetting 编辑值操作', () => {
  it('always exposes independent value editing and keeps the JSON fallback', () => {
    expect(pageSource).toContain('always-allow-value-edit');
    expect(pageSource).toContain('force-json-value-editor');
    expect(sharedPageSource).toContain('function canEditValue');
    expect(sharedPageSource).toContain('props.alwaysAllowValueEdit || isSettingEditable(record)');
    expect(sharedPageSource).toContain('@click="openEditValue(record, reload)"');
  });
});
