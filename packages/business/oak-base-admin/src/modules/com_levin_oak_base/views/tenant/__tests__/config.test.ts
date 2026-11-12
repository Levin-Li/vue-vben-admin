import { describe, expect, it, vi } from 'vitest';

import { tenantPageCrudConfig } from '../config';

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

  it('uses the default admin login and checks the initial secret only when creating a tenant', () => {
    expect(tenantPageCrudConfig.fields.some((field) => field.key === 'loginName')).toBe(false);
    expect(tenantPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'adminInitialPassword',
          formCreate: true,
          formEdit: false,
          detail: false,
          required: true,
          type: 'password',
          maxLength: 128,
        }),
      ]),
    );

    const password = tenantPageCrudConfig.fields.find((field) => field.key === 'adminInitialPassword');
    expect(password?.validator?.('Aa123', {})).toContain('6至128字符');
    expect(password?.validator?.('aaaaaa1', {})).toContain('大写字母');
    expect(password?.validator?.('AAAAAA1', {})).toContain('小写字母');
    expect(password?.validator?.('AaBbCc', {})).toContain('数字');
    expect(password?.validator?.('Aa1234', {})).toBeUndefined();
    expect(password?.validator?.(`Aa1${'x'.repeat(125)}`, {})).toBeUndefined();
    expect(password?.validator?.(`Aa1${'x'.repeat(126)}`, {})).toContain('6至128字符');
  });
});
