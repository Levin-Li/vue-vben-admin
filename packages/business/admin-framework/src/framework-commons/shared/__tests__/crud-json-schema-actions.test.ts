import type { CrudFieldConfig } from '../types';

import { describe, expect, it } from 'vitest';

import {
  buildCrudJsonFieldUpdatePayload,
  getCrudJsonSchemaEditFields,
} from '../crud-json-schema-actions';

const field: CrudFieldConfig = {
  key: 'configData',
  label: '配置数据',
  type: 'json',
  jsonSchemaEditor: true,
  jsonSchema: ':configDataEditor',
};
const record = {
  id: 'job',
  configDataEditor: 'class:ExampleConfig',
  configData: { batchSize: 100 },
  optimisticLock: 2,
};
const options = {
  canEditField: () => true,
  canEditRecord: true,
  recordKey: 'id',
  userInfo: {},
};

describe('指定JSON字段默认编辑操作', () => {
  it('仅为标注字段提供入口，空编辑器仍能编辑', () => {
    expect(getCrudJsonSchemaEditFields([field], record, options)).toEqual([
      field,
    ]);
    for (const editor of [undefined, null, '', ' ']) {
      expect(
        getCrudJsonSchemaEditFields(
          [field],
          { ...record, configDataEditor: editor },
          options,
        ),
      ).toEqual([field]);
    }
  });

  it('不绕过记录权限、字段只读或隐藏设置', () => {
    expect(
      getCrudJsonSchemaEditFields([field], record, {
        ...options,
        canEditRecord: false,
      }),
    ).toEqual([]);
    expect(
      getCrudJsonSchemaEditFields([field], record, {
        ...options,
        canEditField: () => false,
      }),
    ).toEqual([]);
    for (const override of [
      { form: false },
      { formEdit: false },
      { omitOnEdit: true },
      { disabledOnEdit: true },
      { disabledOnEdit: () => true },
    ]) {
      expect(
        getCrudJsonSchemaEditFields(
          [{ ...field, ...override }],
          record,
          options,
        ),
      ).toEqual([]);
    }
  });

  it('内联Schema可用但普通JSON字段无专用操作', () => {
    const inline = { ...field, jsonSchema: { type: 'object', properties: {} } };
    expect(getCrudJsonSchemaEditFields([inline], {}, options)).toEqual([
      inline,
    ]);
    expect(
      getCrudJsonSchemaEditFields(
        [{ ...field, jsonSchemaEditor: false }],
        record,
        options,
      ),
    ).toEqual([]);
  });

  it('只提交目标字段，不允许转换器覆盖身份、版本或补回无关值', () => {
    const scoped = { ...record, tenantId: 'tenant-a', orgId: 'org-a' };
    expect(
      buildCrudJsonFieldUpdatePayload(
        'configData',
        {
          id: 'other',
          optimisticLock: 99,
          tenantId: 'tenant-b',
          orgId: 'org-b',
          name: '不应提交',
          enable: false,
          configData: { '@JsonSchema': 'class:ExampleConfig', batchSize: 50 },
          forceUpdateFields: ['name'],
        },
        scoped,
        'id',
        true,
      ),
    ).toEqual({
      id: 'job',
      optimisticLock: 2,
      tenantId: 'tenant-a',
      orgId: 'org-a',
      configData: { '@JsonSchema': 'class:ExampleConfig', batchSize: 50 },
      forceUpdateFields: ['configData'],
    });
    expect(
      buildCrudJsonFieldUpdatePayload(
        'configData',
        { configData: null },
        scoped,
        'id',
        false,
      ),
    ).not.toHaveProperty('tenantId');
  });

  it('缺少字段或主键时拒绝空更新', () => {
    expect(() =>
      buildCrudJsonFieldUpdatePayload('configData', {}, record, 'id', true),
    ).toThrow();
    expect(() =>
      buildCrudJsonFieldUpdatePayload(
        'configData',
        { configData: {} },
        {},
        'id',
        true,
      ),
    ).toThrow();
    expect(() =>
      buildCrudJsonFieldUpdatePayload('id', { id: {} }, record, 'id', true),
    ).toThrow();
  });
});
