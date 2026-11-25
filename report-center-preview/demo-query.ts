import type { ReportDatasetField, ReportPageDesign, ReportParameter, ReportSourceCatalog } from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/report-definition-management-service';

type SampleRow = Record<string, number | string>;
type JoinedRow = Record<string, SampleRow>;

/** 恢复共享条件时只沿用原对象、标识和类型都未变化的值。 */
export function retainCompatibleParameters(previous: ReportParameter[], next: ReportParameter[], values: Readonly<Record<string, string>>,
                                           originalObjects?: ReadonlyMap<string, ReportParameter>,
                                           enumChoices?: Readonly<Record<string, Array<{ label: string; value: string }>>>) {
  const types = new Map(previous.map((parameter) => [parameter.key, parameter.type]));
  return Object.fromEntries(next.flatMap((parameter) => (!originalObjects || originalObjects.get(parameter.key) === parameter)
    && types.get(parameter.key) === parameter.type && values[parameter.key] !== undefined
    && (parameter.type !== 'ENUM' || !enumChoices || enumChoices[parameter.key]?.some((choice) => choice.value === values[parameter.key]))
    ? [[parameter.key, values[parameter.key]!]] : []));
}

/** 根据实际绑定的示例枚举字段生成共享筛选选项。 */
export function demoEnumChoices(design: ReportPageDesign, catalog: ReportSourceCatalog) {
  const result: Record<string, Array<{ label: string; value: string }>> = {};
  for (const component of design.components) {
    const dataset = design.datasets.find((item) => item.id === component.dataset);
    for (const filter of dataset?.filters || []) {
      const parameter = filter.parameter && component.bindings[filter.parameter];
      const field = catalog.sources.find((source) => source.id === filter.source)?.fields.find((item) => item.id === filter.name);
      if (parameter && field?.type === 'ENUM') result[parameter] = field.choices || [];
    }
  }
  return result;
}

/** 本地固定样本；此执行器仅用于体验页，不访问网络、业务数据或 SQL。 */
const sources: Record<string, SampleRow[]> = {
  sales: [
    { category: '渠道甲', product: '产品甲', amount: 85000, salesAmount: 72000, serviceAmount: 13000, day: '2026-10-24', orgId: 'north' },
    { category: '渠道乙', product: '产品乙', amount: 177000, salesAmount: 155000, serviceAmount: 22000, day: '2026-10-28', orgId: 'south' },
    { category: '渠道甲', product: '产品甲', amount: 61000, salesAmount: 43000, serviceAmount: 18000, day: '2026-11-01', orgId: 'north' },
    { category: '渠道丙', product: '产品丙', amount: 80000, salesAmount: 56000, serviceAmount: 24000, day: '2026-11-05', orgId: 'south' },
    { category: '渠道乙', product: '产品乙', amount: 46000, salesAmount: 32000, serviceAmount: 14000, day: '2026-11-09', orgId: 'north' },
    { category: '渠道甲', product: '产品乙', amount: 118000, salesAmount: 88000, serviceAmount: 30000, day: '2026-11-13', orgId: 'south' },
    { category: '渠道丙', product: '产品甲', amount: 271000, salesAmount: 230000, serviceAmount: 41000, day: '2026-11-17', orgId: 'north' },
    { category: '渠道甲', product: '产品丙', amount: 83000, salesAmount: 67000, serviceAmount: 16000, day: '2026-11-21', orgId: 'south' },
  ].map((row, index) => ({ ...row, id: `sale${index + 1}`, tenantId: 'demo-tenant', ownerId: index % 3 === 0 ? 'demo-user' : 'demo-other',
    status: index % 2 === 0 ? 'SETTLED' : 'PENDING' })),
  organizations: [{ id: 'north', name: '华北组织', parentId: 'group' }, { id: 'south', name: '华南组织', parentId: 'group' }],
  parentOrganizations: [{ id: 'group', name: '示例集团' }, { id: 'empty', name: '空示例集团' }],
  goals: [{ id: 'goal1', orgId: 'north', amount: 100000 }, { id: 'goal2', orgId: 'north', amount: 100000 },
    { id: 'goal3', orgId: 'south', amount: 300000 }],
};

function value(row: JoinedRow, field: { source: string; name: string }) {
  return row[field.source]?.[field.name];
}

function bucket(row: JoinedRow, field: ReportDatasetField, bindings: Record<string, string>, parameters: Readonly<Record<string, string>>) {
  const raw = value(row, field);
  const grain = field.grain || (field.grainParameter ? parameters[bindings[field.grainParameter] || ''] : undefined);
  if (!grain) return raw ?? null;
  if (typeof raw !== 'string' || !['DAY', 'MONTH'].includes(grain)) throw new Error('示例时间分组无效');
  return raw.slice(0, grain === 'MONTH' ? 7 : 10);
}

