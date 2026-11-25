import type { ReportSourceCatalog } from '../../../api/report-definition-management-service';

import { describe, expect, it } from 'vitest';

import {
  addComponent,
  addDataset,
  addParameter,
  availableRelations,
  changeLayout,
  datasetFields,
  duplicateComponent,
  duplicateDataset,
  moveCanvasComponent,
  moveGridComponent,
  setGridComponentColumns,
  swapGridComponents,
  newReportDesign,
  validateReportDesign,
} from '../report-design';

describe('复制数据集和报表组件', () => {
  it('数据集副本保留多表配置且可以独立修改', () => {
    const design = newReportDesign('测试');
    const source = addDataset(design, 'users');
    source.title = '用户分析'; source.relations = ['userOrganization'];
    source.fields = [{ source: 'users', name: 'name', aggregation: 'NONE' }];
    source.filters = [{ source: 'users', name: 'orgId', operator: 'EQ', parameter: 'org' }];
    const copy = duplicateDataset(design, 0)!;
    expect(copy.id).not.toBe(source.id);
    expect(copy.title).toBe('用户分析（副本）');
    expect(copy.relations).toEqual(['userOrganization']);
    copy.fields[0]!.name = 'orgId'; copy.filters[0]!.parameter = 'other';
    expect(source.fields[0]!.name).toBe('name');
    expect(source.filters[0]!.parameter).toBe('org');
  });

  it('组件副本共享数据集，独立外观和绑定并避免网格重叠', () => {
    const design = newReportDesign('测试');
    const dataset = addDataset(design, 'users');
    const source = addComponent(design, dataset.id);
    source.bindings = { filter: 'org' };
    source.background = { gradient: { from: '#112233', to: '#445566', direction: 'VERTICAL' } };
    const copy = duplicateComponent(design, 0)!;
    expect(copy.id).not.toBe(source.id);
    expect(copy.dataset).toBe(source.dataset);
    expect(copy.position.y).toBe(source.position.y + source.position.height);
    copy.bindings.filter = 'other'; copy.background!.gradient!.from = '#000000';
    expect(source.bindings.filter).toBe('org');
    expect(source.background!.gradient!.from).toBe('#112233');
  });

  it('超出布局边界时不修改原设计', () => {
    const design = newReportDesign('测试');
    const dataset = addDataset(design, 'users');
    const source = addComponent(design, dataset.id);
    source.position = { x: 0, y: 9996, width: 6, height: 4 };
    expect(duplicateComponent(design, 0)).toBeUndefined();
    expect(design.components).toHaveLength(1);
  });
});

const catalog: ReportSourceCatalog = {
  sources: [
    {
      id: 'users',
      title: '用户',
      fields: [
        { id: 'name', title: '姓名', type: 'STRING' },
        { id: 'orgId', title: '组织', type: 'ORGANIZATION' },
      ],
    },
    {
      id: 'organizations',
      title: '组织',
      fields: [
        { id: 'id', title: '标识', type: 'ORGANIZATION' },
        { id: 'name', title: '名称', type: 'STRING' },
      ],
    },
  ],
  relations: [
    {
      id: 'userOrganization',
      leftSource: 'users',
      leftField: 'orgId',
      rightSource: 'organizations',
      rightField: 'id',
      multipliesLeft: false,
    },
  ],
};

