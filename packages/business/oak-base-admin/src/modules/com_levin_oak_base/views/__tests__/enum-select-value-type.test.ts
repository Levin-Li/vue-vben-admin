import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const configPaths = [
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/user/config.ts',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/role/config.ts',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/org/config.ts',
];

function getFieldBlock(source: string, key: string) {
  const fieldStart = source.indexOf(`key: '${key}'`);
  const nextFieldStart = source.indexOf('\n    {', fieldStart + 1);

  return source.slice(
    fieldStart,
    nextFieldStart === -1 ? undefined : nextFieldStart,
  );
}

describe('integer enum select configuration', () => {
  it('declares number payloads for every audited ConfidentialLevel field', () => {
    const expectedFields = new Map<string, string[]>([
      [configPaths[0]!, ['confidentialLevel', 'confidentialDataAccessLevel']],
      [configPaths[1]!, ['confidentialLevel', 'confidentialDataAccessLevel']],
      [configPaths[2]!, ['confidentialLevel']],
    ]);

    for (const [path, fieldKeys] of expectedFields) {
      const source = readFileSync(path, 'utf8');

      for (const key of fieldKeys) {
        const fieldBlock = getFieldBlock(source, key);

        expect(fieldBlock, `${path}:${key}`).toContain("type: 'select'");
        expect(fieldBlock, `${path}:${key}`).toContain("valueType: 'number'");
      }
    }
  });
});
