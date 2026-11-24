import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api-module', () => ({
  buildEnumOptionsLoader: (name: string) => name,
}));

import {
  subjectTypeOptionsLoader,
  toQuickAddSubjectTypeOptions,
} from '../subject-type-options';

describe('快捷新增主体类型', () => {
  it('使用法律主体枚举并保留选项名称，禁用不支持快捷开户的类型', () => {
    expect(subjectTypeOptionsLoader).toBe(
      'com.levin.oak.base.entities.enums.LegalSubjectType',
    );
    const options = toQuickAddSubjectTypeOptions([
      { label: '法人', value: 'Legal' },
      { label: '自然人', value: 'Person' },
      { label: '个体户', value: 'Individual' },
      { label: '非法人', value: 'NotLegal' },
      { label: '新类型', value: 'Future' },
    ]);
    expect(options.map((item) => item.label)).toEqual([
      '法人',
      '自然人',
      '个体户',
      '非法人',
      '新类型',
    ]);
    expect(
      options.filter((item) => item.disabled).map((item) => item.value),
    ).toEqual(['Person', 'Future']);
    expect(options[1]?.title).toContain('暂不支持快捷开户');
  });
});
