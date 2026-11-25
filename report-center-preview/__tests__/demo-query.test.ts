import type { ReportPageDesign, ReportSourceCatalog } from '../../packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/report-definition-management-service';

import { describe, expect, it } from 'vitest';

import { demoEnumChoices, queryDemoDataset, retainCompatibleParameters } from '../demo-query';

const catalog: ReportSourceCatalog = {
  sources: [
    { id: 'sales', title: '收入', fields: [{ id: 'orgId', title: '组织', type: 'ORGANIZATION' },
      { id: 'amount', title: '金额', type: 'DECIMAL' }, { id: 'day', title: '日期', type: 'DATE' },
      { id: 'ownerId', title: '创建人', type: 'STRING' }, { id: 'tenantId', title: '租户', type: 'STRING' },
      { id: 'status', title: '状态', type: 'ENUM', choices: [{ value: 'SETTLED', label: '已结算' }, { value: 'PENDING', label: '待结算' }] }] },
    { id: 'organizations', title: '组织', fields: [{ id: 'id', title: '标识', type: 'ORGANIZATION' }, { id: 'name', title: '名称', type: 'STRING' }, { id: 'parentId', title: '上级标识', type: 'ORGANIZATION' }] },
    { id: 'parentOrganizations', title: '上级组织', fields: [{ id: 'id', title: '标识', type: 'ORGANIZATION' }, { id: 'name', title: '名称', type: 'STRING' }] },
    { id: 'goals', title: '目标', fields: [{ id: 'id', title: '标识', type: 'STRING' }, { id: 'orgId', title: '组织', type: 'ORGANIZATION' }, { id: 'amount', title: '金额', type: 'DECIMAL' }] },
  ],
  relations: [{ id: 'salesOrganization', leftSource: 'sales', leftField: 'orgId', rightSource: 'organizations', rightField: 'id', multipliesLeft: false },
    { id: 'organizationParent', leftSource: 'organizations', leftField: 'parentId', rightSource: 'parentOrganizations', rightField: 'id', multipliesLeft: false },
    { id: 'parentOrganizationChildren', leftSource: 'parentOrganizations', leftField: 'id', rightSource: 'organizations', rightField: 'parentId', multipliesLeft: true, leftPrimaryKey: true },
    { id: 'organizationGoals', leftSource: 'organizations', leftField: 'id', rightSource: 'goals', rightField: 'orgId', multipliesLeft: true, leftPrimaryKey: true }],
};

function design(): ReportPageDesign {
  return { version: 1, title: '示例', layout: 'GRID', background: {},
    parameters: [{ key: 'org', type: 'ORGANIZATION', required: false, requiredForAll: true },
      { key: 'window', type: 'DATE_RANGE', required: false, requiredForAll: true }],
    datasets: [{ id: 'data', root: 'sales', relations: ['salesOrganization'], fields: [
      { source: 'organizations', name: 'name', aggregation: 'NONE' },
      { source: 'sales', name: 'amount', aggregation: 'SUM', sort: 'DESC' },
    ], filters: [
      { source: 'sales', name: 'orgId', operator: 'EQ', parameter: 'organization' },
      { source: 'sales', name: 'day', operator: 'GE', parameter: 'from', boundary: 'START' },
      { source: 'sales', name: 'day', operator: 'LE', parameter: 'to', boundary: 'END' },
    ] }],
    components: ['first', 'second'].map((id) => ({ id, title: id, type: 'TABLE', dataset: 'data',
      bindings: { organization: 'org', from: 'window', to: 'window' }, position: { x: 0, y: 0, width: 6, height: 4 } })) };
}