describe('报表设计草稿', () => {
  it('按登记关系连续关联三张表并汇总可选字段', () => {
    const region = { id: 'regions', title: '区域', fields: [{ id: 'id', title: '区域标识', type: 'STRING' as const },
      { id: 'name', title: '区域名称', type: 'STRING' as const }] };
    const expanded: ReportSourceCatalog = { sources: [...catalog.sources, region], relations: [...catalog.relations,
      { id: 'orgRegion', leftSource: 'organizations', leftField: 'id', rightSource: 'regions', rightField: 'id', multipliesLeft: false }] };
    const design = newReportDesign('多表');
    const dataset = addDataset(design, 'users');
    expect(availableRelations(dataset, expanded).map((item) => item.id)).toEqual(['userOrganization']);
    dataset.relations.push('userOrganization');
    expect(availableRelations(dataset, expanded).map((item) => item.id)).toEqual(['orgRegion']);
    dataset.relations.push('orgRegion');
    expect(availableRelations(dataset, expanded)).toEqual([]);
    expect(datasetFields(dataset, expanded).map((field) => `${field.source}:${field.id}`))
      .toEqual(expect.arrayContaining(['users:name', 'organizations:name', 'regions:name']));
  });
  it('一行一、二、三个宽度可混排并避让其他组件', () => {
    const design = newReportDesign('布局');
    const dataset = addDataset(design, 'users');
    const first = addComponent(design, dataset.id);
    const second = addComponent(design, dataset.id);
    first.position = { x: 0, y: 0, width: 6, height: 4 };
    second.position = { x: 6, y: 0, width: 6, height: 4 };
    expect(setGridComponentColumns(design, 0, 3)).toBe(true);
    expect(first.position.width).toBe(4);
    expect(second.position).toEqual({ x: 6, y: 0, width: 6, height: 4 });
    expect(setGridComponentColumns(design, 0, 1)).toBe(true);
    expect(first.position).toEqual({ x: 0, y: 4, width: 12, height: 4 });
    expect(second.position).toEqual({ x: 6, y: 0, width: 6, height: 4 });
    expect(setGridComponentColumns(design, 0, 2)).toBe(true);
    expect(first.position.width).toBe(6);
    const third = addComponent(design, dataset.id);
    expect(setGridComponentColumns(design, 2, 2)).toBe(true);
    expect(third.position).toEqual({ x: 0, y: 4, width: 6, height: 4 });
    const fourth = addComponent(design, dataset.id);
    expect(setGridComponentColumns(design, 3, 2)).toBe(true);
    expect(fourth.position).toEqual({ x: 6, y: 4, width: 6, height: 4 });
    design.layout = 'CANVAS';
    const before = { ...first.position };
    expect(setGridComponentColumns(design, 0, 3)).toBe(false);
    expect(first.position).toEqual(before);
  });
  it('手动调整导致网格重叠时禁止保存，画布仍可叠放', () => {
    const design = newReportDesign('布局');
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    const first = addComponent(design, dataset.id);
    const second = addComponent(design, dataset.id);
    second.position = { ...first.position };
    expect(validateReportDesign(design, catalog)).toContain('网格组件位置重叠，请调整布局');
    second.position = { ...first.position, x: first.position.x + first.position.width };
    expect(validateReportDesign(design, catalog)).not.toContain('网格组件位置重叠，请调整布局');
    design.layout = 'CANVAS'; second.position = { ...first.position };
    expect(validateReportDesign(design, catalog)).not.toContain('网格组件位置重叠，请调整布局');
  });
  it('授权组织集合只允许绑定组织字段和受控集合操作', () => {
    const design = newReportDesign('授权组织');
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    dataset.filters.push({ source: 'users', name: 'orgId', operator: 'IN', context: 'AUTHORIZED_ORG_IDS' });
    addComponent(design, dataset.id);
    expect(validateReportDesign(design, catalog)).toEqual([]);
    dataset.filters[0]!.name = 'name';
    expect(validateReportDesign(design, catalog)).toContain('数据集 dataset1 包含不可用筛选字段');
    dataset.filters[0]!.name = 'orgId';
    dataset.filters[0]!.operator = 'EQ';
    expect(validateReportDesign(design, catalog)).toContain('数据集 dataset1 包含不可用筛选字段');
    delete dataset.filters[0]!.context;
    dataset.filters[0]!.parameter = 'forged';
    dataset.filters[0]!.operator = 'IN';
    expect(validateReportDesign(design, catalog)).toContain('数据集 dataset1 包含不可用筛选字段');
  });
  it('仅主键已证明的一对多明细允许聚合', () => {
    const relations: ReportSourceCatalog = { sources: [
      { id: 'orders', title: '订单', fields: [{ id: 'id', title: '标识', type: 'STRING' }, { id: 'amount', title: '金额', type: 'DECIMAL' }] },
      { id: 'lines', title: '明细', fields: [{ id: 'parent', title: '订单', type: 'STRING' }, { id: 'amount', title: '明细金额', type: 'DECIMAL' }] },
    ], relations: [{ id: 'orderLines', leftSource: 'orders', leftField: 'id', rightSource: 'lines', rightField: 'parent', multipliesLeft: true, leftPrimaryKey: true }] };
    const design = newReportDesign('明细');
    const dataset = addDataset(design, 'orders');
    dataset.relations.push('orderLines');
    dataset.fields.push({ source: 'orders', name: 'id', aggregation: 'NONE' });
    dataset.fields.push({ source: 'lines', name: 'amount', aggregation: 'SUM' });
    addComponent(design, dataset.id);
    expect(validateReportDesign(design, relations)).toEqual([]);
    dataset.fields[0]!.aggregation = 'COUNT';
    expect(validateReportDesign(design, relations)).toContain('数据集 dataset1 的关联可能导致重复统计');
    dataset.fields[0]!.aggregation = 'NONE';
    relations.relations[0]!.leftPrimaryKey = false;
    expect(validateReportDesign(design, relations)).toContain('数据集 dataset1 的关联可能导致重复统计');
  });
  it('两个时间边界可绑定同一共享范围并检查类型', () => {
    const timeCatalog: ReportSourceCatalog = { sources: [{ id: 'events', title: '事件', fields: [
      { id: 'time', title: '时间', type: 'DATETIME' }, { id: 'name', title: '名称', type: 'STRING' },
    ] }], relations: [] };
    const design = newReportDesign('范围');
    const dataset = addDataset(design, 'events');
    dataset.fields.push({ source: 'events', name: 'name', aggregation: 'COUNT' });
    dataset.filters.push({ source: 'events', name: 'time', operator: 'GE', parameter: 'start', boundary: 'START' });
    dataset.filters.push({ source: 'events', name: 'time', operator: 'LE', parameter: 'end', boundary: 'END' });
    const parameter = addParameter(design); parameter.type = 'DATETIME_RANGE'; parameter.required = true; parameter.requiredForAll = true;
    const component = addComponent(design, dataset.id);
    component.bindings.start = parameter.key; component.bindings.end = parameter.key;
    expect(validateReportDesign(design, timeCatalog)).toEqual([]);
    parameter.type = 'DATE_RANGE';
    expect(validateReportDesign(design, timeCatalog)).toContain('组件 新报表 的共享条件类型不匹配');
    parameter.type = 'DATETIME_RANGE'; dataset.filters[1]!.operator = 'GE';
    expect(validateReportDesign(design, timeCatalog)).toContain('数据集 dataset1 包含不可用筛选字段');
  });
  it('枚举字段可以展示、分组或计数，但不能求和', () => {
    const enumCatalog: ReportSourceCatalog = { sources: [{ id: 'items', title: '申请', fields: [
      { id: 'status', title: '状态', type: 'ENUM', choices: [{ value: 'Issued', label: '已开具' }] },
      { id: 'amount', title: '金额', type: 'DECIMAL' },
    ] }], relations: [] };
    const design = newReportDesign('状态分析');
    const dataset = addDataset(design, 'items');
    dataset.fields.push({ source: 'items', name: 'status', aggregation: 'NONE' });
    dataset.fields.push({ source: 'items', name: 'amount', aggregation: 'SUM' });
    addComponent(design, dataset.id);
    expect(validateReportDesign(design, enumCatalog)).toEqual([]);
    dataset.fields[0]!.aggregation = 'COUNT';
    expect(validateReportDesign(design, enumCatalog)).toEqual([]);
    dataset.fields[0]!.aggregation = 'SUM';
    expect(validateReportDesign(design, enumCatalog)).toContain('字段 状态 仅支持直接展示或计数');
  });
  it('时间分组必须是日期字段且有聚合指标', () => {
    const timeCatalog: ReportSourceCatalog = { sources: [{ id: 'events', title: '事件', fields: [
      { id: 'time', title: '时间', type: 'DATETIME' }, { id: 'name', title: '名称', type: 'STRING' },
    ] }], relations: [] };
    const design = newReportDesign('趋势');
    const dataset = addDataset(design, 'events');
    dataset.fields.push({ source: 'events', name: 'time', aggregation: 'NONE', grain: 'DAY' });
    const component = addComponent(design, dataset.id);
    expect(validateReportDesign(design, timeCatalog)).toContain('数据集 dataset1 使用时间分组时需添加聚合指标');
    dataset.fields.push({ source: 'events', name: 'name', aggregation: 'COUNT' });
    expect(validateReportDesign(design, timeCatalog)).toEqual([]);
    dataset.fields[0]!.name = 'name';
    expect(validateReportDesign(design, timeCatalog)).toContain('数据集 dataset1 的时间分组字段无效');
    dataset.fields[0]!.name = 'time'; delete dataset.fields[0]!.grain; dataset.fields[0]!.grainParameter = 'g';
    const period = addParameter(design); period.type = 'TIME_GRAIN'; period.required = true; period.requiredForAll = true;
    component.bindings.g = period.key;
    expect(validateReportDesign(design, timeCatalog)).toEqual([]);
    period.required = false;
    expect(validateReportDesign(design, timeCatalog)).toContain(`时间粒度条件 ${period.title} 必须为必填`);
  });
  it('排行数量需要合法上限和明确排序', () => {
    const design = newReportDesign('排行');
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    addComponent(design, dataset.id);
    dataset.limit = 10;
    expect(validateReportDesign(design, catalog)).toContain('数据集 dataset1 配置显示数量时须先设置排序');
    dataset.fields[0]!.sort = 'DESC';
    expect(validateReportDesign(design, catalog)).toEqual([]);
    dataset.limit = 101;
    expect(validateReportDesign(design, catalog)).toContain('数据集 dataset1 的显示数量须为 1 至 100');
  });
  it('枚举共享条件必须绑定且选项保持一致', () => {
    const enumCatalog: ReportSourceCatalog = { sources: [{ id: 'items', title: '申请', fields: [
      { id: 'amount', title: '金额', type: 'DECIMAL' },
      { id: 'status', title: '状态', type: 'ENUM', choices: [{ value: 'Issued', label: '已开具' }] },
      { id: 'direction', title: '方向', type: 'ENUM', choices: [{ value: 'Normal', label: '正常票' }] },
    ] }], relations: [] };
    const design = newReportDesign('申请');
    const dataset = addDataset(design, 'items');
    dataset.fields.push({ source: 'items', name: 'amount', aggregation: 'SUM' });
    const parameter = addParameter(design); parameter.type = 'ENUM'; parameter.title = '状态';
    const component = addComponent(design, dataset.id);
    expect(validateReportDesign(design, enumCatalog)).toContain('枚举共享条件 状态 尚未绑定筛选字段');
    dataset.filters.push({ source: 'items', name: 'status', operator: 'EQ', parameter: 's' });
    component.bindings.s = parameter.key;
    expect(validateReportDesign(design, enumCatalog)).toEqual([]);
    dataset.filters.push({ source: 'items', name: 'direction', operator: 'EQ', parameter: 'd' });
    component.bindings.d = parameter.key;
    expect(validateReportDesign(design, enumCatalog)).toContain('共享条件 状态 的枚举选项不一致');
  });
  it('允许可信身份筛选且不要求绑定页面参数，拒绝混用或类型不符', () => {
    const design = newReportDesign('本人用户');
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    dataset.filters.push({
      source: 'users',
      name: 'name',
      operator: 'EQ',
      context: 'CURRENT_USER_ID',
    });
    addComponent(design, dataset.id);
    expect(validateReportDesign(design, catalog)).toEqual([]);
    const filter = dataset.filters[0];
    if (!filter) throw new Error('缺少筛选项');
    filter.parameter = 'forged';
    expect(validateReportDesign(design, catalog)).toContain(
      '数据集 dataset1 包含不可用筛选字段',
    );
    delete filter.parameter;
    filter.context = 'CURRENT_ORG_ID';
    expect(validateReportDesign(design, catalog)).toContain(
      '数据集 dataset1 包含不可用筛选字段',
    );
  });

  it('组合已授权的用户与组织并要求共享组织条件完整绑定', () => {
    const design = newReportDesign('用户分析');
    const dataset = addDataset(design, 'users');
    expect(availableRelations(dataset, catalog).map((item) => item.id)).toEqual(
      ['userOrganization'],
    );
    dataset.relations.push('userOrganization');
    expect(availableRelations(dataset, catalog)).toEqual([]);
    expect(datasetFields(dataset, catalog)).toHaveLength(4);
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    dataset.filters.push({
      source: 'users',
      name: 'orgId',
      operator: 'EQ',
      parameter: 'organization',
    });
    const parameter = addParameter(design);
    parameter.type = 'ORGANIZATION';
    parameter.requiredForAll = true;
    const component = addComponent(design, dataset.id);
    expect(validateReportDesign(design, catalog)).toContain(
      '组件 新报表 的筛选条件尚未完整绑定',
    );
    component.bindings.organization = parameter.key;
    expect(validateReportDesign(design, catalog)).toEqual([]);
  });

  it('网格组件交换位置时保留尺寸、其他布局和筛选绑定', () => {
    const design = newReportDesign('分析');
    const first = addComponent(design, 'dataset1');
    first.bindings.org = 'selectedOrg';
    const second = addComponent(design, 'dataset2');
    second.position.x = 6; second.position.y = 0;
    const third = addComponent(design, 'dataset3');
    const originalThird = { ...third.position };
    expect(swapGridComponents(design, 0, 1)).toBe(true);
    expect(first.position).toEqual({ x: 6, y: 0, width: 6, height: 4 });
    expect(second.position).toEqual({ x: 0, y: 0, width: 6, height: 4 });
    expect(third.position).toEqual(originalThird);
    expect(first.bindings.org).toBe('selectedOrg');
    expect(moveGridComponent(design, 0, 6, 4)).toBe(true);
    expect(first.position).toEqual({ x: 6, y: 4, width: 6, height: 4 });
    const before = JSON.stringify(design.components);
    expect(moveGridComponent(design, 0, 0, 4)).toBe(false);
    expect(moveGridComponent(design, 0, 8, 0)).toBe(false);
    expect(JSON.stringify(design.components)).toBe(before);
  });

  it('尺寸不兼容的交换不会破坏既有网格', () => {
    const design = newReportDesign('分析');
    const first = addComponent(design, 'one');
    const second = addComponent(design, 'two');
    first.position.width = 12;
    second.position.x = 6;
    const before = JSON.stringify(design.components);
    expect(swapGridComponents(design, 0, 1)).toBe(false);
    expect(JSON.stringify(design.components)).toBe(before);
  });

  it('自由画布新增组件时放在已拖动组件下方', () => {
    const design = newReportDesign('画布');
    changeLayout(design, 'CANVAS');
    const first = addComponent(design, 'dataset1');
    moveCanvasComponent(design, 0, 0, 500);
    const second = addComponent(design, 'dataset2');
    expect(second.position.y).toBe(first.position.y + first.position.height);
  });

  it('自由画布支持拖动坐标并可切回网格', () => {
    const design = newReportDesign('分析');
    const component = addComponent(design, 'dataset1');
    changeLayout(design, 'CANVAS');
    expect(component.position.width).toBe(240);
    moveCanvasComponent(design, 0, 145, 90);
    expect(component.position).toMatchObject({ x: 145, y: 90 });
    changeLayout(design, 'GRID');
    expect(component.position).toMatchObject({ x: 4, y: 2, width: 6 });
  });

  it('画布组件转换为网格时避开坐标取整造成的重叠', () => {
    const design = newReportDesign('分析');
    changeLayout(design, 'CANVAS');
    const first = addComponent(design, 'one');
    const second = addComponent(design, 'two');
    first.position.y = 0;
    second.position.y = 20;
    second.bindings.org = 'organization';
    expect(changeLayout(design, 'GRID')).toBe(true);
    expect(second.position.y).toBeGreaterThanOrEqual(first.position.y + first.position.height);
    expect(second.bindings.org).toBe('organization');
  });

  it('布局转换超出坐标范围时保留原布局', () => {
    const design = newReportDesign('分析');
    const component = addComponent(design, 'one');
    component.position.y = 300;
    const before = JSON.stringify(design);
    expect(changeLayout(design, 'CANVAS')).toBe(false);
    expect(JSON.stringify(design)).toBe(before);
  });

  it('网格无法容纳所有画布组件时保留整页原配置', () => {
    const design = newReportDesign('分析');
    changeLayout(design, 'CANVAS');
    for (let index = 0; index < 41; index += 1) {
      const component = addComponent(design, 'dataset');
      component.position = { x: 0, y: 0, width: 480, height: 10_000 };
    }
    const before = JSON.stringify(design);
    expect(changeLayout(design, 'GRID')).toBe(false);
    expect(JSON.stringify(design)).toBe(before);
  });

  it('网格预览限制横向范围，画布位置仍允许自由设置', () => {
    const design = newReportDesign('分析');
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    const component = addComponent(design, dataset.id);
    component.position.x = 8;
    expect(validateReportDesign(design, catalog)).toContain(
      '组件 新报表 的横向位置超出 12 列',
    );
    changeLayout(design, 'CANVAS');
    expect(validateReportDesign(design, catalog)).toEqual([]);
  });

  it('提示类型不匹配和可能放大的聚合', () => {
    const design = newReportDesign('分析');
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'SUM' });
    dataset.filters.push({
      source: 'users',
      name: 'orgId',
      operator: 'EQ',
      parameter: 'org',
    });
    const parameter = addParameter(design);
    parameter.type = 'DATE';
    const component = addComponent(design, dataset.id);
    component.bindings.org = parameter.key;
    expect(validateReportDesign(design, catalog)).toContain(
      '字段 姓名 不能求和或计算平均值',
    );
    expect(validateReportDesign(design, catalog)).toContain(
      '组件 新报表 的共享条件类型不匹配',
    );
  });
});
