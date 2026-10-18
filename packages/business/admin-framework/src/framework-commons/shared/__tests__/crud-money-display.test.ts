import { describe, expect, it } from 'vitest';

import {
  formatCrudMoneyValue,
  getCrudMoneyUnitHint,
  isCrudMoneyField,
} from '../crud-money-display';
import { formatDetailDisplayValue } from '../detail-display';

const amount = { key: 'amount', label: '金额', type: 'number' } as const;

describe('标准 CRUD 金额展示', () => {
  it('列表与详情默认四位分组、单位为元，提示使用中文数量级', () => {
    expect(formatCrudMoneyValue(amount, '1234567890.12')).toBe(
      '12,3456,7890.12元',
    );
    expect(getCrudMoneyUnitHint(amount, '1234567890.12')).toBe(
      '12亿3456万7890.12元',
    );
    expect(
      formatDetailDisplayValue({
        field: amount,
        key: 'amount',
        kind: 'scalar',
        label: '金额',
        value: '1234567890.12',
      }),
    ).toBe('12,3456,7890.12元');
  });

  it('保留大整数、小数、负号和零，不经浮点数舍入', () => {
    expect(formatCrudMoneyValue(amount, '-12345678901234567890.001200')).toBe(
      '-1234,5678,9012,3456,7890.001200元',
    );
    expect(formatCrudMoneyValue(amount, '0.00')).toBe('0.00元');
    expect(getCrudMoneyUnitHint(amount, '100000001.05')).toBe('1亿1.05元');
    expect(getCrudMoneyUnitHint(amount, '9999.99')).toBeUndefined();
  });

  it('允许页面覆盖单位、分组和提示，并能显式排除误识别字段', () => {
    const overridden = {
      ...amount,
      moneyDisplay: {
        chineseUnitTooltip: false,
        grouping: 'three' as const,
        unit: '美元',
      },
    };
    expect(formatCrudMoneyValue(overridden, '1234567890.12')).toBe(
      '1,234,567,890.12美元',
    );
    expect(getCrudMoneyUnitHint(overridden, '1234567890.12')).toBeUndefined();
    expect(
      formatCrudMoneyValue(
        { ...amount, moneyDisplay: { grouping: 'none', unit: '' } },
        '1234567890.12',
      ),
    ).toBe('1234567890.12');
    expect(
      getCrudMoneyUnitHint(
        { ...amount, moneyDisplay: { grouping: 'none', unit: '' } },
        '1234567890.12',
      ),
    ).toBe('12亿3456万7890.12');
    expect(
      isCrudMoneyField({ ...amount, moneyDisplay: { money: false } }),
    ).toBe(false);
    expect(
      isCrudMoneyField({ key: 'feeRate', label: '费率', type: 'number' }),
    ).toBe(false);
    expect(
      isCrudMoneyField({
        key: 'custom',
        label: '自定义',
        type: 'number',
        moneyDisplay: { money: true },
      }),
    ).toBe(true);
  });

  it('非金额字段的详情与无法识别的值保持原有文本', () => {
    expect(
      formatDetailDisplayValue({
        field: { key: 'count', label: '数量', type: 'number' },
        key: 'count',
        kind: 'scalar',
        label: '数量',
        value: 123_456,
      }),
    ).toBe('123456');
    expect(formatCrudMoneyValue(amount, 'not-a-number')).toBe('not-a-number');
    expect(getCrudMoneyUnitHint(amount, 'not-a-number')).toBeUndefined();
  });
});
