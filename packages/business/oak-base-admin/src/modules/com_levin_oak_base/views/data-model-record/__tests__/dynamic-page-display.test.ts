import type {
  DataModelDefinition,
  DataModelOperation,
} from '../../../api/data-model-service';

import { describe, expect, it } from 'vitest';

import {
  isModelActionAllowed,
  modelDisplayCode,
} from '../dynamic-page-display';

const operation: DataModelOperation = {
  code: 'QUERY',
  title: '查询',
  method: 'POST',
  path: 'queryRecords',
  permissionExpr: 'model:QUERY',
  available: true,
  authorized: true,
  enabled: true,
  requestParams: [],
  responseParams: [],
};
const model: DataModelDefinition = {
  key: 'invoice',
  name: 'Invoice',
  title: '发票',
  fields: [],
  operations: [operation],
};
describe('模型公共展示入口与动作授权', () => {
  it('每个模型独立使用稳定的公共PageDisplay编码', () => {
    expect(modelDisplayCode('invoice')).toBe(
      '/clob/V1/DataModelRecord/invoice',
    );
    expect(() => modelDisplayCode('../unsafe')).toThrow('模型标识无效');
  });
  it('未声明、停用、未同步或未授权动作都不能显示入口', () => {
    expect(isModelActionAllowed(model, 'QUERY')).toBe(true);
    expect(isModelActionAllowed(model, 'CREATE')).toBe(false);
    for (const denied of [
      { enabled: false },
      { authorized: false },
      { available: false },
    ]) {
      expect(
        isModelActionAllowed(
          { ...model, operations: [{ ...operation, ...denied }] },
          'QUERY',
        ),
      ).toBe(false);
    }
  });
});
