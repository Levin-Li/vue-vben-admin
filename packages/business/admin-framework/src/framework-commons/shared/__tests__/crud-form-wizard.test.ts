import { describe, expect, it } from 'vitest';

import { buildCrudWizardSteps, findCrudWizardStep } from '../crud-form-wizard';

describe('向导有效步骤', () => {
  it('按实际可见字段构建分组，并保留未分组区块', () => {
    const steps = buildCrudWizardSteps([
      { key: 'a', label: '甲', displayGroup: { key: 'base', title: '基本' } },
      { key: 'b', label: '乙', displayGroup: { key: 'base' } },
      { key: 'c', label: '丙' },
      { key: 'd', label: '丁', displayGroup: { key: 'other', title: '其他' } },
    ]);
    expect(steps.map((step) => step.fields.map((field) => field.key))).toEqual([
      ['a', 'b'],
      ['c'],
      ['d'],
    ]);
    expect(steps.length >= 3).toBe(true);
    expect(findCrudWizardStep(steps, 'd')).toBe(2);
    expect(findCrudWizardStep(steps, 'hidden')).toBe(-1);
  });

  it('无字段的组不产生步骤，相同组聚合且不修改字段', () => {
    const fields = [
      { key: 'a', label: '甲', displayGroup: { key: 'same' } },
      { key: 'b', label: '乙', displayGroup: { key: 'other' } },
      { key: 'c', label: '丙', displayGroup: { key: 'same' } },
    ];
    const before = JSON.stringify(fields);
    const steps = buildCrudWizardSteps(fields);
    expect(steps.map((step) => step.fields.map((field) => field.key))).toEqual([
      ['a', 'c'],
      ['b'],
    ]);
    expect(steps.length >= 3).toBe(false);
    expect(JSON.stringify(fields)).toBe(before);
    expect(buildCrudWizardSteps([])).toEqual([]);
  });

  it('静态分组未形成展示组时按未分组处理', () => {
    const steps = buildCrudWizardSteps([
      { key: 'a', label: '甲', layoutGroup: 'one' },
      { key: 'b', label: '乙', layoutGroup: 'two' },
      { key: 'c', label: '丙', layoutGroup: 'three' },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.fields.map((field) => field.key)).toEqual(['a', 'b', 'c']);
  });

  it('合并被展示组隔开的未分组字段并保持相对顺序', () => {
    const steps = buildCrudWizardSteps([
      { key: 'a', label: '甲', displayGroup: { key: 'base', title: '基础' } },
      { key: 'b', label: '乙' },
      { key: 'c', label: '丙', displayGroup: { key: 'content', title: '内容' } },
      { key: 'd', label: '丁' },
      { key: 'e', label: '戊', displayGroup: { key: 'base' } },
      { key: 'f', label: '己' },
    ]);
    expect(steps.map((step) => step.title)).toEqual(['基础', '其他信息', '内容']);
    expect(steps.map((step) => step.fields.map((field) => field.key))).toEqual([
      ['a', 'e'],
      ['b', 'd', 'f'],
      ['c'],
    ]);
    expect(findCrudWizardStep(steps, 'f')).toBe(1);
  });

  it('合并后不足三个有效步骤时不满足向导资格', () => {
    const steps = buildCrudWizardSteps([
      { key: 'a', label: '甲' },
      { key: 'b', label: '乙', displayGroup: { key: 'base' } },
      { key: 'c', label: '丙' },
    ]);
    expect(steps).toHaveLength(2);
    expect(steps[0]?.fields.map((field) => field.key)).toEqual(['a', 'c']);
  });
});
