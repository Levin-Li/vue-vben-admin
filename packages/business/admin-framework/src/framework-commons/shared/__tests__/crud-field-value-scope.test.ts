import type {
  DataAttrPolicy,
  DataAttrValueFieldBinding,
} from '../../data-attr-policy';

import { afterEach, describe, expect, it } from 'vitest';

import {
  allowedFieldValues,
  assertFieldValueAssignment,
  assertValueScopeContract,
  clearFieldValueGrants,
  initializeFieldValueGrants,
} from '../crud-field-value-scope';

const operation = 'example:业务数据-伙伴::新增';
const field = (
  attribute: string,
  sourceKind: 'dict' | 'enum',
): DataAttrValueFieldBinding => ({
  attribute,
  entityClass: 'example.Partner',
  sourceKind,
  sourceKey: `${sourceKind}.source`,
  location: 'body',
  parameterIndex: 0,
  modelPath: [attribute],
  wirePath: [attribute],
  mapped: true,
});
const kind = field('kind', 'enum');
const level = field('level', 'dict');
const policy = { operation, valueFields: [kind, level] } as DataAttrPolicy;
const grants = {
  version: 1,
  allowed: [
    {
      operation,
      entityClass: 'example.Partner',
      state: 'limited' as const,
      fields: [kind, level],
      branches: [
        { kind: ['A'], level: ['VIP'] },
        { kind: ['B'], level: ['NORMAL'] },
      ],
    },
  ],
};

