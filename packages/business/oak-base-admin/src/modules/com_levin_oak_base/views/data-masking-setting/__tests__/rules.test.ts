import { describe, expect, it } from 'vitest';

import { validateMaskingRuleContent } from '../rules';

describe('数据脱敏字段规则', () => {
  it('拒绝没有字段或不完整的可还原 ID 配置', () => {
    expect(() => validateMaskingRuleContent([])).toThrow('至少选择');
    expect(() =>
      validateMaskingRuleContent([
        {
          entityClass: 'example.Order',
          fieldName: 'id',
          treatment: 'REVERSIBLE_ID',
        },
      ]),
    ).toThrow('输入接口');
  });

  it('保留完整的可还原 ID 规则', () => {
    const content = [
      {
        entityClass: 'example.Order',
        fieldName: 'id',
        treatment: 'REVERSIBLE_ID',
        inputOperation: 'Order.detail',
        inputFieldPath: 'id',
        binding: 'USER',
        validSeconds: 1800,
      },
    ];
    expect(validateMaskingRuleContent(content)).toBe(content);
  });

  it('拒绝超过服务端一天上限的有效期', () => {
    expect(() =>
      validateMaskingRuleContent([
        {
          entityClass: 'example.Order',
          fieldName: 'id',
          treatment: 'REVERSIBLE_ID',
          inputOperation: 'Order.detail',
          inputFieldPath: 'id',
          binding: 'USER',
          validSeconds: 86_401,
        },
      ]),
    ).toThrow('86400');
  });

  it('拒绝同一实体字段重复配置并允许多个实体', () => {
    const first = {
      entityClass: 'example.Order',
      fieldName: 'id',
      treatment: 'HIDE',
    };
    expect(() => validateMaskingRuleContent([first, first])).toThrow('重复');
    expect(
      validateMaskingRuleContent([
        first,
        { entityClass: 'example.User', fieldName: 'name', treatment: 'MASK' },
      ]),
    ).toHaveLength(2);
  });
});
