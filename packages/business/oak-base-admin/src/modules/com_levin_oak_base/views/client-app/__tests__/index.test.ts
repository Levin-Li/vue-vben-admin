import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('client app page', () => {
  it('wires common pattern editors for path and IP allowlists', () => {
    const source = readFileSync(
      'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/client-app/index.vue',
      'utf8',
    );

    expect(source).toContain('PatternListFormField');
    expect(source).toContain('#form-field-allowedPathPatterns');
    expect(source).toContain('#form-field-allowedIpList');
    expect(source).toContain('v-model="formState[field.key]"');
  });
});
