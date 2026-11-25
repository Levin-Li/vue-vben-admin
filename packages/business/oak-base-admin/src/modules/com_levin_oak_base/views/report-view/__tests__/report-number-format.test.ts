import { describe, expect, it } from 'vitest';

import { formatReportAxis, formatReportNumber } from '../report-number-format';

describe('报表金额与数量', () => {
  it('按四位分组并保留悬停低位前导零和小数', () => {
    expect(formatReportNumber('120000123.45', { kind: 'MONEY' })).toEqual({
      text: '1,2000,0123.45元',
      hint: '1亿2000万0123.45元',
    });
    expect(
      formatReportNumber('100020003', { kind: 'QUANTITY', unit: '笔' }),
    ).toEqual({
      text: '1,0002,0003笔',
      hint: '1亿0002万0003笔',
    });
    expect(formatReportNumber('-10001', { kind: 'QUANTITY' })).toEqual({
      text: '-1,0001',
      hint: '-1万0001',
    });
  });

  it('不损失大整数或小数精度，也不格式化普通字段和脱敏值', () => {
    expect(
      formatReportNumber('12345678901234567890.0100', {
        kind: 'MONEY',
        unit: '',
      }).text,
    ).toBe('1234,5678,9012,3456,7890.0100');
    expect(formatReportNumber('***', { kind: 'MONEY' }).text).toBe('***');
    expect(formatReportNumber('12345678', { kind: 'PLAIN' }).text).toBe(
      '12345678',
    );
    expect(formatReportAxis(12_345_678)).toBe('1234,5678');
    expect(formatReportNumber('1.2e5', { kind: 'QUANTITY' }).text).toBe(
      '12,0000',
    );
  });

  it('整万及整亿的小数悬停时保留小数所属的低位', () => {
    expect(formatReportNumber('10000.25', { kind: 'MONEY' })).toEqual({
      text: '1,0000.25元',
      hint: '1万0000.25元',
    });
    expect(formatReportNumber('-100000000.0100', { kind: 'QUANTITY' })).toEqual({
      text: '-1,0000,0000.0100',
      hint: '-1亿0000.0100',
    });
  });
});
