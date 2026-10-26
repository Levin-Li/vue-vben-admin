import type { DataModelQueryInput } from '../../../api/data-model-service';

import { describe, expect, it } from 'vitest';

import {
  derivedQueryColumn,
  validateQueryInputMapping,
  withQueryMappingCandidate,
} from '../query-input-mapping';

const input = (key: string): DataModelQueryInput => ({
  key,
  field: 'invoiceTotal',
  operator: 'GTE',
  title: '最低金额',
  type: 'MONEY',
  defaultVisible: true,
});

describe('查询参数映射', () => {
  it('参数键与只读派生列分离', () => {
    expect(derivedQueryColumn(input('minimumAmount').field)).toBe(
      'invoice_total',
    );
    expect(validateQueryInputMapping([input('minimumAmount')])).toBeUndefined();
  });

  it('可在已有自动参数旁保存自定义参数', () => {
    expect(
      validateQueryInputMapping([
        input('__query_s_enable_eq'),
        input('__query_f_status_eq'),
        input('minimumAmount'),
      ]),
    ).toBeUndefined();
    expect(validateQueryInputMapping([input('constructor')])).toContain(
      '参数键',
    );
  });

  it('切换字段和操作符后保留对外参数键', () => {
    const changed = withQueryMappingCandidate(input('minimumAmount'), {
      ...input('candidateKey'),
      field: 'approvedAmount',
      operator: 'LTE',
      title: '批准金额上限',
    });
    expect(changed).toMatchObject({
      key: 'minimumAmount',
      field: 'approvedAmount',
      operator: 'LTE',
      title: '最低金额',
    });
  });

  it('拒绝非法和重复参数键', () => {
    expect(
      validateQueryInputMapping([
        input('minimumAmount'),
        input('minimumAmount'),
      ]),
    ).toContain('重复');
    expect(validateQueryInputMapping([input('invoice_total;drop')])).toContain(
      '参数键',
    );
  });
});
