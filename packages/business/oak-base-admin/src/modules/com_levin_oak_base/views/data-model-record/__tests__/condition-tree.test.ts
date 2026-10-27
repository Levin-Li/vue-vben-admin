import type { DataModelQueryInput } from '../../../api/data-model-service';

import { describe, expect, it, vi } from 'vitest';

import { dataModelService } from '../../../api/data-model-service';
import {
  buildConditionDefinition,
  canAddCondition,
  newCondition,
} from '../condition-tree';

const inputs = ['amount', 'status', 'category'].map((key) => ({
  key,
  field: key,
  operator: 'EQ',
  title: key,
  type: 'STRING',
  defaultVisible: true,
})) as DataModelQueryInput[];

const param = (key: string) => ({ type: 'PARAM' as const, key });

describe('query 接口定义中的查询条件', () => {
  it('仅保存逻辑结构和参数键，不保存值或物理字段', () => {
    const definition = buildConditionDefinition(
      {
        type: 'AND',
        children: [
          { type: 'OR', children: [param('amount'), param('status')] },
          { type: 'NOT', child: param('category') },
        ],
      },
      inputs,
    );
    expect(definition).toEqual({
      type: 'AND',
      children: [
        { type: 'OR', children: [param('amount'), param('status')] },
        { type: 'NOT', child: param('category') },
      ],
    });
    expect(JSON.stringify(definition)).not.toMatch(/field|operator|value/);
  });

  it('拒绝未知键、遗漏参数、空组和过深结构', () => {
    expect(() => buildConditionDefinition(param('unknown'), inputs)).toThrow(
      '已定义',
    );
    expect(() => buildConditionDefinition(param('amount'), inputs)).toThrow(
      '全部查询参数',
    );
    expect(() =>
      buildConditionDefinition({ type: 'AND', children: [] }, inputs),
    ).toThrow('至少');
    const tooWide = {
      type: 'AND' as const,
      children: Array.from({ length: 21 }, () => param('amount')),
    };
    expect(() => buildConditionDefinition(tooWide, inputs.slice(0, 1))).toThrow(
      '最多20项',
    );
    let deep = param('amount') as ReturnType<typeof newCondition>;
    for (let i = 0; i < 6; i++) deep = { type: 'NOT', child: deep };
    expect(() => buildConditionDefinition(deep, inputs.slice(0, 1))).toThrow(
      '层级',
    );
    expect(canAddCondition(tooWide, 1)).toBe(false);
  });

  it('运行请求只传已填写的参数值', async () => {
    const transport = vi
      .spyOn(
        dataModelService as unknown as {
          request: (options: unknown) => Promise<unknown>;
        },
        'request',
      )
      .mockResolvedValue({ items: [], total: 0 });
    await dataModelService.queryRecords('invoice', {
      queryValues: { status: 'OPEN' },
    });
    expect(transport).toHaveBeenLastCalledWith({
      method: 'POST',
      path: 'queryRecords',
      data: {
        key: 'invoice',
        page: 0,
        size: 20,
        queryValues: { status: 'OPEN' },
      },
    });
    transport.mockRestore();
  });
});