afterEach(clearFieldValueGrants);
describe('字段值数据范围的表单选项', () => {
  it('只从与其他字段当前值兼容的完整角色分支提供值', () => {
    initializeFieldValueGrants(grants);
    expect(allowedFieldValues(policy, 'kind', {})).toEqual(new Set(['A', 'B']));
    expect(allowedFieldValues(policy, 'kind', { level: 'VIP' })).toEqual(
      new Set(['A']),
    );
    expect(allowedFieldValues(policy, 'level', { kind: 'B' })).toEqual(
      new Set(['NORMAL']),
    );
    expect(allowedFieldValues(policy, 'kind', { level: 'UNKNOWN' })).toEqual(
      new Set(),
    );
    expect(allowedFieldValues(policy, 'kind', {}, true)).toEqual(new Set());
  });
  it('快照缺失、拒绝、来源不符、歧义及未映射字段均失败关闭', () => {
    expect(allowedFieldValues(policy, 'kind', {})).toEqual(new Set());
    initializeFieldValueGrants({
      version: 1,
      allowed: grants.allowed.map((entry) => ({ ...entry, state: 'denied' })),
    });
    expect(allowedFieldValues(policy, 'kind', {})).toEqual(new Set());
    initializeFieldValueGrants(grants);
    expect(
      allowedFieldValues(
        { ...policy, valueFields: [{ ...kind, sourceKey: 'other' }] },
        'kind',
        {},
      ),
    ).toEqual(new Set());
    expect(
      allowedFieldValues(
        { ...policy, valueFields: [kind, { ...kind, entityClass: 'other' }] },
        'kind',
        {},
      ),
    ).toEqual(new Set());
    expect(
      allowedFieldValues(
        { ...policy, valueFields: [{ ...kind, mapped: false }] },
        'kind',
        {},
      ),
    ).toEqual(new Set());
    expect(allowedFieldValues(policy, 'plain', {})).toBeUndefined();
  });
  it('按接口隔离授权；无效快照不残留旧授权', () => {
    initializeFieldValueGrants(grants);
    expect(
      allowedFieldValues(
        { ...policy, operation: 'example:业务数据-伙伴::修改' },
        'kind',
        {},
      ),
    ).toEqual(new Set());
    expect(() =>
      initializeFieldValueGrants({ version: 2, allowed: [] }),
    ).toThrow();
    expect(allowedFieldValues(policy, 'kind', {})).toEqual(new Set());
  });

  it('确认不在请求中的字段不阻断其他字段，但未知映射和缺失契约失败关闭', () => {
    initializeFieldValueGrants(grants);
    const absent = {
      ...level,
      mapped: false,
      mappingStatus: 'absent' as const,
      location: null,
      parameterIndex: -1,
      modelPath: [],
      wirePath: [],
    };
    const partial = { ...policy, valueFields: [kind, absent] };
    expect(() => assertValueScopeContract(partial)).not.toThrow();
    expect(allowedFieldValues(partial, 'plain', {})).toBeUndefined();
    expect(allowedFieldValues(partial, 'kind', {})).toEqual(new Set());
    expect(() =>
      assertValueScopeContract({
        ...policy,
        valueFields: [{ ...absent, mappingStatus: 'unknown' }],
      }),
    ).toThrow();
    expect(() =>
      assertValueScopeContract({ ...policy, valueFields: undefined }),
    ).toThrow();
    clearFieldValueGrants();
    expect(() => assertValueScopeContract(policy)).toThrow();
  });

  it('拒绝缺少受控字段的伪完整分支', () => {
    const malformed = {
      ...grants,
      allowed: grants.allowed.map((entry) => ({
        ...entry,
        branches: [{ kind: ['A'] }],
      })),
    };
    expect(() => initializeFieldValueGrants(malformed)).toThrow();
    expect(allowedFieldValues(policy, 'kind', {})).toEqual(new Set());
  });

  it('提交时校验完整分支，并允许不改变受控字段的普通修改', () => {
    initializeFieldValueGrants(grants);
    expect(() =>
      assertFieldValueAssignment(
        policy,
        { kind: 'A', level: 'VIP' },
        {},
        false,
      ),
    ).not.toThrow();
    expect(() =>
      assertFieldValueAssignment(
        policy,
        { kind: 'A', level: 'NORMAL' },
        {},
        false,
      ),
    ).toThrow();
    expect(() =>
      assertFieldValueAssignment(
        policy,
        { kind: 'B' },
        { kind: 'A', level: 'VIP' },
        true,
      ),
    ).toThrow();
    expect(() =>
      assertFieldValueAssignment(
        policy,
        { kind: 'B', level: 'NORMAL' },
        { kind: 'A', level: 'VIP' },
        true,
      ),
    ).not.toThrow();
    expect(() =>
      assertFieldValueAssignment(policy, { name: '普通字段' }, {}, true),
    ).not.toThrow();
    expect(() =>
      assertFieldValueAssignment(policy, { kind: 'B' }, { kind: 'A' }, true),
    ).toThrow();
  });

  it('点号键和嵌套请求均受检查，重复写法冲突时拒绝', () => {
    initializeFieldValueGrants(grants);
    const nested = {
      ...policy,
      valueFields: [
        {
          ...kind,
          modelPath: ['profile', 'kind'],
          wirePath: ['profile', 'kind'],
        },
        level,
      ],
    };
    expect(() =>
      assertFieldValueAssignment(
        nested,
        { 'profile.kind': 'A', level: 'VIP' },
        {},
        false,
      ),
    ).not.toThrow();
    expect(() =>
      assertFieldValueAssignment(
        nested,
        { 'profile.kind': 'B', level: 'VIP' },
        {},
        false,
      ),
    ).toThrow();
    expect(() =>
      assertFieldValueAssignment(
        nested,
        { profile: { kind: 'B' }, level: 'VIP' },
        {},
        false,
      ),
    ).toThrow();
    expect(() =>
      assertFieldValueAssignment(
        nested,
        { 'profile.kind': 'A', profile: { kind: 'B' }, level: 'VIP' },
        {},
        false,
      ),
    ).toThrow('受控字段请求值存在歧义');
    expect(() =>
      assertFieldValueAssignment(
        nested,
        { 'profile.kind': 'A', profile: { kind: 'A' }, level: 'VIP' },
        {},
        false,
      ),
    ).not.toThrow();
  });
});
