import type { RuntimeQueryField } from '../record-query';

import { describe, expect, it } from 'vitest';

import { buildRecordQueryValues } from '../record-query';

const input = (
  key: string,
  field = 'amount',
  operator: RuntimeQueryField['operator'] = 'GTE',
): RuntimeQueryField => ({
  key,
  field,
  operator,
  title: '金额下限（含）',
  type: 'MONEY',
  defaultVisible: true,
});

describe('动态记录固定查询参数', () => {
  it('金额范围只发送固定参数键和值，不发送字段和操作符', () => {
    const values = buildRecordQueryValues(
      [input('__query_f_a_gte'), input('__query_f_a_lte', 'amount', 'LTE')],
      {
        __query_f_a_gte: '999999999999999999.123456',
        __query_f_a_lte: '999999999999999999.999999',
        tenantId: 'forged',
        operator: 'DROP',
      },
    );
    expect(values).toEqual({
      __query_f_a_gte: '999999999999999999.123456',
      __query_f_a_lte: '999999999999999999.999999',
    });
    expect(JSON.stringify(values)).not.toContain('operator');
  });
  it('保留布尔false和整数零，忽略空值与未知键', () => {
    const fields = [
      { ...input('__query_s_enable_eq', 'enable', 'EQ'), type: 'BOOLEAN' },
      { ...input('__query_f_count_eq', 'count', 'EQ'), type: 'INTEGER' },
    ];
    expect(
      buildRecordQueryValues(fields, {
        __query_s_enable_eq: false,
        __query_f_count_eq: 0,
        unknown: 'x',
      }),
    ).toEqual({ __query_s_enable_eq: false, __query_f_count_eq: 0 });
  });
  it('阻止无效查询值与超过服务端上限的条件集合', () => {
    const fields = Array.from({ length: 21 }, (_, index) =>
      input(`__query_${index}`),
    );
    const values = Object.fromEntries(fields.map((field) => [field.key, 'x']));
    expect(() => buildRecordQueryValues(fields, values)).toThrow('最多 20');
    expect(() =>
      buildRecordQueryValues([input('a')], { a: { operator: 'EQ' } }),
    ).toThrow('无效');
  });
});

it('日期时间范围使用定义阶段固定的GTE/LTE参数，页面只提交上下界值', () => {
  const fields: RuntimeQueryField[] = [
    { ...input('__query_date_gte', 'date', 'GTE'), type: 'DATE' },
    { ...input('__query_date_lte', 'date', 'LTE'), type: 'DATE' },
    { ...input('__query_time_gte', 'time', 'GTE'), type: 'TIME' },
    { ...input('__query_time_lte', 'time', 'LTE'), type: 'TIME' },
    { ...input('__query_datetime_gte', 'datetime', 'GTE'), type: 'DATETIME' },
    { ...input('__query_datetime_lte', 'datetime', 'LTE'), type: 'DATETIME' },
  ];
  const values = buildRecordQueryValues(fields, {
    __query_date_gte: '2026-10-01',
    __query_date_lte: '2026-10-31',
    __query_time_gte: '08:00:00.123456',
    __query_time_lte: '18:30:00.654321',
    __query_datetime_gte: '2026-10-01T08:00:00+08:00',
    __query_datetime_lte: '2026-10-31T18:30:00+08:00',
  });
  expect(values).toEqual({
    __query_date_gte: '2026-10-01',
    __query_date_lte: '2026-10-31',
    __query_time_gte: '08:00:00.123456',
    __query_time_lte: '18:30:00.654321',
    __query_datetime_gte: '2026-10-01T00:00:00.000Z',
    __query_datetime_lte: '2026-10-31T10:30:00.000Z',
  });
  expect(Object.keys(values)).not.toContain('operator');
});
