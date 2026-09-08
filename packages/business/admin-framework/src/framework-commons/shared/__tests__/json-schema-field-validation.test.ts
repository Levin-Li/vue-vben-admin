import { describe, expect, it } from 'vitest';

import { getJsonSchemaFieldError } from '../json-schema-field-validation';
import { buildJsonSchemaFormFields } from '../json-schema-form';

function field(schema: Record<string, any>, required = false) {
  const result = buildJsonSchemaFormFields({
    properties: { value: { title: '配置项', ...schema } },
    required: required ? ['value'] : [],
    type: 'object',
  })[0];
  if (!result) throw new Error('测试字段未生成');
  return result;
}

describe('动态表单 Schema 字段约束', () => {
  it('必填空值阻断，零和 false 合法，非必填空值允许', () => {
    for (const value of [undefined, null, '', '  ']) {
      expect(
        getJsonSchemaFieldError(field({ type: 'string' }, true), value),
      ).toBeTruthy();
      expect(
        getJsonSchemaFieldError(field({ type: 'string' }), value),
      ).toBeUndefined();
    }
    expect(
      getJsonSchemaFieldError(field({ type: 'integer' }, true), 0),
    ).toBeUndefined();
    expect(
      getJsonSchemaFieldError(field({ type: 'boolean' }, true), false),
    ).toBeUndefined();
  });

  it('验证整数和有限数值以及包含边界', () => {
    const descriptor = field({ type: 'integer', minimum: 0, maximum: 5 });
    for (const value of [0, 5])
      expect(getJsonSchemaFieldError(descriptor, value)).toBeUndefined();
    for (const value of [-1, 6, 0.5, Number.NaN, Infinity, -Infinity, '1'])
      expect(getJsonSchemaFieldError(descriptor, value)).toBeTruthy();
    expect(
      getJsonSchemaFieldError(field({ type: 'number' }), 0.5),
    ).toBeUndefined();
  });

  it('验证排他数值边界', () => {
    for (const schema of [
      { exclusiveMinimum: 0, exclusiveMaximum: 5 },
      {
        minimum: 0,
        maximum: 5,
        exclusiveMinimum: true,
        exclusiveMaximum: true,
      },
    ]) {
      const descriptor = field({ type: 'number', ...schema });
      for (const value of [0, 5])
        expect(getJsonSchemaFieldError(descriptor, value)).toBeTruthy();
      expect(getJsonSchemaFieldError(descriptor, 2)).toBeUndefined();
    }
  });

  it('验证字符串长度、类型和枚举，字符数使用 Unicode 码点', () => {
    const descriptor = field({ type: 'string', minLength: 2, maxLength: 3 });
    for (const value of ['你好', '你好啊', '😀好'])
      expect(getJsonSchemaFieldError(descriptor, value)).toBeUndefined();
    for (const value of ['你', '你好世界', 12])
      expect(getJsonSchemaFieldError(descriptor, value)).toBeTruthy();
    expect(
      getJsonSchemaFieldError(field({ enum: [0, false] }), false),
    ).toBeUndefined();
    expect(
      getJsonSchemaFieldError(field({ enum: [0, false] }), '0'),
    ).toBeTruthy();
    expect(
      getJsonSchemaFieldError(field({ enum: [{ a: 1, b: 2 }] }), {
        b: 2,
        a: 1,
      }),
    ).toBeUndefined();
  });

  it('只读与分组跳过校验', () => {
    expect(
      getJsonSchemaFieldError(
        field({ type: 'integer', readOnly: true }, true),
        '坏值',
      ),
    ).toBeUndefined();
    expect(
      getJsonSchemaFieldError(
        field({ type: 'object', properties: {} }, true),
        undefined,
      ),
    ).toBeUndefined();
  });

  it('区分对象数组并支持可空类型声明', () => {
    expect(
      getJsonSchemaFieldError(field({ type: 'object' }), {}),
    ).toBeUndefined();
    expect(
      getJsonSchemaFieldError(field({ type: 'array' }), []),
    ).toBeUndefined();
    expect(getJsonSchemaFieldError(field({ type: 'object' }), [])).toBeTruthy();
    expect(getJsonSchemaFieldError(field({ type: 'array' }), {})).toBeTruthy();
    expect(
      getJsonSchemaFieldError(field({ type: ['null', 'integer'] }), 0),
    ).toBeUndefined();
    expect(getJsonSchemaFieldError(field({ type: 'boolean' }), 0)).toBeTruthy();
  });
});
