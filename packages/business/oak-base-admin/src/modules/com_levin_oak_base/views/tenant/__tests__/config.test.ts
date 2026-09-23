import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/tenant-service', () => ({
  tenantService: {},
}));

vi.mock('../../api-module', () => ({
  confidentialLevelOptionsLoader: async () => [],
  currencyCodeOptionsLoader: async () => [],
  languageCodeOptionsLoader: async () => [],
  nationCodeOptionsLoader: async () => [],
  tenantLevelOptionsLoader: async () => [],
  tenantTypeOptionsLoader: async () => [],
}));

import { tenantPageCrudConfig } from '../config';

describe('tenant page configuration', () => {
  it('covers every tenant field added to the generated request model', () => {
    const fieldKeys = tenantPageCrudConfig.fields.map((field) => field.key);

    expect(fieldKeys).toEqual(
      expect.arrayContaining([
        'confidentialLevel',
        'inLevel',
        'inType',
        'level',
        'type',
      ]),
    );
  });

  it('supports contact information and district-level area selection', () => {
    expect(tenantPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'contractPerson',
          layoutGroup: 'contact',
          search: true,
          table: true,
        }),
        expect.objectContaining({
          key: 'contractEmail',
          layoutGroup: 'contact',
          search: true,
          table: true,
        }),
        expect.objectContaining({
          key: 'contractPhone',
          layoutGroup: 'contact',
          search: true,
          table: true,
        }),
        expect.objectContaining({
          areaCascader: {
            selectableLevels: ['district'],
            valueKey: 'areaCode',
          },
          key: 'areaCode',
          search: true,
          table: true,
          type: 'area-cascader',
        }),
      ]),
    );
  });
});
