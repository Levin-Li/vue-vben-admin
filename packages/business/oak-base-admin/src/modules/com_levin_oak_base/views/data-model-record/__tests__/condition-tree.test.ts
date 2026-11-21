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

  it('保存当前身份变量，并拒绝参数混用和不支持的字段类型', () => {
    const variable = {
      type: 'VARIABLE' as const,
      key: 'status',
      variable: 'currentUserId' as const,
    };
    expect(
      buildConditionDefinition(
        {
          type: 'AND',
          children: [param('amount'), variable, param('category')],
        },
        inputs,
      ),
    ).toEqual({
      type: 'AND',
      children: [param('amount'), variable, param('category')],
    });
    expect(() =>
      buildConditionDefinition(
        { type: 'AND', children: [param('status'), variable] },
        inputs.slice(1, 2),
      ),
    ).toThrow('不能同时');
    expect(() =>
      buildConditionDefinition(variable, [
        { ...inputs[1], type: 'INTEGER' } as DataModelQueryInput,
      ]),
    ).toThrow('字符串字段');
  });

  it('允许组织列表变量参与嵌套的与或条件', () => {
    const definition = {
      type: 'AND' as const,
      children: [
        {
          type: 'VARIABLE' as const,
          key: 'amount',
          variable: 'authorizedOrgIds' as const,
        },
        { type: 'OR' as const, children: [param('status'), param('category')] },
      ],
    };
    expect(buildConditionDefinition(definition, inputs)).toEqual(definition);
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
