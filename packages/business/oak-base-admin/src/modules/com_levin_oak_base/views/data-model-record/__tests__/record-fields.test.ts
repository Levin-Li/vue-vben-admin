import type { DataModelField } from '../../../api/data-model-service';

import { describe, expect, it } from 'vitest';

import {
  operationFormFields,
  recordDefaultValues,
  recordDisplayValue,
  recordExpectedVersion,
  recordScopeValues,
  serializeRecordValue,
  toCrudField,
  toDatetimeLocal,
  toRecordSchema,
} from '../record-fields';

describe('动态记录字段配置', () => {
  it('金融金额、精确小数和大整数不使用浮点输入', () => {
    for (const type of ['MONEY', 'DECIMAL', 'BIG_INTEGER'] as const) {
      const field = toCrudField({
        key: 'value',
        name: 'value',
        title: '数值',
        type,
        nullable: false,
      });
      expect(field.type).toBe('text');
      expect(field.required).toBe(true);
    }
  });

  it('保留固定选项的原始值类型', () => {
    const field = toCrudField({
      key: 'approved',
      name: 'approved',
      title: '批准',
      type: 'BOOLEAN',
      nullable: true,
      optionSource: 'FIXED',
      options: [
        { value: true, label: '是' },
        { value: false, label: '否' },
      ],
    });
    expect(field.type).toBe('select');
    expect(field.options?.map((item) => item.value)).toEqual([true, false]);
  });

  it('运行时表单将金融金额映射为字符串并保留必填和选项类型', () => {
    const schema = toRecordSchema([
      {
        key: 'amount',
        name: 'amount',
        title: '金额',
        type: 'MONEY',
        nullable: false,
      },
      {
        key: 'approved',
        name: 'approved',
        title: '批准',
        type: 'BOOLEAN',
        nullable: true,
        options: [{ value: true, label: '是' }],
      },
    ]);
    expect(schema).toMatchObject({
      required: ['amount'],
      properties: {
        amount: { type: 'string' },
        approved: { enum: [true], enumNames: ['是'] },
      },
    });
  });
});

// 金融与时间字段的传输必须保留原值精度，并保证默认值与声明类型一致。
describe('动态字段精度及默认值', () => {
  const field = (
    type: DataModelField['type'],
    name = 'value',
  ): DataModelField => ({
    key: name,
    name,
    title: name,
    type,
    nullable: false,
  });

  it('仅编辑其他字段时保留日期时间原始秒和微秒', () => {
    const original = '2026-10-22T10:11:12.123456Z';
    const local = toDatetimeLocal(original);
    expect(local).toContain(':12.123');
    expect(serializeRecordValue(field('DATETIME'), local, original)).toBe(
      original,
    );
    expect(
      serializeRecordValue(
        field('DATETIME'),
        '2026-10-22T10:11:13.234',
        original,
      ),
    ).toMatch(/13\.234Z$/);
  });

  it('必填默认值初始化为可直接提交的声明类型', () => {
    const fields = [
      {
        ...field('MONEY', 'money'),
        defaultValue: '900719925474099312345.123456789',
      },
      { ...field('BOOLEAN', 'yes'), defaultValue: 'false' },
      { ...field('INTEGER', 'count'), defaultValue: '4' },
      { ...field('JSON', 'json'), defaultValue: '{"ok":true}' },
    ];
    expect(recordDefaultValues(fields)).toEqual({
      money: '900719925474099312345.123456789',
      yes: false,
      count: 4,
      json: { ok: true },
    });
  });

  it('枚举标签有类型匹配，未知值保留原值', () => {
    const choice = {
      ...field('STRING'),
      options: [
        { value: 1, label: '数值一' },
        { value: '1', label: '文本一' },
        { value: false, label: '未通过' },
      ],
    };
    expect(recordDisplayValue(choice, 1)).toBe('数值一');
    expect(recordDisplayValue(choice, '1')).toBe('文本一');
    expect(recordDisplayValue(choice, false)).toBe('未通过');
    expect(recordDisplayValue(choice, 'old')).toBe('old');
  });

  it('缺失或伪造记录版本时拒绝提交并要求刷新', () => {
    expect(recordExpectedVersion({ optimisticLock: 4 })).toBe(4);
    for (const optimisticLock of [undefined, null, '4', -1, 1.5])
      expect(() => recordExpectedVersion({ optimisticLock })).toThrow('刷新');
  });
});

it('接口已返回只读归属仍可配置展示，隐藏不清空默认且只提交可写项', () => {
  const scope = { tenantId: 'tenant-a', domainId: 'domain-a', orgId: 'org-a' };
  const fields = operationFormFields(
    [
      {
        name: 'tenantId',
        title: '租户',
        type: 'STRING',
        source: 'SCOPE',
        referenceType: 'TENANT',
        nullable: true,
        defaultVisible: true,
      },
      {
        name: 'domainId',
        title: '平台领域',
        type: 'STRING',
        source: 'SCOPE',
        referenceType: 'DOMAIN',
        nullable: true,
        readOnly: true,
      },
      {
        name: 'orgId',
        title: '组织',
        type: 'STRING',
        source: 'SCOPE',
        referenceType: 'ORG',
        nullable: false,
      },
      {
        name: 'ownerId',
        title: '所有者',
        type: 'STRING',
        source: 'SCOPE',
        referenceType: 'USER',
        nullable: true,
      },
      {
        name: 'createTime',
        title: '创建时间',
        type: 'DATETIME',
        source: 'RECORD_SYSTEM',
        serverManaged: true,
      },
    ],
    [],
    scope,
  );
  expect(fields.map((field) => field.name)).toEqual([
    'tenantId',
    'domainId',
    'orgId',
    'ownerId',
  ]);
  expect(fields.find((field) => field.name === 'tenantId')).toMatchObject({
    defaultVisible: false,
    defaultValue: 'tenant-a',
  });
  expect(fields.find((field) => field.name === 'domainId')).toMatchObject({
    defaultVisible: false,
    defaultValue: 'domain-a',
    readOnly: true,
  });
  expect(fields.find((field) => field.name === 'orgId')?.defaultVisible).toBe(
    true,
  );
  expect(recordScopeValues(fields, scope)).toEqual({
    tenantId: 'tenant-a',
    orgId: 'org-a',
  });
  expect(recordScopeValues(fields, { ...scope, orgId: null })).toEqual({
    tenantId: 'tenant-a',
    orgId: null,
  });
  expect(recordScopeValues(fields, {})).toEqual({});
  expect(scope).toEqual({
    tenantId: 'tenant-a',
    domainId: 'domain-a',
    orgId: 'org-a',
  });
});
