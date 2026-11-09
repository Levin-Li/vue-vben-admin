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
});
