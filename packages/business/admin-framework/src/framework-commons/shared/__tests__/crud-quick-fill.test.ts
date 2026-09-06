import type { CrudFieldConfig } from '../types';

import { describe, expect, it } from 'vitest';

import { resolveCrudQuickFill } from '../crud-quick-fill';

const fields = (count: number, required: number): CrudFieldConfig[] =>
  Array.from({ length: count }, (_, i) => ({
    key: `f${i}`,
    label: `字段${i}`,
    required: i < required,
    layoutGroup: `g${i % 3}`,
  }));
const resolve = (
  data: CrudFieldConfig[],
  writable = data.map((field) => field.key),
  complex: string[] = [],
) => resolveCrudQuickFill(data, new Set(writable), new Set(complex));
describe('快捷填写最终字段处理', () => {
  it.each([
    [7, 1, false],
    [8, 0, false],
    [8, 1, true],
    [8, 4, true],
    [8, 5, false],
  ])('字段 %i、必填 %i 的资格为 %s', (count, required, eligible) => {
    expect(resolve(fields(count as number, required as number)).eligible).toBe(
      eligible,
    );
  });
  it('稳定前置必填项，不按分组数量限制且不修改源数组或字段', () => {
    const data = fields(9, 0);
    data[2].required = true;
    data[7].required = true;
    const snapshot = JSON.stringify(data);
    const result = resolve(data);
    expect(result.eligible).toBe(true);
    expect(result.orderedFields.map((field) => field.key)).toEqual([
      'f2',
      'f7',
      'f0',
      'f1',
      'f3',
      'f4',
      'f5',
      'f6',
      'f8',
    ]);
    expect(JSON.stringify(data)).toBe(snapshot);
    expect(result.firstOptionalKey).toBe('f0');
  });
  it('只统计可填写字段，隐藏字段由上游排除', () => {
    const data = fields(9, 2);
    expect(
      resolve(
        data,
        data.slice(0, 7).map((field) => field.key),
      ).eligible,
    ).toBe(false);
    expect(resolve(data.slice(0, 7)).eligible).toBe(false);
    expect(
      resolve(
        data,
        data.slice(2).map((field) => field.key),
      ).eligible,
    ).toBe(false);
  });
  it.each([
    { complexValue: true },
    { complexGroupKey: 'nested' },
    { type: 'json' as const },
  ])('排除显式复杂属性 %j', (extra) => {
    const data = fields(8, 1);
    Object.assign(data[7], extra);
    expect(resolve(data).eligible).toBe(false);
  });
  it('扁平且没有独立分组的对象映射仍排除，隐藏复杂字段不参与', () => {
    const data = fields(9, 1);
    expect(resolve(data, undefined, ['f8']).eligible).toBe(false);
    expect(resolve(data.slice(0, 8), undefined, ['f8']).eligible).toBe(true);
  });
  it('基础类型数组不误判为复杂对象，也不按实际值猜测', () => {
    const data = fields(8, 1);
    data[7].type = 'tags';
    data[7].defaultValue = [];
    expect(resolve(data).eligible).toBe(true);
  });
  it('不允许自定义文本的选择器仍可填写且必填项仍前置', () => {
    const data = fields(8, 1);
    const select = data.find((field) => field.key === 'f0');
    if (!select) throw new Error('缺少测试字段');
    Object.assign(select, { type: 'select', allowInput: false });
    const result = resolve(data);
    expect(result.eligible).toBe(true);
    expect(result.requiredKeys.has('f0')).toBe(true);
  });
});