describe('隔离体验的示例数据集', () => {
  it('多事实汇总按记录去重，同金额的不同目标仍分别计入', () => {
    const page = design();
    page.datasets[0]!.relations.push('organizationGoals');
    page.datasets[0]!.aggregationMode = 'FACT_DISTINCT';
    page.datasets[0]!.fields.push({ source: 'goals', name: 'amount', aggregation: 'SUM' });
    expect(queryDemoDataset(page, catalog, 'first', {}).rows).toEqual([
      ['华北组织', 463000, 200000], ['华南组织', 458000, 300000],
    ]);
  });
  it('左连接保留没有匹配的上级并在计数中返回零', () => {
    const page = design();
    page.datasets[0]!.root = 'parentOrganizations';
    page.datasets[0]!.relations = ['parentOrganizationChildren'];
    page.datasets[0]!.leftRelations = ['parentOrganizationChildren'];
    page.datasets[0]!.filters = [];
    page.datasets[0]!.fields = [{ source: 'parentOrganizations', name: 'name', aggregation: 'NONE' },
      { source: 'organizations', name: 'id', aggregation: 'COUNT' }];
    expect(queryDemoDataset(page, catalog, 'first', {}).rows).toEqual([['示例集团', 2], ['空示例集团', 0]]);
  });
  it('连续关联收入、组织与上级组织并按上级汇总', () => {
    const page = design();
    page.datasets[0]!.relations.push('organizationParent');
    page.datasets[0]!.fields[0] = { source: 'parentOrganizations', name: 'name', aggregation: 'NONE' };
    expect(queryDemoDataset(page, catalog, 'first', {}).rows).toEqual([['示例集团', 921000]]);
    expect(queryDemoDataset(page, catalog, 'first', { org: 'north' }).rows).toEqual([['示例集团', 463000]]);
  });
  it('仅恢复仍存在且类型未变化的共享条件', () => {
    const previous = design().parameters;
    const next = [
      { key: 'org', type: 'TEXT' as const, required: false, requiredForAll: false },
      { key: 'window', type: 'DATE_RANGE' as const, required: false, requiredForAll: false },
      { key: 'newCondition', type: 'TEXT' as const, required: false, requiredForAll: false },
    ];
    expect(retainCompatibleParameters(previous, next, { org: 'north', window: '2026-11-01/2026-11-30', removed: 'old' }))
      .toEqual({ window: '2026-11-01/2026-11-30' });
    const originalObjects = new Map(previous.map((parameter) => [parameter.key, parameter]));
    const recreated = [previous[0]!, { ...previous[1]! }];
    expect(retainCompatibleParameters(previous, recreated, { org: 'north', window: '2026-11-01/2026-11-30' }, originalObjects))
      .toEqual({ org: 'north' });
  });
  it('按关联组织分组，并让多个组件共享组织与时间范围', () => {
    const page = design();
    expect(queryDemoDataset(page, catalog, 'first', {}).rows).toEqual([['华北组织', 463000], ['华南组织', 458000]]);
    const params = { org: 'north', window: '2026-11-01/2026-11-30' };
    expect(queryDemoDataset(page, catalog, 'first', params).rows).toEqual([['华北组织', 378000]]);
    expect(queryDemoDataset(page, catalog, 'second', params).rows).toEqual([['华北组织', 378000]]);
    expect(queryDemoDataset(page, catalog, 'first', { org: "north' OR '1'='1" }).rows).toEqual([]);
  });

  it('应用排序与排行上限，并拒绝未登记关联', () => {
    const page = design();
    page.datasets[0]!.limit = 1;
    expect(queryDemoDataset(page, catalog, 'first', {})).toEqual({ rows: [['华北组织', 463000]], hasMore: true });
    page.datasets[0]!.relations = ['forged'];
    expect(() => queryDemoDataset(page, catalog, 'first', {})).toThrow();
  });

  it('支持可信示例组织列表和共享日月粒度', () => {
    const page = design();
    page.parameters = [{ key: 'period', type: 'TIME_GRAIN', required: true, requiredForAll: true }];
    page.datasets[0]!.fields = [
      { source: 'sales', name: 'day', aggregation: 'NONE', grainParameter: 'grain', sort: 'ASC' },
      { source: 'sales', name: 'amount', aggregation: 'SUM' },
    ];
    page.datasets[0]!.filters = [{ source: 'sales', name: 'orgId', operator: 'IN', context: 'AUTHORIZED_ORG_IDS' }];
    page.components[0]!.bindings = { grain: 'period' };
    expect(queryDemoDataset(page, catalog, 'first', { period: 'MONTH' }).rows).toEqual([
      ['2026-10', 262000], ['2026-11', 659000],
    ]);
    page.datasets[0]!.filters = [{ source: 'sales', name: 'orgId', operator: 'EQ', context: 'CURRENT_ORG_ID' }];
    expect(queryDemoDataset(page, catalog, 'first', { period: 'MONTH' }).rows).toEqual([
      ['2026-10', 85000], ['2026-11', 378000],
    ]);
  });

  it('当前示例用户和租户来自固定上下文而非页面参数', () => {
    const page = design();
    page.datasets[0]!.fields = [{ source: 'sales', name: 'amount', aggregation: 'SUM' }];
    page.datasets[0]!.filters = [
      { source: 'sales', name: 'ownerId', operator: 'EQ', context: 'CURRENT_USER_ID' },
      { source: 'sales', name: 'tenantId', operator: 'EQ', context: 'CURRENT_TENANT_ID' },
      { source: 'sales', name: 'orgId', operator: 'IN', context: 'AUTHORIZED_ORG_IDS' },
    ];
    page.components[0]!.bindings = {};
    expect(queryDemoDataset(page, catalog, 'first', { userId: 'demo-other', tenantId: 'forged' }).rows).toEqual([[436000]]);
  });

  it('枚举分组显示业务名称，共享条件使用登记的选项', () => {
    const page = design();
    page.parameters = [{ key: 'state', type: 'ENUM', required: false, requiredForAll: false }];
    page.datasets[0]!.fields = [
      { source: 'sales', name: 'status', aggregation: 'NONE' },
      { source: 'sales', name: 'amount', aggregation: 'SUM', sort: 'DESC' },
    ];
    page.datasets[0]!.filters = [{ source: 'sales', name: 'status', operator: 'EQ', parameter: 'statusFilter' }];
    page.components.forEach((component) => { component.bindings = { statusFilter: 'state' }; });
    expect(demoEnumChoices(page, catalog).state).toEqual([{ value: 'SETTLED', label: '已结算' }, { value: 'PENDING', label: '待结算' }]);
    expect(queryDemoDataset(page, catalog, 'first', {}).rows).toEqual([['已结算', 463000], ['待结算', 458000]]);
    expect(queryDemoDataset(page, catalog, 'first', { state: 'PENDING' }).rows).toEqual([['待结算', 458000]]);
    const original = new Map(page.parameters.map((parameter) => [parameter.key, parameter]));
    expect(retainCompatibleParameters(page.parameters, page.parameters, { state: 'PENDING' }, original,
      { state: [{ value: 'SETTLED', label: '已结算' }] })).toEqual({});
    expect(retainCompatibleParameters(page.parameters, page.parameters, { state: 'PENDING' }, original,
      demoEnumChoices(page, catalog))).toEqual({ state: 'PENDING' });
  });
});
