import type {
  ReportComponent,
  ReportDataset,
  ReportPageDesign,
  ReportParameter,
  ReportRelation,
  ReportSourceCatalog,
  ReportSourceField,
} from '../../api/report-definition-management-service';

import { backgroundImage, isReportColor, isReportGradient } from '../report-view/report-background';

// 创建页面只记录布局和声明式数据，不包含身份、SQL 或脚本。
export function newReportDesign(title: string): ReportPageDesign {
  return {
    background: {},
    components: [],
    datasets: [],
    layout: 'GRID',
    parameters: [],
    title,
    version: 1,
  };
}

function nextKey(prefix: string, used: Iterable<string>): string {
  const names = new Set(used);
  let index = 1;
  while (names.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

// 每个数据集都有独立标识，页面可组合多个不同数据集。
export function addDataset(
  design: ReportPageDesign,
  root: string,
): ReportDataset {
  const dataset: ReportDataset = {
    fields: [],
    filters: [],
    id: nextKey(
      'dataset',
      design.datasets.map((item) => item.id),
    ),
    relations: [],
    root,
  };
  design.datasets.push(dataset);
  return dataset;
}

/** 复制查询配置，副本和原数据集后续编辑互不影响。 */
export function duplicateDataset(design: ReportPageDesign, index: number): ReportDataset | undefined {
  const source = design.datasets[index];
  if (!source || design.datasets.length >= 32) return undefined;
  const copy = JSON.parse(JSON.stringify(source)) as ReportDataset;
  copy.id = nextKey('dataset', design.datasets.map((item) => item.id));
  if (copy.title) copy.title = `${copy.title.slice(0, 124)}（副本）`;
  design.datasets.splice(index + 1, 0, copy);
  return copy;
}

// 关联只从已授权目录中选择，不能形成循环或重复引用同一来源。
export function availableRelations(
  dataset: ReportDataset,
  catalog: ReportSourceCatalog,
): ReportRelation[] {
  const included = new Set([dataset.root]);
  for (const id of dataset.relations) {
    const relation = catalog.relations.find((item) => item.id === id);
    if (
      !relation ||
      !included.has(relation.leftSource) ||
      included.has(relation.rightSource)
    ) {
      return [];
    }
    included.add(relation.rightSource);
  }
  return catalog.relations.filter(
    (relation) =>
      included.has(relation.leftSource) && !included.has(relation.rightSource),
  );
}

export function datasetFields(
  dataset: ReportDataset,
  catalog: ReportSourceCatalog,
): Array<ReportSourceField & { source: string; sourceTitle: string }> {
  const sources = new Set([dataset.root]);
  for (const id of dataset.relations) {
    const relation = catalog.relations.find((item) => item.id === id);
    if (relation) sources.add(relation.rightSource);
  }
  return catalog.sources.flatMap((source) =>
    sources.has(source.id)
      ? source.fields.map((field) => ({
          ...field,
          source: source.id,
          sourceTitle: source.title,
        }))
      : [],
  );
}

// 参数与组件的绑定保留在页面配置中，具体值由运行时用户选择。
export function addParameter(design: ReportPageDesign): ReportParameter {
  const parameter: ReportParameter = {
    key: nextKey(
      'parameter',
      design.parameters.map((item) => item.key),
    ),
    required: false,
    requiredForAll: false,
    title: '筛选条件',
    type: 'TEXT',
  };
  design.parameters.push(parameter);
  return parameter;
}

export function addComponent(
  design: ReportPageDesign,
  datasetId: string,
): ReportComponent {
  let bottom = 0;
  for (const item of design.components) {
    bottom = Math.max(bottom, item.position.y + item.position.height);
  }
  const component: ReportComponent = {
    bindings: {},
    dataset: datasetId,
    id: nextKey(
      'component',
      design.components.map((item) => item.id),
    ),
    position:
      design.layout === 'CANVAS'
        ? { height: 160, width: 240, x: 0, y: Math.min(10_000, bottom) }
        : {
            height: 4,
            width: 6,
            x: 0,
            y: bottom,
          },
    title: '新报表',
    tone: 'LAVENDER',
    type: 'TABLE',
  };
  design.components.push(component);
  return component;
}

/** 复制组件外观及条件绑定，数据集仍由原组件和副本共享。 */
export function duplicateComponent(design: ReportPageDesign, index: number): ReportComponent | undefined {
  const source = design.components[index];
  if (!source || design.components.length >= 100) return undefined;
  const bottom = Math.max(0, ...design.components.map((item) => item.position.y + item.position.height));
  const position = { ...source.position, y: bottom };
  if (design.layout === 'GRID') {
    if (!validGridPosition(position) || design.components.some((item) => !validGridPosition(item.position) || overlaps(position, item.position))) return undefined;
  } else if (![position.x, position.y, position.width, position.height].every(Number.isSafeInteger)
      || position.x < 0 || position.y < 0 || position.width < 1 || position.height < 1
      || position.x > 10_000 || position.y > 10_000 || position.width > 10_000 || position.height > 10_000) return undefined;
  const copy = JSON.parse(JSON.stringify(source)) as ReportComponent;
  copy.id = nextKey('component', design.components.map((item) => item.id));
  copy.title = `${copy.title.slice(0, 124)}（副本）`;
  copy.position = position;
  design.components.splice(index + 1, 0, copy);
  return copy;
}

// 网格和自由画布使用不同坐标单位，切换时保留大致位置和尺寸。
export function changeLayout(
  design: ReportPageDesign,
  layout: ReportPageDesign['layout'],
): boolean {
  if (design.layout === layout) return true;
  const factor = layout === 'CANVAS' ? 40 : 1 / 40;
  // 先在副本上完成转换，任何组件越界时保留整页原布局。
  const positions = design.components.map(({ position }) => ({
    x: Math.round(position.x * factor),
    y: Math.round(position.y * factor),
    width: Math.max(1, Math.round(position.width * factor)),
    height: Math.max(1, Math.round(position.height * factor)),
  }));
  for (const position of positions) {
    if (![position.x, position.y, position.width, position.height].every(Number.isSafeInteger)
        || position.x < 0 || position.y < 0 || position.width > 10_000 || position.height > 10_000
        || position.x > 10_000 || position.y > 10_000) return false;
    if (layout === 'GRID') {
      position.width = Math.min(12, position.width);
      position.x = Math.min(12 - position.width, position.x);
    }
  }
  if (layout === 'GRID') {
    // 按视觉顺序向下寻找空位，不修改数据集或参数绑定。
    const placed: GridPosition[] = [];
    const ordered = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const position of ordered) {
      let collisions = placed.filter((other) => overlaps(position, other));
      while (collisions.length) {
        position.y = Math.max(...collisions.map((other) => other.y + other.height));
        collisions = placed.filter((other) => overlaps(position, other));
      }
      if (!validGridPosition(position)) return false;
      placed.push(position);
    }
  }
  design.components.forEach((component, index) => Object.assign(component.position, positions[index]));
  design.layout = layout;
  return true;
}

// 自由画布拖动更新像素坐标，边界与后端配置契约一致。
export function moveCanvasComponent(
  design: ReportPageDesign,
  index: number,
  x: number,
  y: number,
): void {
  const component = design.components[index];
  if (
    design.layout !== 'CANVAS' ||
    !component ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  )
    return;
  component.position.x = Math.min(10_000, Math.max(0, Math.round(x)));
  component.position.y = Math.min(10_000, Math.max(0, Math.round(y)));
}

type GridPosition = ReportComponent['position'];

function overlaps(a: GridPosition, b: GridPosition): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function validGridPosition(position: GridPosition): boolean {
  return [position.x, position.y, position.width, position.height].every(Number.isInteger)
    && position.x >= 0 && position.y >= 0 && position.width >= 1 && position.height >= 1
    && position.x + position.width <= 12 && position.y + position.height <= 10_000;
}

/** 设置每行一、二或三个组件，只移动当前组件并避让既有布局。 */
export function setGridComponentColumns(design: ReportPageDesign, index: number, columns: 1 | 2 | 3): boolean {
  const component = design.components[index];
  if (design.layout !== 'GRID' || !component || ![1, 2, 3].includes(columns)) return false;
  const width = 12 / columns;
  const slots = Array.from({ length: columns }, (_, slot) => slot * width)
    .sort((a, b) => Math.abs(a - component.position.x) - Math.abs(b - component.position.x));
  const others = design.components.filter((_, itemIndex) => itemIndex !== index).map((item) => item.position);
  // 新增组件默认位于上一行下方，改成窄卡片时先尝试并入紧邻的上一行。
  const previousRows = [...new Set(others.filter((other) => other.y + other.height === component.position.y)
    .map((other) => other.y))].sort((a, b) => b - a);
  for (const previousY of previousRows) {
    for (const x of slots) {
      const next = { ...component.position, x, y: previousY, width };
      if (validGridPosition(next) && !others.some((other) => overlaps(next, other))) {
        Object.assign(component.position, next);
        return true;
      }
    }
  }
  let y = component.position.y;
  // 每次跳到碰撞组件的底边，最多处理现有组件数加一次。
  for (let attempt = 0; attempt <= others.length; attempt++) {
    for (const x of slots) {
      const next = { ...component.position, x, y, width };
      if (validGridPosition(next) && !others.some((other) => overlaps(next, other))) {
        Object.assign(component.position, next);
        return true;
      }
    }
    const bottoms = others.filter((other) => other.y + other.height > y).map((other) => other.y + other.height);
    if (!bottoms.length) return false;
    y = Math.min(...bottoms);
  }
  return false;
}

/** 放置到空白网格，不改变组件尺寸或其他组件。 */
export function moveGridComponent(design: ReportPageDesign, index: number, x: number, y: number): boolean {
  const component = design.components[index];
  if (design.layout !== 'GRID' || !component) return false;
  const next = { ...component.position, x, y };
  if (!validGridPosition(next) || design.components.some((other, i) => i !== index && overlaps(next, other.position))) return false;
  component.position.x = x;
  component.position.y = y;
  return true;
}

/** 交换网格位置；尺寸不兼容或与其他组件重叠时保持原样。 */
export function swapGridComponents(
  design: ReportPageDesign,
  from: number,
  to: number,
): boolean {
  if (
    design.layout !== 'GRID' ||
    from < 0 ||
    to < 0 ||
    from >= design.components.length ||
    to >= design.components.length ||
    from === to
  ) return false;
  const first = design.components[from];
  const second = design.components[to];
  if (!first || !second) return false;
  const a = { ...first.position, x: second.position.x, y: second.position.y };
  const b = { ...second.position, x: first.position.x, y: first.position.y };
  if (!validGridPosition(a) || !validGridPosition(b) || overlaps(a, b)
      || design.components.some((other, index) => index !== from && index !== to && (overlaps(a, other.position) || overlaps(b, other.position)))) return false;
  first.position.x = a.x; first.position.y = a.y;
  second.position.x = b.x; second.position.y = b.y;
  return true;
}

// 客户端提示只辅助编辑，最终结构、权限和范围仍由服务端验证。
export function validateReportDesign(
  design: ReportPageDesign,
  catalog: ReportSourceCatalog,
): string[] {
  const errors: string[] = [];
  const keyPattern = /^[A-Z]\w{0,63}$/i;
  const reserved = new Set([
    'authorizedOrgIds',
    'confidentialLevel',
    'isSuperAdmin',
    'tenantId',
    'userId',
  ]);
  if (!design.title.trim() || design.title.length > 128)
    errors.push('请填写不超过 128 个字符的页面名称');
  if (design.background.image && !backgroundImage(design.background.image))
    errors.push('背景图片格式不受支持');
  if (design.background.color && !isReportColor(design.background.color)) errors.push('页面背景颜色格式不受支持');
  if (design.background.gradient && !isReportGradient(design.background.gradient)) errors.push('页面渐变配置不受支持');
  if (design.components.some((component) => (component.background?.color && !isReportColor(component.background.color))
    || (component.background?.gradient && !isReportGradient(component.background.gradient)))) errors.push('图表背景配置不受支持');
  if (design.components.length === 0) errors.push('请至少添加一个报表组件');
  if (design.layout === 'GRID' && design.components.some((component, index) =>
    design.components.slice(index + 1).some((other) => overlaps(component.position, other.position)))) {
    errors.push('网格组件位置重叠，请调整布局');
  }
  if (
    design.parameters.length > 32 ||
    design.datasets.length > 32 ||
    design.components.length > 100
  ) {
    errors.push('页面中的条件、数据集或组件数量超出限制');
  }
  const parameterKeys = new Set<string>();
  for (const parameter of design.parameters) {
    if (parameter.type === 'TIME_GRAIN' && !parameter.required)
      errors.push(`时间粒度条件 ${parameter.title || parameter.key} 必须为必填`);
    if (
      parameter.title !== undefined &&
      (!parameter.title.trim() || parameter.title.length > 128)
    ) {
      errors.push('请填写有效的共享条件名称');
    }
    if (
      !keyPattern.test(parameter.key) ||
      reserved.has(parameter.key) ||
      parameterKeys.has(parameter.key)
    ) {
      errors.push('共享条件标识无效或重复');
    }
    parameterKeys.add(parameter.key);
  }
  const datasetKeys = new Set<string>();
  for (const dataset of design.datasets) {
    if (dataset.title != null && (!dataset.title.trim() || dataset.title.length > 128))
      errors.push(`数据集 ${dataset.id} 的名称无效`);
    if (!keyPattern.test(dataset.id) || datasetKeys.has(dataset.id))
      errors.push('数据集标识无效或重复');
    datasetKeys.add(dataset.id);
    if (!catalog.sources.some((source) => source.id === dataset.root)) {
      errors.push(`数据集 ${dataset.id} 的数据源不可用`);
    }
    const included = new Set([dataset.root]);
    if (dataset.leftRelations && (new Set(dataset.leftRelations).size !== dataset.leftRelations.length || dataset.leftRelations.some((id) => !dataset.relations.includes(id))))
      errors.push(`数据集 ${dataset.id} 的左连接配置无效`);
    const multiplying: ReportRelation[] = [];
    for (const relationId of dataset.relations) {
      const relation = catalog.relations.find((item) => item.id === relationId);
      if (
        !relation ||
        !included.has(relation.leftSource) ||
        included.has(relation.rightSource)
      ) {
        errors.push(`数据集 ${dataset.id} 的关联不可用`);
        break;
      }
      included.add(relation.rightSource);
      if (relation.multipliesLeft) multiplying.push(relation);
    }
    if (dataset.fields.length === 0)
      errors.push(`数据集 ${dataset.id} 尚未选择字段`);
    if (dataset.limit !== undefined) {
      if (!Number.isInteger(dataset.limit) || dataset.limit < 1 || dataset.limit > 100)
        errors.push(`数据集 ${dataset.id} 的显示数量须为 1 至 100`);
      if (!dataset.fields.some((field) => field.sort))
        errors.push(`数据集 ${dataset.id} 配置显示数量时须先设置排序`);
    }
    if (
      dataset.relations.length > 7 ||
      dataset.fields.length > 64 ||
      dataset.filters.length > 64
    ) {
      errors.push(`数据集 ${dataset.id} 的关联、字段或筛选数量超出限制`);
    }
    const fields = datasetFields(dataset, catalog);
    for (const field of dataset.fields) {
      if (field.title != null && (typeof field.title !== 'string' || !field.title.trim()
          || field.title.length > 128 || /[\u0000-\u001F\u007F-\u009F]/.test(field.title)))
        errors.push(`数据集 ${dataset.id} 的字段显示名称无效`);
      const metadata = fields.find(
        (item) => item.source === field.source && item.id === field.name,
      );
      if (!metadata) errors.push(`数据集 ${dataset.id} 包含不可用字段`);
      else if (metadata.type === 'ENUM' && !['NONE', 'COUNT'].includes(field.aggregation))
        errors.push(`字段 ${metadata.title} 仅支持直接展示或计数`);
      else if (
        ['AVG', 'SUM'].includes(field.aggregation) &&
        !['DECIMAL', 'INTEGER'].includes(metadata.type)
      ) {
        errors.push(`字段 ${metadata.title} 不能求和或计算平均值`);
      } else if (
        ['MAX', 'MIN'].includes(field.aggregation) &&
        metadata.type === 'BOOLEAN'
      ) {
        errors.push(`字段 ${metadata.title} 不能计算最小或最大值`);
      }
      if ((field.grain || field.grainParameter) && (!metadata || !['DATE', 'DATETIME'].includes(metadata.type)
          || field.aggregation !== 'NONE' || (!!field.grain && !!field.grainParameter)
          || (!!field.grainParameter && !keyPattern.test(field.grainParameter))))
        errors.push(`数据集 ${dataset.id} 的时间分组字段无效`);
      if (metadata) {
        const numeric = field.aggregation === 'COUNT' || ['INTEGER', 'DECIMAL'].includes(metadata.type);
        if ((field.display && !numeric) || (field.aggregation === 'COUNT' && field.display === 'MONEY'))
          errors.push(`字段 ${metadata.title} 的数值语义不匹配`);
        if (field.unit !== undefined && (field.unit.length > 12 || /[\u0000-\u001F\u007F]/.test(field.unit)
            || !(field.aggregation === 'COUNT' || field.display === 'MONEY' || field.display === 'QUANTITY')))
          errors.push(`字段 ${metadata.title} 的单位无效`);
      }
    }
    if (dataset.fields.some((field) => field.grain || field.grainParameter) && !dataset.fields.some((field) => field.aggregation !== 'NONE'))
      errors.push(`数据集 ${dataset.id} 使用时间分组时需添加聚合指标`);
    if (dataset.fields.some((field) => field.grainParameter && dataset.filters.some((filter) => filter.parameter === field.grainParameter)))
      errors.push(`数据集 ${dataset.id} 的时间粒度与筛选项标识不能相同`);
    if (dataset.aggregationMode && dataset.aggregationMode !== 'FACT_DISTINCT')
      errors.push(`数据集 ${dataset.id} 的汇总方式无效`);
    if (dataset.aggregationMode === 'FACT_DISTINCT' && !dataset.fields.some((field) => field.aggregation !== 'NONE'))
      errors.push(`数据集 ${dataset.id} 按事实去重时需添加聚合指标`);
    if (dataset.aggregationMode !== 'FACT_DISTINCT' && multiplying.length > 0 && dataset.fields.some((field) => field.aggregation !== 'NONE')
        && (multiplying.length !== 1 || multiplying[0]?.leftSource !== dataset.root
          || !multiplying[0]?.leftPrimaryKey
          || dataset.fields.some((field) => field.aggregation !== 'NONE' && field.source !== multiplying[0]?.rightSource))) {
      errors.push(`数据集 ${dataset.id} 的关联可能导致重复统计`);
    }
    const localBoundaries = new Map<string, string | undefined>();
    for (const filter of dataset.filters) {
      const metadata = fields.find(
        (item) => item.source === filter.source && item.id === filter.name,
      );
      const contexts: Record<string, string> = {
        CURRENT_USER_ID: 'STRING',
        CURRENT_TENANT_ID: 'STRING',
        CURRENT_ORG_ID: 'ORGANIZATION',
        AUTHORIZED_ORG_IDS: 'ORGANIZATION',
      };
      const contextValid =
        filter.context &&
        metadata &&
        contexts[filter.context] === metadata.type &&
        filter.operator === (filter.context === 'AUTHORIZED_ORG_IDS' ? 'IN' : 'EQ');
      const parameterValid =
        filter.parameter && keyPattern.test(filter.parameter);
      const literalValid = filter.literal && metadata?.type === 'ENUM'
        && filter.operator === 'EQ' && metadata.choices?.some((choice) => choice.value === filter.literal);
      const boundaryValid = !filter.boundary || (!!filter.parameter && !!metadata
        && ['DATE', 'DATETIME'].includes(metadata.type)
        && ((filter.boundary === 'START' && filter.operator === 'GE') || (filter.boundary === 'END' && filter.operator === 'LE')));
      if (
        !metadata ||
        [contextValid, parameterValid, literalValid].filter(Boolean).length !== 1 ||
        (filter.context && !contextValid) ||
        (filter.operator === 'IN' && filter.context !== 'AUTHORIZED_ORG_IDS') ||
        (metadata.type === 'ENUM' && !(literalValid || (parameterValid && filter.operator === 'EQ'))) ||
        !boundaryValid ||
        (filter.literal && !literalValid) ||
        [filter.context, filter.parameter, filter.literal].filter((value) => value !== undefined).length !== 1
      )
        errors.push(`数据集 ${dataset.id} 包含不可用筛选字段`);
      else if (metadata.type === 'BOOLEAN' && filter.operator !== 'EQ')
        errors.push(`字段 ${metadata.title} 只支持等于筛选`);
      if (filter.parameter) {
        if (localBoundaries.has(filter.parameter) && localBoundaries.get(filter.parameter) !== filter.boundary)
          errors.push(`数据集 ${dataset.id} 的筛选项边界不一致`);
        localBoundaries.set(filter.parameter, filter.boundary);
      }
    }
  }
  const componentKeys = new Set<string>();
  const enumChoices = new Map<string, string>();
  const usedTimeGrains = new Set<string>();
  const usedRanges = new Set<string>();
  const parameterTypes: Record<string, string> = {
    BOOLEAN: 'BOOLEAN',
    DATE: 'DATE',
    DATETIME: 'DATETIME',
    DECIMAL: 'NUMBER',
    ENUM: 'ENUM',
    INTEGER: 'NUMBER',
    ORGANIZATION: 'ORGANIZATION',
    STRING: 'TEXT',
  };
  for (const component of design.components) {
    if (!keyPattern.test(component.id) || componentKeys.has(component.id))
      errors.push('组件标识无效或重复');
    componentKeys.add(component.id);
    if (!component.title.trim() || component.title.length > 128)
      errors.push('请填写有效的报表组件名称');
    const position = component.position;
    if (design.layout === 'GRID' && position.x + position.width > 12) {
      errors.push(`组件 ${component.title} 的横向位置超出 12 列`);
    }
    if (
      [position.x, position.y].some(
        (value) => !Number.isInteger(value) || value < 0 || value > 10_000,
      ) ||
      [position.width, position.height].some(
        (value) => !Number.isInteger(value) || value < 1 || value > 10_000,
      )
    ) {
      errors.push(`组件 ${component.title} 的位置或尺寸无效`);
    }
    const dataset = design.datasets.find(
      (item) => item.id === component.dataset,
    );
    if (!dataset) {
      errors.push(`组件 ${component.title} 的数据集不可用`);
      continue;
    }
    const localKeys = new Set(
      [...dataset.filters.flatMap((filter) => filter.parameter ? [filter.parameter] : []),
        ...dataset.fields.flatMap((field) => field.grainParameter ? [field.grainParameter] : [])],
    );
    const bindingKeys = Object.keys(component.bindings);
    if (
      bindingKeys.some((key) => !localKeys.has(key)) ||
      [...localKeys].some(
        (key) => !parameterKeys.has(component.bindings[key] || ''),
      )
    ) {
      errors.push(`组件 ${component.title} 的筛选条件尚未完整绑定`);
    }
    const fields = datasetFields(dataset, catalog);
    const rangeBounds = new Map<string, Set<string>>();
    for (const field of dataset.fields) {
      if (!field.grainParameter) continue;
      const parameter = design.parameters.find((item) => item.key === component.bindings[field.grainParameter!]);
      if (parameter && parameter.type !== 'TIME_GRAIN') errors.push(`组件 ${component.title} 的时间粒度条件类型不匹配`);
      if (parameter?.type === 'TIME_GRAIN') usedTimeGrains.add(parameter.key);
    }
    for (const filter of dataset.filters) {
      const parameterKey = filter.parameter;
      if (!parameterKey) continue;
      const field = fields.find(
        (item) => item.source === filter.source && item.id === filter.name,
      );
      const parameter = design.parameters.find(
        (item) => item.key === component.bindings[parameterKey],
      );
      if (filter.boundary && parameter && ['DATE_RANGE', 'DATETIME_RANGE'].includes(parameter.type)) {
        const bounds = rangeBounds.get(parameter.key) || new Set<string>();
        bounds.add(filter.boundary); rangeBounds.set(parameter.key, bounds);
      }
      const expected = field && filter.boundary
        ? (field.type === 'DATE' ? 'DATE_RANGE' : field.type === 'DATETIME' ? 'DATETIME_RANGE' : undefined)
        : field && parameterTypes[field.type];
      if (field && parameter && parameter.type !== expected) {
        errors.push(`组件 ${component.title} 的共享条件类型不匹配`);
      }
      if (field?.type === 'ENUM' && parameter?.type === 'ENUM') {
        const signature = JSON.stringify([...(field.choices || [])]
          .sort((a, b) => a.value.localeCompare(b.value) || a.label.localeCompare(b.label)));
        const previous = enumChoices.get(parameter.key);
        if (previous && previous !== signature) errors.push(`共享条件 ${parameter.title || parameter.key} 的枚举选项不一致`);
        enumChoices.set(parameter.key, signature);
      }
    }
    if ([...rangeBounds.values()].some((bounds) => !bounds.has('START') || !bounds.has('END')))
      errors.push(`组件 ${component.title} 的时间范围需同时绑定开始和结束`);
    for (const key of rangeBounds.keys()) usedRanges.add(key);
    const values = new Set(Object.values(component.bindings));
    if (
      design.parameters.some(
        (parameter) => parameter.requiredForAll && !values.has(parameter.key),
      )
    ) {
      errors.push(`组件 ${component.title} 未绑定所有要求联动的条件`);
    }
  }
  for (const parameter of design.parameters)
    if (parameter.type === 'ENUM' && !enumChoices.has(parameter.key))
      errors.push(`枚举共享条件 ${parameter.title || parameter.key} 尚未绑定筛选字段`);
    else if (parameter.type === 'TIME_GRAIN' && !usedTimeGrains.has(parameter.key))
      errors.push(`时间粒度条件 ${parameter.title || parameter.key} 尚未绑定时间字段`);
    else if (['DATE_RANGE', 'DATETIME_RANGE'].includes(parameter.type) && !usedRanges.has(parameter.key))
      errors.push(`时间范围条件 ${parameter.title || parameter.key} 尚未绑定筛选项`);
  return [...new Set(errors)];
}
