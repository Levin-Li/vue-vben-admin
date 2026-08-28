import { describe, expect, it } from 'vitest';

import { tenantCustomMenuPageCrudConfig } from '../config';

describe('tenant custom menu audience fields', () => {
  it('uses clearable single-select fields so empty values represent wildcards', () => {
    for (const key of ['userType', 'orgType']) {
      const field = tenantCustomMenuPageCrudConfig.fields.find(
        (item) => item.key === key,
      );

      expect(field).toMatchObject({
        search: true,
        table: true,
        type: 'select',
      });
      expect(field?.multiple).toBeUndefined();
      expect(field?.help).toContain('留空表示匹配任意');
    }
  });
});
