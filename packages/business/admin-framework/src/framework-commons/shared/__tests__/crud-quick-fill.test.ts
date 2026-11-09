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
  it('显式前置字段与必填字段一起显示', () => {
    const data: CrudFieldConfig[] = [
      { key: 'tenantId', label: '租户' },
      { key: 'target', label: '目标', required: true },
      { key: 'remark', label: '备注' },
    ];
    const plan = resolveCrudQuickFill(
      data,
      new Set(['remark', 'target', 'tenantId']),
      new Set(),
      new Set(['tenantId']),
    );
    expect([...plan.requiredKeys]).toEqual(['tenantId', 'target']);
    expect(plan.firstOptionalKey).toBe('remark');
  });
  it.each([
    [7, 1, true],
    [8, 0, false],
    [8, 1, true],
    [8, 4, true],
    [8, 5, true],
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
    ).toBe(true);
    expect(resolve(data.slice(0, 7)).eligible).toBe(true);
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
  ])('复杂必填字段仍可填写 %j', (extra) => {
    const data = fields(8, 1);
    Object.assign(data[0]!, extra);
    const result = resolve(data);
    expect(result.eligible).toBe(true);
    expect(result.orderedFields[0]).toBe(data[0]);
  });
  it('对象映射不影响快捷资格', () => {
    const data = fields(9, 1);
    expect(resolve(data, undefined, ['f8']).eligible).toBe(true);
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
