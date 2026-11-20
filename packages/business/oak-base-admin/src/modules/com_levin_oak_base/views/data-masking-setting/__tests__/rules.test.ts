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
          schemaVersion: 2,
          treatment: 'REVERSIBLE_ID',
        },
      ]),
    ).toThrow('绑定范围');
  });

  it('保留完整的可还原 ID 规则', () => {
    const content = [
      {
        entityClass: 'example.Order',
        fieldName: 'id',
        schemaVersion: 2,
        treatment: 'REVERSIBLE_ID',
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
          schemaVersion: 2,
          treatment: 'REVERSIBLE_ID',
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
      schemaVersion: 2,
      treatment: 'HIDE',
    };
    expect(() => validateMaskingRuleContent([first, first])).toThrow('重复');
    expect(
      validateMaskingRuleContent([
        first,
        {
          entityClass: 'example.User',
          fieldName: 'name',
          schemaVersion: 2,
          treatment: 'MASK',
        },
      ]),
    ).toHaveLength(2);
  });

  it('旧版及夹带旧接口字段的配置必须重新配置', () => {
    const oldRule = {
      entityClass: 'example.Order',
      fieldName: 'id',
      treatment: 'HIDE',
    };
    expect(() => validateMaskingRuleContent([oldRule])).toThrow('重新配置');
    expect(() =>
      validateMaskingRuleContent([
        { ...oldRule, schemaVersion: 2, inputOperation: 'Order.read' },
      ]),
    ).toThrow('重新配置');
  });
});
