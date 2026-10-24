import type { DataModelField } from '../../../api/data-model-service';

import { describe, expect, it } from 'vitest';

import {
  allowedQueryOperators,
  queryFieldOptions,
  reservedModelFieldNames,
  withFieldUsageDefaults,
} from '../field-usage';

describe('动态模型字段查询配置', () => {
  it('系统固定属性不能被业务字段占用', () => {
    expect(reservedModelFieldNames.has('tenantId')).toBe(true);
    expect(reservedModelFieldNames.has('scopeKind')).toBe(true);
    expect(reservedModelFieldNames.has('custom_amount')).toBe(false);
  });
  it('按类型限制操作符', () => {
    expect(allowedQueryOperators('STRING')).toEqual(['EQ', 'CONTAINS']);
    expect(allowedQueryOperators('MONEY')).toEqual([
      'EQ',
      'GT',
      'GTE',
      'LT',
      'LTE',
    ]);
    expect(allowedQueryOperators('BOOLEAN')).toEqual(['EQ']);
    expect(allowedQueryOperators('JSON')).toEqual([]);
  });

  it('老字段默认列表、新增、编辑与详情可见，查询操作符按类型裁剪', () => {
    const field = withFieldUsageDefaults({
      key: 'flag',
      name: 'flag',
      title: '标记',
      type: 'BOOLEAN',
      nullable: true,
      queryEnabled: true,
      queryOperators: ['EQ', 'CONTAINS'],
    });
    expect(field).toMatchObject({
      listEnabled: true,
      createEnabled: true,
      editEnabled: true,
      detailEnabled: true,
      queryEnabled: true,
      queryOperators: ['EQ'],
    });
  });

  it('动态查询只展示字段已配置且与类型兼容的操作符', () => {
    const field: DataModelField = {
      key: 'amount',
      name: 'amount',
      title: '金额',
      type: 'MONEY',
      nullable: true,
      queryEnabled: true,
      queryOperators: ['EQ', 'GTE', 'CONTAINS'],
    };
    expect(queryFieldOptions(field)).toEqual(['EQ', 'GTE']);
  });
});
