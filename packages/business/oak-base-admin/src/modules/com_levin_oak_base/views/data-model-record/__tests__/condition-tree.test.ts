import type { DataModelQueryInput } from '../../../api/data-model-service';

import { describe, expect, it, vi } from 'vitest';

import { dataModelService } from '../../../api/data-model-service';
import {
  buildConditionTree,
  newCondition,
  resolveConditionOptions,
  resolveConditionOptionValue,
} from '../condition-tree';

const inputs: DataModelQueryInput[] = [
  {
    key: 'minAmount',
    field: 'invoiceTotal',
    operator: 'GTE',
    title: '金额下限',
    type: 'MONEY',
    defaultVisible: true,
  },
  {
    key: 'status',
    field: 'status',
    operator: 'EQ',
    title: '状态',
    type: 'STRING',
    defaultVisible: true,
  },
  {
    key: 'createdBefore',
    field: 'createTime',
    operator: 'LTE',
    title: '创建时间',
    type: 'DATETIME',
    defaultVisible: true,
  },
];

describe('动态记录高级查询条件', () => {
  it('空选项数组仍展示布尔及归属候选，并保持原始值类型', () => {
    const booleanInput: DataModelQueryInput = {
      key: 'enabled',
      field: 'enable',
      operator: 'EQ',
      title: '启用',
      type: 'BOOLEAN',
      defaultVisible: true,
      options: [],
    };
    const booleanOptions = resolveConditionOptions(booleanInput);
    expect(booleanOptions).toEqual([
      { label: '是', value: true },
      { label: '否', value: false },
    ]);
    const falseValue = resolveConditionOptionValue('false', booleanOptions);
    expect(falseValue).toBe(false);
    expect(
      buildConditionTree({ type: 'PARAM', key: 'enabled', value: falseValue }, [
        booleanInput,
      ]),
    ).toEqual({ type: 'PARAM', key: 'enabled', value: false });

    const scopeInput: DataModelQueryInput = {
      key: 'org',
      field: 'orgId',
      operator: 'EQ',
      title: '组织',
      type: 'STRING',
      defaultVisible: true,
      referenceType: 'ORG',
      options: [],
    };
    const scopeOptions = resolveConditionOptions(scopeInput, {
      orgId: [{ label: '华东组织', value: 'org-1' }],
    });
    expect(scopeOptions).toEqual([{ label: '华东组织', value: 'org-1' }]);
    expect(resolveConditionOptionValue('org-1', scopeOptions)).toBe('org-1');
  });
  it('生成嵌套与或非，仅传已发布参数键和值', () => {
    const tree = {
      type: 'AND' as const,
      children: [
        {
          type: 'OR' as const,
          children: [
            { type: 'PARAM' as const, key: 'minAmount', value: '100.50' },
            { type: 'PARAM' as const, key: 'minAmount', value: '200.50' },
          ],
        },
        {
          type: 'NOT' as const,
          child: { type: 'PARAM' as const, key: 'status', value: 'CLOSED' },
        },
      ],
    };
    const result = buildConditionTree(tree, inputs);
    expect(result).toEqual(tree);
    expect(JSON.stringify(result)).not.toMatch(/invoiceTotal|operator|GTE/);
  });

  it('转换日期时间，拒绝未知参数、空叶子与非法值', () => {
    expect(
      buildConditionTree(
        {
          type: 'PARAM',
          key: 'createdBefore',
          value: '2026-10-25T08:00:00+08:00',
        },
        inputs,
      ),
    ).toEqual({
      type: 'PARAM',
      key: 'createdBefore',
      value: '2026-10-25T00:00:00.000Z',
    });
    expect(() =>
      buildConditionTree(
        { type: 'PARAM', key: 'physical_column', value: 'x' },
        inputs,
      ),
    ).toThrow('已发布');
    expect(() => buildConditionTree(newCondition('AND'), inputs)).toThrow(
      '已发布',
    );
    expect(() =>
      buildConditionTree({ type: 'AND', children: [] }, inputs),
    ).toThrow('至少');
    expect(() =>
      buildConditionTree(
        { type: 'PARAM', key: 'status', value: { sql: '1=1' } },
        inputs,
      ),
    ).toThrow('无效');
    expect(() =>
      buildConditionTree(
        { type: 'PARAM', key: 'minAmount', value: 'abc' },
        inputs,
      ),
    ).toThrow('数值');
    expect(() =>
      buildConditionTree({ type: 'PARAM', key: 'status', value: 'OTHER' }, [
        {
          ...inputs[1],
          options: [{ label: '启用', value: 'OPEN' }],
        } as DataModelQueryInput,
      ]),
    ).toThrow('可选值');
  });

  it('限制叶子数量和嵌套深度', () => {
    expect(() =>
      buildConditionTree(
        {
          type: 'AND',
          children: Array.from({ length: 21 }, () => ({
            type: 'PARAM' as const,
            key: 'status',
            value: 'OPEN',
          })),
        },
        inputs,
      ),
    ).toThrow('最多 20');
    let deep = {
      type: 'PARAM' as const,
      key: 'status',
      value: 'OPEN',
    } as ReturnType<typeof newCondition>;
    for (let index = 0; index < 6; index++) deep = { type: 'NOT', child: deep };
    expect(() => buildConditionTree(deep, inputs)).toThrow('层级');
  });
});

it('高级请求仅提交条件树，简单请求仍只提交扁平参数', async () => {
  const transport = vi
    .spyOn(
      dataModelService as unknown as {
        request: (options: unknown) => Promise<unknown>;
      },
      'request',
    )
    .mockResolvedValue({ items: [], total: 0 });
  const tree = buildConditionTree(
    { type: 'PARAM', key: 'status', value: 'OPEN' },
    inputs,
  );
  await dataModelService.queryRecords('invoice', {
    pageIndex: 1,
    conditionTree: tree,
  });
  expect(transport).toHaveBeenLastCalledWith({
    method: 'POST',
    path: 'queryRecords',
    data: { key: 'invoice', page: 0, size: 20, conditionTree: tree },
  });
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
  await expect(
    dataModelService.queryRecords('invoice', {
      conditionTree: tree,
      queryValues: { status: 'OPEN' },
    }),
  ).rejects.toThrow('不能与高级条件同时提交');
  transport.mockRestore();
});
