import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/menu-icon-picker.vue',
  'utf8',
);

describe('menu icon picker', () => {
  it('uses an icon-only trigger and keeps the picker within 90% of the viewport', () => {
    expect(source).toContain('class="w-[600px] max-w-[90vw] p-3"');
    expect(source).toContain(":icon=\"modelValue || 'lucide:image-plus'\"");
    expect(source).not.toContain('选择或输入图标，例如 lucide:settings');
    expect(source).not.toContain('v-model:value="modelValue"');
  });
});
