import { describe, expect, it } from 'vitest';

import { partnerCommonFields } from '../config';

describe('合作关系公共资料', () => {
  it('保留行业与业务名称，移除旧身份字段', () => {
    const keys = partnerCommonFields.map((field) => field.key);
    for (const key of ['industries', 'displayName', 'shortName'])
      expect(keys).toContain(key);
    for (const key of ['category', 'subCategory', 'externalOrgId'])
      expect(keys).not.toContain(key);
  });
});
