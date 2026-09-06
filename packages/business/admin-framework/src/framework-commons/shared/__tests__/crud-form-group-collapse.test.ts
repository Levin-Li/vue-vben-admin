import type { CrudFieldConfig } from '../types';

import { describe, expect, it } from 'vitest';

import { resolveCrudFormGroupCollapse } from '../crud-form-group-collapse';

const field = (
  key: string,
  group: string,
  extra: Partial<CrudFieldConfig> = {},
): CrudFieldConfig => ({
  key,
  label: key,
  displayGroup: { key: group },
  ...extra,
});

describe('新增编辑分组初始折叠', () => {
  it('三个分组不覆盖现有配置，四个分组开始应用规则', () => {
    const fields = ['a', 'b', 'c'].map((key) => field(key, key));
    expect(resolveCrudFormGroupCollapse(fields, {})).toEqual({
      rows: {},
      collapsed: {},
    });
    expect(
      resolveCrudFormGroupCollapse([...fields, field('d', 'd')], {}).rows,
    ).toEqual({ a: 'all', b: 0, c: 0, d: 0 });
  });

  it('任意必填字段或自定义校验使所在分组展开，不看已有值', () => {
    const result = resolveCrudFormGroupCollapse(
      [
        field('a', 'a'),
        field('a2', 'a', { required: true, defaultValue: '已填写' }),
        field('b', 'b', { validator: () => undefined }),
        field('c', 'c'),
        field('d', 'd'),
      ],
      {},
    );
    expect(result.rows).toEqual({ a: 'all', b: 'all', c: 0, d: 0 });
  });

  it('只统计传入的可见非空命名分组，无归属字段不增加组数', () => {
    expect(
      resolveCrudFormGroupCollapse(
        [
          field('a', 'a'),
          field('b', 'b'),
          field('c', 'c'),
          field('c2', 'c'),
          { key: 'plain', label: '无分组' },
        ],
        {},
      ).rows,
    ).toEqual({});
  });

  it('复杂对象分组参与计数但不更改提交勾选', () => {
    const enabled = { a: false, b: true };
    const result = resolveCrudFormGroupCollapse(
      [
        field('a', 'a', { complexGroupKey: 'a', required: true }),
        field('b', 'b', { complexGroupKey: 'b', required: true }),
        field('c', 'c'),
        field('d', 'd'),
      ],
      enabled,
    );
    expect(result).toEqual({
      rows: { c: 0, d: 0 },
      collapsed: { a: true, b: false },
    });
    expect(enabled).toEqual({ a: false, b: true });
  });

  it('不同类型的同名分组不混用状态', () => {
    const result = resolveCrudFormGroupCollapse(
      [
        field('a', 'same', { required: true }),
        field('b', 'same', { complexGroupKey: 'same' }),
        field('c', 'c'),
        field('d', 'd'),
      ],
      { same: true },
    );
    expect(result).toEqual({
      rows: { same: 'all', c: 0, d: 0 },
      collapsed: { same: true },
    });
  });
  it('全可选分组按实际展示顺序展开第一组', () => {
    const result = resolveCrudFormGroupCollapse(
      ['z', 'b', 'a', 'c'].map((key) => field(key, key)),
      {},
    );
    expect(result.rows).toEqual({ z: 'all', b: 0, a: 0, c: 0 });
  });

  it('三个及以下分组的全收起配置也展开首组', () => {
    expect(
      resolveCrudFormGroupCollapse(
        [field('a', 'a'), field('b', 'b')],
        {},
        { rows: { a: 0, b: 0 } },
      ).rows,
    ).toEqual({ a: 'all' });
    expect(
      resolveCrudFormGroupCollapse(
        [field('a', 'a'), field('b', 'b')],
        {},
        { rows: { a: 0, b: 1 } },
      ).rows,
    ).toEqual({});
  });

  it('首组是复杂分组时仅展开，不改变未勾选提交状态', () => {
    const enabled = { first: false };
    const result = resolveCrudFormGroupCollapse(
      [
        field('first', 'first', { complexGroupKey: 'first' }),
        field('b', 'b'),
        field('c', 'c'),
        field('d', 'd'),
      ],
      enabled,
    );
    expect(result.collapsed.first).toBe(false);
    expect(result.rows).toEqual({ b: 0, c: 0, d: 0 });
    expect(enabled.first).toBe(false);
    expect(resolveCrudFormGroupCollapse([], {})).toEqual({
      rows: {},
      collapsed: {},
    });
  });
});