/** 根据已应用的声明式配置执行固定样本查询。 */
export function queryDemoDataset(design: ReportPageDesign, catalog: ReportSourceCatalog, componentId: string,
                                 parameters: Readonly<Record<string, string>>) {
  const component = design.components.find((item) => item.id === componentId);
  const dataset = design.datasets.find((item) => item.id === component?.dataset);
  if (!component || !dataset || !sources[dataset.root]) throw new Error('示例数据集不可用');
  let rows: JoinedRow[] = sources[dataset.root]!.map((item) => ({ [dataset.root]: item }));
  for (const id of dataset.relations) {
    const relation = catalog.relations.find((item) => item.id === id);
    const right = relation && sources[relation.rightSource];
    if (!relation || !right) throw new Error('示例关联不可用');
    rows = rows.flatMap((row) => {
      const leftValue = row[relation.leftSource]?.[relation.leftField];
      const matches = leftValue === undefined ? [] : right.filter((item) => item[relation.rightField] !== undefined && leftValue === item[relation.rightField]);
      if (!matches.length && dataset.leftRelations?.includes(id)) return [{ ...row, [relation.rightSource]: {} }];
      return matches.map((item) => ({ ...row, [relation.rightSource]: item }));
    });
  }
  for (const filter of dataset.filters) {
    let expected: string | string[] | undefined = filter.literal;
    if (filter.parameter) expected = parameters[component.bindings[filter.parameter] || ''];
    if (filter.context) {
      const contexts: Record<string, string | string[]> = { CURRENT_USER_ID: 'demo-user', CURRENT_TENANT_ID: 'demo-tenant',
        CURRENT_ORG_ID: 'north', AUTHORIZED_ORG_IDS: ['north', 'south'] };
      expected = contexts[filter.context];
    }
    if (expected === undefined || expected === '') continue;
    if (filter.boundary && typeof expected === 'string') expected = expected.split('/')[filter.boundary === 'START' ? 0 : 1];
    if (expected === undefined) throw new Error('示例范围无效');
    const selected = expected;
    rows = rows.filter((row) => {
      const actual = value(row, filter);
      if (actual === undefined) return false;
      if (Array.isArray(selected)) return selected.includes(String(actual));
      const comparison = typeof actual === 'number' ? Number(selected) : selected;
      if (typeof comparison === 'number' && !Number.isFinite(comparison)) return false;
      if (filter.operator === 'EQ') return actual === comparison;
      if (filter.operator === 'GE') return actual >= comparison;
      if (filter.operator === 'LE') return actual <= comparison;
      return false;
    });
  }
  const aggregated = dataset.fields.some((field) => field.aggregation !== 'NONE');
  let output: unknown[][];
  if (!aggregated) output = rows.map((row) => dataset.fields.map((field) => bucket(row, field, component.bindings, parameters)));
  else {
    const groups = new Map<string, JoinedRow[]>();
    for (const row of rows) {
      const key = JSON.stringify(dataset.fields.filter((field) => field.aggregation === 'NONE')
        .map((field) => bucket(row, field, component.bindings, parameters)));
      const group = groups.get(key) || []; group.push(row); groups.set(key, group);
    }
    if (rows.length === 0 && dataset.fields.every((field) => field.aggregation !== 'NONE')) groups.set('[]', []);
    output = [...groups.values()].map((group) => dataset.fields.map((field) => {
      if (field.aggregation === 'NONE') return group[0] ? bucket(group[0], field, component.bindings, parameters) : null;
      let values = group.map((row) => value(row, field)).filter((item) => item !== undefined);
      if (dataset.aggregationMode === 'FACT_DISTINCT') {
        const facts = new Map<string | number, number | string>();
        for (const row of group) {
          const id = row[field.source]?.id;
          const item = value(row, field);
          if (id === undefined || item === undefined) continue;
          if (facts.has(id) && facts.get(id) !== item) throw new Error('示例事实数据不一致');
          facts.set(id, item);
        }
        values = [...facts.values()];
      }
      if (field.aggregation === 'COUNT') return values.length;
      if (values.length === 0) return null;
      if (field.aggregation === 'SUM' || field.aggregation === 'AVG') {
        if (values.some((item) => typeof item !== 'number')) throw new Error('示例聚合字段无效');
        const total = (values as number[]).reduce((sum, item) => sum + item, 0);
        return field.aggregation === 'AVG' ? total / values.length : total;
      }
      const sorted = [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      return field.aggregation === 'MIN' ? sorted[0] : sorted.at(-1);
    }));
  }
  const sorts = dataset.fields.flatMap((field, index) => field.sort ? [{ index, direction: field.sort === 'ASC' ? 1 : -1 }] : []);
  if (sorts.length) output.sort((a, b) => {
    for (const sort of sorts) {
      const left = a[sort.index], right = b[sort.index];
      if (left === right) continue;
      if (left == null) return 1;
      if (right == null) return -1;
      return (left < right ? -1 : 1) * sort.direction;
    }
    return 0;
  });
  output = output.map((row) => row.map((item, index) => {
    const field = dataset.fields[index];
    const metadata = field && catalog.sources.find((source) => source.id === field.source)?.fields.find((entry) => entry.id === field.name);
    if (!field || field.aggregation !== 'NONE' || metadata?.type !== 'ENUM' || item == null) return item;
    const choice = metadata.choices?.find((entry) => entry.value === item);
    if (!choice) throw new Error('示例枚举值不可用');
    return choice.label;
  }));
  const limit = dataset.limit || 100;
  return { rows: output.slice(0, limit), hasMore: output.length > limit };
}
