import type { DataModelField } from '../../../api/data-model-service';

import { describe, expect, it } from 'vitest';

import { validateFixedOptions } from '../field-options';

const field = (
  type: DataModelField['type'],
  values: unknown[],
): DataModelField => ({
  key: 'choice',
  name: 'choice',
  title: '选项',
  type,
  nullable: true,
  optionSource: 'FIXED',
  options: values as DataModelField['options'],
});

describe('动态字段固定选项', () => {
  it('保留布尔和安全整数的有类型值', () => {
    expect(
      validateFixedOptions(
        field('BOOLEAN', [
          { value: false, label: '否' },
          { value: true, label: '是' },
        ]),
      ),
    ).toBeUndefined();
    expect(
      validateFixedOptions(
        field('INTEGER', [
          { value: 0, label: '零' },
          { value: 2, label: '二' },
        ]),
      ),
    ).toBeUndefined();
  });

  it('拒绝空值、重复值、错型值和过量候选', () => {
    expect(
      validateFixedOptions(field('STRING', [{ value: '', label: '空' }])),
    ).toContain('不能为空');
    expect(
      validateFixedOptions(
        field('STRING', [
          { value: 'a', label: '甲' },
          { value: 'a', label: '乙' },
        ]),
      ),
    ).toContain('重复');
    expect(
      validateFixedOptions(field('BOOLEAN', [{ value: 'true', label: '是' }])),
    ).toContain('布尔值');
    expect(
      validateFixedOptions(
        field('INTEGER', [
          { value: 9_007_199_254_740_992, label: '超出安全范围' },
        ]),
      ),
    ).toContain('安全整数');
    expect(
      validateFixedOptions(
        field(
          'STRING',
          Array.from({ length: 201 }, (_, n) => ({
            value: String(n),
            label: String(n),
          })),
        ),
      ),
    ).toContain('200');
  });
});
