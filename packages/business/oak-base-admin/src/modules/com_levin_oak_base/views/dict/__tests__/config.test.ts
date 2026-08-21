import { describe, expect, it, vi } from 'vitest';

import { sortFormLayoutFields } from '@levin/admin-framework/framework-commons/shared/crud-form-layout';

import { dictPageCrudConfig } from '../config';

vi.mock('../../../api/dict-service', () => ({
  dictService: {},
}));

vi.mock('../../api-module', () => ({
  tenantOptionsLoader: async () => [],
}));

describe('dict page config', () => {
  it('uses a two-column form with full-width dictionary items and remark', () => {
    const fields = dictPageCrudConfig.fields;
    const visualKeys = sortFormLayoutFields(fields).map((field) => field.key);
    const visualIndexOf = (key: string) => visualKeys.indexOf(key);

    expect(dictPageCrudConfig.formMaxColumns).toBe(2);
    expect(dictPageCrudConfig.modalWidth).toBe(960);
    expect(fields.find((field) => field.key === 'tenantId')).toMatchObject({
      layoutGroup: 'ownership',
    });
    expect(fields.find((field) => field.key === 'itemList')).toMatchObject({
      fullRow: true,
      layoutGroup: 'content',
      layoutNewRow: true,
    });
    expect(fields.find((field) => field.key === 'orderCode')).toMatchObject({
      layoutGroup: 'business',
      layoutNewRow: true,
    });
    expect(fields.find((field) => field.key === 'category' && field.table)).toMatchObject({
      layoutGroup: 'basic',
      layoutOrder: 40,
      table: true,
    });
    expect(fields.find((field) => field.key === 'groupName' && field.table)).toMatchObject({
      layoutGroup: 'basic',
      layoutOrder: 50,
      table: true,
    });
    expect(fields.find((field) => field.key === 'remark')).toMatchObject({
      fullRow: true,
      layoutGroup: 'remark',
      type: 'textarea',
    });

    expect(visualIndexOf('tenantId')).toBeLessThan(visualIndexOf('name'));
    expect(visualIndexOf('name')).toBeLessThan(visualIndexOf('code'));
    expect(visualIndexOf('code')).toBeLessThan(visualIndexOf('type'));
    expect(visualIndexOf('type')).toBeLessThan(visualIndexOf('category'));
    expect(visualIndexOf('category')).toBeLessThan(visualIndexOf('groupName'));
    expect(visualIndexOf('type')).toBeLessThan(visualIndexOf('itemList'));
    expect(visualIndexOf('itemList')).toBeLessThan(visualIndexOf('orderCode'));
    expect(visualIndexOf('editable')).toBeLessThan(visualIndexOf('remark'));
  });
});
