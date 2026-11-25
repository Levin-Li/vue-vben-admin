<script setup lang="ts">
import type {
  ReportComponent,
  ReportDataset,
  ReportDatasetField,
  ReportDatasetFilter,
  ReportGradient,
  ReportPageDesign,
  ReportParameterType,
  ReportSourceCatalog,
} from '../../api/report-definition-management-service';

import { computed, onBeforeUnmount, ref } from 'vue';

import { matchesPinyinFuzzySearch } from '@levin/admin-framework';

import {
  Alert,
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Tag,
} from 'ant-design-vue';

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
  validateReportDesign,
} from './report-design';
import { backgroundImage, reportBackground } from '../report-view/report-background';
import ReportDesignPreviewCard from './report-design-preview-card.vue';

const props = defineProps<{
  catalog: ReportSourceCatalog;
  disabled?: boolean;
  allowSavedDataPreview?: boolean;
}>();
const emit = defineEmits<{ 'image-pending': [boolean]; 'preview-saved-dataset': [string] }>();
// 页面草稿只在本地编辑；保存与发布由上层统一调用后端服务。
const design = defineModel<ReportPageDesign>({ required: true });
const dragging = ref<number>();
const bulkFields = ref<Record<string, string[]>>({});
// 步骤只影响当前编辑视图，不进入报表配置。
type DatasetStep = 'ALL' | 'RELATIONS' | 'FIELDS' | 'FILTERS';
const datasetSteps = ref<Record<string, DatasetStep>>({});
const datasetStepOptions: Array<{ label: string; value: DatasetStep }> = [
  { label: '全部配置', value: 'ALL' },
  { label: '1 关联来源', value: 'RELATIONS' },
  { label: '2 字段与统计', value: 'FIELDS' },
  { label: '3 筛选条件', value: 'FILTERS' },
];
function showDatasetStep(id: string, step: DatasetStep) {
  return !datasetSteps.value[id] || datasetSteps.value[id] === 'ALL' || datasetSteps.value[id] === step;
}
const gridDragOffset = ref({ x: 0, y: 0 });
const canvasDragOffset = ref({ x: 0, y: 0 });
const previewTarget = ref<HTMLElement>();
let previewWindow: Window | null = null;
function openDesignPreview() {
  if (previewWindow && !previewWindow.closed) { previewWindow.focus(); return; }
  const popup = window.open('', '_blank', 'popup,width=1200,height=850');
  if (!popup) { message.warning('预览窗口被浏览器拦截，请允许弹出窗口后重试'); return; }
  previewWindow = popup;
  popup.document.title = '报表设计预览';
  popup.document.documentElement.className = document.documentElement.className;
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((style) => popup.document.head.appendChild(style.cloneNode(true)));
  popup.document.body.style.margin = '16px';
  const target = popup.document.createElement('div');
  popup.document.body.appendChild(target);
  previewTarget.value = target;
  popup.addEventListener('beforeunload', () => {
    if (previewWindow === popup) { previewTarget.value = undefined; previewWindow = null; }
  }, { once: true });
}
const backgroundError = ref('');
let imageRevision = 0;
const backgroundStyle = computed(() => ({
  ...reportBackground(design.value.background),
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}));
onBeforeUnmount(() => {
  previewTarget.value = undefined;
  previewWindow?.close();
  previewWindow = null;
  imageRevision += 1;
  emit('image-pending', false);
});

function clearBackground() {
  imageRevision += 1;
  emit('image-pending', false);
  delete design.value.background.image;
  backgroundError.value = '';
}

// 渐变只由两个颜色和固定方向组成，避免保存任意样式。
function defaultGradient(): ReportGradient {
  return { from: '#eef5ff', to: '#f5efff', direction: 'DIAGONAL' };
}
function setPageGradient(enabled: boolean) {
  if (enabled) design.value.background.gradient = defaultGradient();
  else delete design.value.background.gradient;
}
function setComponentBackground(component: ReportComponent, mode: string) {
  if (mode === 'PRESET') delete component.background;
  else if (mode === 'SOLID') component.background = { color: component.background?.color || '#ffffff' };
  else if (mode === 'GRADIENT') component.background = { gradient: defaultGradient() };
}
function setComponentTone(component: ReportComponent, value: unknown) {
  component.tone = value as ReportComponent['tone'];
  delete component.background;
}

// 布局无法安全转换时保留原数据并提示调整组件位置。
function selectLayout(layout: ReportPageDesign['layout']) {
  if (!changeLayout(design.value, layout)) message.warning('布局超出可转换范围，请先调整组件位置或尺寸');
}

function chooseBackground(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const revision = ++imageRevision;
  emit('image-pending', false);
  backgroundError.value = '';
  input.value = '';
  if (!file) return;
  if (
    !['image/png', 'image/jpeg'].includes(file.type) ||
    file.size < 1 ||
    file.size > 256 * 1024
  ) {
    backgroundError.value = '请选择不超过 256 KiB 的 PNG 或 JPEG 图片';
    return;
  }
  emit('image-pending', true);
  const reader = new FileReader();
  reader.onerror = () => {
    if (revision === imageRevision) {
      backgroundError.value = '图片读取失败';
      emit('image-pending', false);
    }
  };
  reader.onload = () => {
    if (revision !== imageRevision) return;
    if (typeof reader.result !== 'string' || !backgroundImage(reader.result)) {
      backgroundError.value = '图片格式不受支持';
      emit('image-pending', false);
      return;
    }
    const value = reader.result;
    const image = new Image();
    image.onerror = () => {
      if (revision === imageRevision) {
        backgroundError.value = '图片无法解析';
        emit('image-pending', false);
      }
    };
    image.onload = () => {
      if (revision !== imageRevision) return;
      if (
        image.naturalWidth < 1 ||
        image.naturalHeight < 1 ||
        image.naturalWidth > 2048 ||
        image.naturalHeight > 2048
      ) {
        backgroundError.value = '图片宽高均不能超过 2048 像素';
        emit('image-pending', false);
        return;
      }
      design.value.background.image = value;
      emit('image-pending', false);
    };
    image.src = value;
  };
  try {
    reader.readAsDataURL(file);
  } catch {
    backgroundError.value = '图片读取失败';
    emit('image-pending', false);
  }
}
const errors = computed(() =>
  validateReportDesign(design.value, props.catalog),
);
const sources = computed(() =>
  props.catalog.sources.map((item) => ({ label: item.title, value: item.id })),
);
const parameterTypes: Array<{ label: string; value: ReportParameterType }> = [
  { label: '文本', value: 'TEXT' },
  { label: '日期', value: 'DATE' },
  { label: '日期范围', value: 'DATE_RANGE' },
  { label: '日期时间', value: 'DATETIME' },
  { label: '日期时间范围', value: 'DATETIME_RANGE' },
  { label: '数值', value: 'NUMBER' },
  { label: '是 / 否', value: 'BOOLEAN' },
  { label: '组织', value: 'ORGANIZATION' },
  { label: '枚举', value: 'ENUM' },
  { label: '时间粒度', value: 'TIME_GRAIN' },
];
const componentTypes = [
  { label: '明细表格', value: 'TABLE' },
  { label: '指标卡片', value: 'METRIC' },
  { label: '折线图', value: 'LINE' },
  { label: '柱状图', value: 'BAR' },
  { label: '饼图', value: 'PIE' },
];
const aggregations = [
  { label: '直接显示 / 分组', value: 'NONE' },
  { label: '求和', value: 'SUM' },
  { label: '计数', value: 'COUNT' },
  { label: '平均值', value: 'AVG' },
  { label: '最小值', value: 'MIN' },
  { label: '最大值', value: 'MAX' },
];
const operators = [
  { label: '等于', value: 'EQ' },
  { label: '大于或等于', value: 'GE' },
  { label: '小于或等于', value: 'LE' },
];

// 字段选项始终来自后端登记的受信目录。
function fieldOptions(dataset: ReportDataset) {
  return datasetFields(dataset, props.catalog).map((field) => ({
    label: `${field.sourceTitle} / ${field.title}`,
    value: `${field.source}:${field.id}`,
  }));
}

function unusedFieldOptions(dataset: ReportDataset) {
  const used = new Set(dataset.fields.map((field) => `${field.source}:${field.name}`));
  return fieldOptions(dataset).filter((option) => !used.has(option.value));
}

// 搜索已加载的来源和字段名称，同时支持目录字段标识。
function filterBulkField(input: string, option?: { label?: unknown; value?: unknown }) {
  return matchesPinyinFuzzySearch(input, String(option?.label ?? '')) ||
    String(option?.value ?? '').toLowerCase().includes(input.trim().toLowerCase());
}

function reconcileBulkFields(dataset: ReportDataset) {
  const available = new Set(unusedFieldOptions(dataset).map((option) => option.value));
  bulkFields.value[dataset.id] = (bulkFields.value[dataset.id] || []).filter((value) => available.has(value));
}

function appendSelectedFields(dataset: ReportDataset) {
  const selected = bulkFields.value[dataset.id] || [];
  const available = new Set(unusedFieldOptions(dataset).map((option) => option.value));
  if (!selected.length || selected.some((value) => !available.has(value)) || new Set(selected).size !== selected.length) {
    message.warning('请选择当前可用且尚未添加的字段');
    return;
  }
  if (dataset.fields.length + selected.length > 64) {
    message.warning('一个数据集最多可添加 64 个展示字段');
    return;
  }
  for (const value of selected) {
    const [source, name] = value.split(':');
    if (source && name) dataset.fields.push({ source, name, aggregation: 'NONE' });
  }
  bulkFields.value[dataset.id] = [];
}

function relationOptions(dataset: ReportDataset) {
  return availableRelations(dataset, props.catalog).map((relation) => {
    return {
      label: relationLabel(relation.id),
      value: relation.id,
    };
  });
}

function relationLabel(id: string, outer = false) {
  const relation = props.catalog.relations.find((item) => item.id === id);
  if (!relation) return '关联不可用';
  const left = props.catalog.sources.find(
    (item) => item.id === relation.leftSource,
  );
  const right = props.catalog.sources.find(
    (item) => item.id === relation.rightSource,
  );
  const leftField = left?.fields.find(
    (field) => field.id === relation.leftField,
  )?.title;
  const rightField = right?.fields.find(
    (field) => field.id === relation.rightField,
  )?.title;
  const kind = outer ? '左连接' : '内连接';
  const cardinality = relation.multipliesLeft
    ? relation.leftPrimaryKey ? `（一对多，${kind}，主键已验证）` : `（一对多，${kind}，聚合受限）`
    : `（最多匹配一条，${kind}）`;
  return `${left?.title || relation.leftSource} / ${leftField || relation.leftField} → ${right?.title || relation.rightSource} / ${rightField || relation.rightField}${cardinality}`;
}

function datasetName(id: string) {
  const index = design.value.datasets.findIndex((item) => item.id === id);
  if (index < 0) return '未选择数据集';
  const dataset = design.value.datasets[index];
  const source = props.catalog.sources.find((item) => item.id === dataset?.root)?.title || '未选择数据源';
  return dataset?.title?.trim()
    ? `数据集 ${index + 1} · ${dataset.title.trim()}（${source}）`
    : `数据集 ${index + 1} · ${source}`;
}

function setDatasetTitle(dataset: ReportDataset, value: string) {
  if (value.length === 0) delete dataset.title;
  else dataset.title = value;
}

function changeField(
  target: ReportDatasetField | ReportDatasetFilter,
  value: string,
) {
  const [source, name] = value.split(':');
  if (source && name) {
    target.source = source;
    target.name = name;
    if ('aggregation' in target) delete target.grain;
  }
}

function changeProjectionField(dataset: ReportDataset, field: ReportDatasetField, value: string) {
  if (`${field.source}:${field.name}` !== value) delete field.title;
  changeField(field, value);
  delete field.grainParameter;
  if (!aggregationOptions(dataset, field).some((option) => option.value === field.aggregation)) field.aggregation = 'NONE';
  if (!isNumericField(dataset, field)) { delete field.display; delete field.unit; }
  reconcileBulkFields(dataset);
  cleanBindings(dataset);
}

function isDateField(dataset: ReportDataset, field: ReportDatasetField) {
  const metadata = datasetFields(dataset, props.catalog).find((item) => item.source === field.source && item.id === field.name);
  return field.aggregation === 'NONE' && (metadata?.type === 'DATE' || metadata?.type === 'DATETIME');
}

function setGrain(dataset: ReportDataset, field: ReportDatasetField, value: string) {
  if (value === 'PARAMETER') {
    delete field.grain;
    const used = new Set([...dataset.filters.map((item) => item.parameter), ...dataset.fields.map((item) => item.grainParameter)]);
    let index = 1;
    while (used.has(`grain${index}`)) index += 1;
    field.grainParameter = `grain${index}`;
  } else {
    delete field.grainParameter;
    if (value === 'DAY' || value === 'MONTH') field.grain = value;
    else delete field.grain;
  }
  cleanBindings(dataset);
}

function appendField(dataset: ReportDataset) {
  // 优先选择尚未展示的字段；全部使用后仍允许重复以配置不同聚合。
  const available = datasetFields(dataset, props.catalog);
  const first = available.find((candidate) => !dataset.fields.some((field) =>
    field.source === candidate.source && field.name === candidate.id)) || available[0];
  if (first) {
    dataset.fields.push({
      source: first.source,
      name: first.id,
      aggregation: 'NONE',
    });
    reconcileBulkFields(dataset);
  }
}

function moveField(dataset: ReportDataset, index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= dataset.fields.length) return;
  const [field] = dataset.fields.splice(index, 1);
  if (field) dataset.fields.splice(target, 0, field);
}

function setDatasetLimit(dataset: ReportDataset, value: number | string | null) {
  if (value === null || value === '') delete dataset.limit;
  else dataset.limit = Number(value);
}

function isNumericField(dataset: ReportDataset, field: ReportDatasetField) {
  const metadata = datasetFields(dataset, props.catalog).find(
    (item) => item.source === field.source && item.id === field.name,
  );
  return (
    field.aggregation === 'COUNT' ||
    metadata?.type === 'INTEGER' ||
    metadata?.type === 'DECIMAL'
  );
}

function aggregationOptions(dataset: ReportDataset, field: ReportDatasetField) {
  const type = datasetFields(dataset, props.catalog).find((item) => item.source === field.source && item.id === field.name)?.type;
  if (!type) return [];
  if (type === 'ENUM' || type === 'BOOLEAN') return aggregations.filter((option) => ['NONE', 'COUNT'].includes(option.value));
  if (type !== 'INTEGER' && type !== 'DECIMAL') return aggregations.filter((option) => !['SUM', 'AVG'].includes(option.value));
  return aggregations;
}

function changeDisplay(field: ReportDatasetField, value: string) {
  if (value === 'MONEY' || value === 'QUANTITY' || value === 'PLAIN') {
    field.display = value;
    if (value === 'PLAIN') delete field.unit;
  } else {
    delete field.display;
    delete field.unit;
  }
}

function changeSort(field: ReportDatasetField, value: string) {
  if (value === 'ASC' || value === 'DESC') field.sort = value;
  else delete field.sort;
}

function aggregationChanged(dataset: ReportDataset, field: ReportDatasetField) {
  if (field.aggregation !== 'NONE') { delete field.grain; delete field.grainParameter; cleanBindings(dataset); }
  if (field.aggregation === 'COUNT' && field.display === 'MONEY') {
    delete field.display;
    delete field.unit;
  }
  if (field.aggregation !== 'COUNT' && !field.display) delete field.unit;
}

function appendFilter(dataset: ReportDataset) {
  const first = datasetFields(dataset, props.catalog)[0];
  if (!first) return;
  const used = new Set(dataset.filters.map((item) => item.parameter));
  let index = 1;
  while (used.has(`condition${index}`)) index += 1;
  dataset.filters.push({
    source: first.source,
    name: first.id,
    operator: 'EQ',
    ...(first.type === 'ENUM' && first.choices?.[0]
      ? { literal: first.choices[0].value }
      : { parameter: `condition${index}` }),
  });
}

function filterValueOptions(
  dataset: ReportDataset,
  filter: ReportDatasetFilter,
) {
  const field = datasetFields(dataset, props.catalog).find(
    (item) => item.source === filter.source && item.id === filter.name,
  );
  if (field?.type === 'ENUM') return [
    { label: '页面共享条件', value: 'PARAMETER' },
    ...(field.choices || []).map((choice) => ({ label: choice.label, value: `LITERAL:${choice.value}` })),
  ];
  return [
    { label: '页面共享条件', value: 'PARAMETER' },
    ...(field?.type === 'STRING'
      ? [
          { label: '当前用户 ID', value: 'CURRENT_USER_ID' },
          { label: '当前租户 ID', value: 'CURRENT_TENANT_ID' },
        ]
      : []),
    ...(field?.type === 'ORGANIZATION'
      ? [
          { label: '当前用户组织', value: 'CURRENT_ORG_ID' },
          { label: '当前授权组织列表', value: 'AUTHORIZED_ORG_IDS' },
        ]
      : []),
  ];
}

function setFilterValue(
  dataset: ReportDataset,
  filter: ReportDatasetFilter,
  value: string,
) {
  if (value === 'PARAMETER') {
    delete filter.context;
    delete filter.literal;
    if (filter.operator === 'IN') filter.operator = 'EQ';
    const used = new Set(dataset.filters.map((item) => item.parameter));
    let index = 1;
    while (used.has(`condition${index}`)) index += 1;
    filter.parameter = `condition${index}`;
  } else if (
    ['CURRENT_USER_ID', 'CURRENT_TENANT_ID', 'CURRENT_ORG_ID', 'AUTHORIZED_ORG_IDS'].includes(value)
  ) {
    delete filter.parameter;
    delete filter.literal;
    delete filter.boundary;
    filter.context = value as NonNullable<ReportDatasetFilter['context']>;
    filter.operator = value === 'AUTHORIZED_ORG_IDS' ? 'IN' : 'EQ';
  } else if (value.startsWith('LITERAL:')) {
    delete filter.parameter;
    delete filter.context;
    delete filter.boundary;
    filter.literal = value.slice('LITERAL:'.length);
    filter.operator = 'EQ';
  }
  cleanBindings(dataset);
}

function changeFilterField(dataset: ReportDataset, filter: ReportDatasetFilter, value: string) {
  changeField(filter, value);
  delete filter.boundary;
  const field = datasetFields(dataset, props.catalog).find((item) => item.source === filter.source && item.id === filter.name);
  const first = field?.type === 'ENUM' ? field.choices?.[0] : undefined;
  setFilterValue(dataset, filter, first ? `LITERAL:${first.value}` : 'PARAMETER');
}

function isTimeFilter(dataset: ReportDataset, filter: ReportDatasetFilter) {
  const field = datasetFields(dataset, props.catalog).find((item) => item.source === filter.source && item.id === filter.name);
  return field?.type === 'DATE' || field?.type === 'DATETIME';
}

function setBoundary(dataset: ReportDataset, filter: ReportDatasetFilter, value: string) {
  if (value === 'START' || value === 'END') {
    filter.boundary = value;
    filter.operator = value === 'START' ? 'GE' : 'LE';
  } else delete filter.boundary;
  for (const component of design.value.components.filter((item) => item.dataset === dataset.id))
    if (filter.parameter) delete component.bindings[filter.parameter];
}

// 切换主来源或移除关联后，清除依赖字段，防止保留失效引用。
function confirmRootChange(dataset: ReportDataset, root: string) {
  if (root === dataset.root) return;
  if (
    dataset.relations.length === 0 &&
    dataset.fields.length === 0 &&
    dataset.filters.length === 0
  ) {
    resetRoot(dataset, root);
    return;
  }
  Modal.confirm({
    title: '更换数据源？',
    content: '当前数据集的关联、字段、筛选和组件绑定会被清除。',
    onOk: () => resetRoot(dataset, root),
  });
}

function resetRoot(dataset: ReportDataset, root: string) {
  delete bulkFields.value[dataset.id];
  delete dataset.leftRelations;
  dataset.root = root;
  dataset.relations = [];
  dataset.fields = [];
  dataset.filters = [];
  design.value.components
    .filter((item) => item.dataset === dataset.id)
    .forEach((item) => {
      item.bindings = {};
    });
}

function confirmRemoveRelation(dataset: ReportDataset, index: number) {
  Modal.confirm({
    title: '移除关联？',
    content: '依赖该关联的后续关联及不再可用的字段和筛选项也会被移除；其他分支会保留。',
    onOk: () => removeRelation(dataset, index),
  });
}

function removeRelation(dataset: ReportDataset, index: number) {
  const included = new Set([dataset.root]);
  dataset.relations = dataset.relations.filter((id, relationIndex) => {
    if (relationIndex === index) return false;
    const relation = props.catalog.relations.find((item) => item.id === id);
    if (!relation || !included.has(relation.leftSource) || included.has(relation.rightSource)) return false;
    included.add(relation.rightSource);
    return true;
  });
  if (dataset.leftRelations) dataset.leftRelations = dataset.leftRelations.filter((id) => dataset.relations.includes(id));
  const valid = new Set(
    datasetFields(dataset, props.catalog).map(
      (field) => `${field.source}:${field.id}`,
    ),
  );
  bulkFields.value[dataset.id] = (bulkFields.value[dataset.id] || []).filter((field) => valid.has(field));
  dataset.fields = dataset.fields.filter((field) =>
    valid.has(`${field.source}:${field.name}`),
  );
  dataset.filters = dataset.filters.filter((filter) =>
    valid.has(`${filter.source}:${filter.name}`),
  );
  cleanBindings(dataset);
}

function setJoinMode(dataset: ReportDataset, relation: string, mode: string) {
  const selected = new Set(dataset.leftRelations || []);
  if (mode === 'LEFT') selected.add(relation);
  else selected.delete(relation);
  if (selected.size) dataset.leftRelations = [...selected];
  else delete dataset.leftRelations;
}

function cleanBindings(dataset: ReportDataset) {
  const keys = new Set([...dataset.filters.map((item) => item.parameter), ...dataset.fields.map((item) => item.grainParameter)]);
  for (const component of design.value.components.filter(
    (item) => item.dataset === dataset.id,
  )) {
    for (const key of Object.keys(component.bindings))
      if (!keys.has(key)) delete component.bindings[key];
  }
}

function removeDataset(index: number) {
  const [removed] = design.value.datasets.splice(index, 1);
  if (removed) {
    delete bulkFields.value[removed.id];
    delete datasetSteps.value[removed.id];
    design.value.components = design.value.components.filter(
      (item) => item.dataset !== removed.id,
    );
  }
}

function copyDataset(index: number) {
  if (!duplicateDataset(design.value, index)) message.warning('数据集数量已达上限');
}

function copyComponent(index: number) {
  if (!duplicateComponent(design.value, index)) message.warning('组件数量已达上限或页面没有可用位置');
}

function removeParameter(index: number) {
  const [removed] = design.value.parameters.splice(index, 1);
  if (!removed) return;
  for (const component of design.value.components) {
    for (const [key, value] of Object.entries(component.bindings))
      if (value === removed.key) delete component.bindings[key];
  }
}

function parameterIsBound(key: string) {
  return design.value.components.some((component) => Object.values(component.bindings).includes(key));
}

function setComponentDataset(component: ReportComponent, dataset: string) {
  if (component.dataset === dataset) return;
  const apply = () => {
    component.dataset = dataset;
    component.bindings = {};
  };
  if (Object.keys(component.bindings).length === 0) {
    apply();
    return;
  }
  Modal.confirm({
    title: '切换组件数据集？',
    content: '切换后将清除该组件的共享条件绑定，需要重新配置。',
    onOk: apply,
  });
}

function parameterOptions(
  component: ReportComponent,
  filter: ReportDatasetFilter,
) {
  const dataset = design.value.datasets.find(
    (item) => item.id === component.dataset,
  );
  const field =
    dataset &&
    datasetFields(dataset, props.catalog).find(
      (item) => item.source === filter.source && item.id === filter.name,
    );
  const compatible: Record<string, ReportParameterType> = {
    BOOLEAN: 'BOOLEAN',
    DATE: 'DATE',
    DATETIME: 'DATETIME',
    DECIMAL: 'NUMBER',
    ENUM: 'ENUM',
    INTEGER: 'NUMBER',
    ORGANIZATION: 'ORGANIZATION',
    STRING: 'TEXT',
  };
  const expected = field && filter.boundary
    ? (field.type === 'DATE' ? 'DATE_RANGE' : field.type === 'DATETIME' ? 'DATETIME_RANGE' : undefined)
    : field && compatible[field.type];
  return design.value.parameters
    .filter((item) => item.type === expected)
    .map((item) => ({ label: item.title || item.key, value: item.key }));
}

// 保留抓取点，避免组件在拖放后跳到鼠标左上角。
function startCanvasDrag(event: DragEvent, index: number) {
  dragging.value = index;
  if (event.currentTarget) {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    canvasDragOffset.value = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  event.dataTransfer?.setData('text/plain', String(index));
}

// 自由画布按拖放位置更新坐标，允许输入框继续进行精确调整。
function onCanvasDrop(event: DragEvent) {
  if (
    dragging.value === undefined ||
    !event.currentTarget
  )
    return;
  const target = event.currentTarget as HTMLElement;
  const bounds = target.getBoundingClientRect();
  moveCanvasComponent(
    design.value,
    dragging.value,
    event.clientX - bounds.left + target.scrollLeft - canvasDragOffset.value.x,
    event.clientY - bounds.top + target.scrollTop - canvasDragOffset.value.y,
  );
  dragging.value = undefined;
}

function onDrop(index: number) {
  if (dragging.value !== undefined && dragging.value !== index
      && !swapGridComponents(design.value, dragging.value, index))
    message.warning('目标位置无法放置，请调整组件尺寸或选择空白区域');
  dragging.value = undefined;
}

function startGridDrag(event: DragEvent, index: number) {
  dragging.value = index;
  if (event.currentTarget) {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    gridDragOffset.value = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  event.dataTransfer?.setData('text/plain', String(index));
}

function onGridDrop(event: DragEvent) {
  const index = dragging.value;
  if (index === undefined || !event.currentTarget) return;
  const grid = event.currentTarget as HTMLElement;
  const bounds = grid.getBoundingClientRect();
  const style = (grid.ownerDocument.defaultView || window).getComputedStyle(grid);
  const left = Number.parseFloat(style.paddingLeft) || 0;
  const top = Number.parseFloat(style.paddingTop) || 0;
  const right = Number.parseFloat(style.paddingRight) || 0;
  const columnGap = Number.parseFloat(style.columnGap) || 0;
  const rowGap = Number.parseFloat(style.rowGap) || 0;
  const rowHeight = Number.parseFloat(style.gridAutoRows) || 40;
  const columnStep = (grid.clientWidth - left - right + columnGap) / 12;
  const x = Math.round((event.clientX - bounds.left - left - gridDragOffset.value.x) / columnStep);
  const y = Math.round((event.clientY - bounds.top - top - gridDragOffset.value.y) / (rowHeight + rowGap));
  if (!Number.isFinite(columnStep) || columnStep <= 0 || !moveGridComponent(design.value, index, x, y))
    message.warning('目标位置无法放置，请选择不重叠的网格区域');
  dragging.value = undefined;
}
</script>

<template>
  <div class="report-design-workspace" data-testid="report-design-editor">
    <Button type="primary" @click="openDesignPreview">预览</Button>
    <div class="report-design-controls space-y-4">
    <Alert
      v-if="errors.length > 0"
      type="warning"
      show-icon
      :message="errors[0]"
    />
    <!-- 图片随草稿和发布版本保存，后端再次验证内容及尺寸。 -->
    <section class="bg-card rounded-lg border p-4">
      <h3 class="mb-3 font-semibold">页面样式</h3>
      <div class="flex flex-wrap items-center gap-3">
        <span>页面名称</span>
        <Input
          v-model:value="design.title"
          :disabled="disabled"
          class="w-44"
          placeholder="页面名称"
        />
        <span>布局</span>
        <Select
          :value="design.layout"
          :disabled="disabled"
          @change="
            (value) => selectLayout(value as ReportPageDesign['layout'])
          "
          class="w-36"
          :options="[
            { label: '网格布局', value: 'GRID' },
            { label: '自由画布', value: 'CANVAS' },
          ]"
        />
        <span>背景颜色</span>
        <input
          v-model="design.background.color"
          :disabled="disabled"
          aria-label="背景颜色"
          type="color"
        />
        <label class="flex items-center gap-1">
          <Switch :checked="!!design.background.gradient" :disabled="disabled" aria-label="页面背景渐变" size="small" @change="(value) => setPageGradient(value === true)" />页面渐变
        </label>
        <template v-if="design.background.gradient">
          <label>起始色 <input v-model="design.background.gradient.from" :disabled="disabled" aria-label="页面渐变起始色" type="color" /></label>
          <label>结束色 <input v-model="design.background.gradient.to" :disabled="disabled" aria-label="页面渐变结束色" type="color" /></label>
          <Select v-model:value="design.background.gradient.direction" :disabled="disabled" class="w-32" aria-label="页面渐变方向"
            :options="[{ label: '从左到右', value: 'HORIZONTAL' }, { label: '从上到下', value: 'VERTICAL' }, { label: '斜向', value: 'DIAGONAL' }]" />
        </template>
        <label
          >背景图片
          <input
            type="file"
            accept="image/png,image/jpeg"
            :disabled="disabled"
            @change="chooseBackground"
          />
        </label>
        <Button
          v-if="design.background.image"
          :disabled="disabled"
          @click="clearBackground"
          >移除图片</Button
        >
      </div>
      <p class="text-muted-foreground mt-2 text-xs">
        PNG 或 JPEG，不超过 256 KiB，宽高均不超过 2048 像素。
      </p>
      <Alert
        v-if="backgroundError"
        type="warning"
        show-icon
        :message="backgroundError"
      />
    </section>

    <!-- 共享条件由页面定义，组件各自绑定到数据集筛选项。 -->
    <section class="bg-card rounded-lg border p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">页面共享条件</h3>
        <Button :disabled="disabled" @click="addParameter(design)">
          添加条件
        </Button>
      </div>
      <div
        v-for="(parameter, index) in design.parameters"
        :key="parameter.key"
        :data-report-parameter="parameter.key"
        class="mb-2 flex flex-wrap items-center gap-2"
      >
        <Input
          v-model:value="parameter.title"
          :disabled="disabled"
          class="w-44"
          placeholder="条件名称"
        />
        <Select
          v-model:value="parameter.type"
          :disabled="disabled"
          class="w-36"
          :options="parameterTypes"
          @change="(value) => { if (value === 'TIME_GRAIN') parameter.required = true; }"
        />
        <label class="flex items-center gap-1"
          ><Switch
            v-model:checked="parameter.required"
            :disabled="disabled || parameter.type === 'TIME_GRAIN'"
            size="small"
          />必填</label
        >
        <label class="flex items-center gap-1"
          ><Switch
            v-model:checked="parameter.requiredForAll"
            :disabled="disabled"
            size="small"
          />所有报表联动</label
        >
        <Popconfirm
          title="移除后将解除组件绑定，需要重新配置。确认移除？"
          :disabled="disabled || !parameterIsBound(parameter.key)"
          @confirm="removeParameter(index)"
        >
          <Button danger type="link" :disabled="disabled"
            @click="!parameterIsBound(parameter.key) && removeParameter(index)">
            移除
          </Button>
        </Popconfirm>
      </div>
      <p v-if="design.parameters.length === 0" class="text-muted-foreground">
        可添加时间、组织等供多个报表共享的条件。
      </p>
    </section>

    <!-- 数据集按受信目录逐步选择主来源、多表关联、字段和筛选项。 -->
    <section class="bg-card rounded-lg border p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">数据集</h3>
        <Button
          :disabled="disabled || sources.length === 0"
          @click="addDataset(design, sources[0]!.value)"
        >
          添加数据集
        </Button>
      </div>
      <div
        v-for="(dataset, index) in design.datasets"
        :key="dataset.id"
        :data-report-dataset="dataset.id"
        class="mb-4 space-y-3 rounded-md border p-3"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Tag>数据集 {{ index + 1 }}</Tag
          ><Input
            :value="dataset.title || ''"
            :disabled="disabled"
            :maxlength="128"
            class="w-44"
            aria-label="数据集名称"
            placeholder="数据集名称（可选）"
            @update:value="(value) => setDatasetTitle(dataset, String(value))"
          />
          <span>主数据源</span>
          <Select
            :value="dataset.root"
            :disabled="disabled"
            aria-label="主数据源"
            class="w-44"
            :options="sources"
            @change="(value) => confirmRootChange(dataset, String(value))"
          />
          <span>显示前</span>
          <InputNumber :value="dataset.limit" :min="1" :max="100" :precision="0"
            :disabled="disabled" class="w-24" aria-label="显示数量" placeholder="100"
            @change="(value) => setDatasetLimit(dataset, value)" />
          <span>条</span>
          <Button size="small" :disabled="disabled" :aria-label="`复制数据集 ${index + 1}`"
            @click="copyDataset(index)">复制数据集</Button>
          <Button v-if="allowSavedDataPreview" size="small" :disabled="disabled"
            :aria-label="`预览数据集 ${index + 1} 的已保存数据`"
            @click="emit('preview-saved-dataset', dataset.id)">预览已保存数据</Button>
          <Popconfirm
            title="移除数据集及其所有组件？"
            @confirm="removeDataset(index)"
          >
            <Button danger type="link" :disabled="disabled">
              移除数据集及其组件
            </Button>
          </Popconfirm>
        </div>
        <p class="text-muted-foreground text-xs">按顺序选择主数据源、添加关联表、选择展示字段与统计方式，最后设置筛选条件。</p>
        <!-- 每个数据集可独立切换编辑步骤；示例预览始终保留。 -->
        <nav class="flex flex-wrap gap-2" :aria-label="`数据集 ${index + 1} 编辑步骤`">
          <Button v-for="step in datasetStepOptions" :key="step.value" size="small"
            :type="(datasetSteps[dataset.id] || 'ALL') === step.value ? 'primary' : 'default'"
            :aria-pressed="(datasetSteps[dataset.id] || 'ALL') === step.value"
            :aria-label="`数据集 ${index + 1} ${step.label}`"
            @click="datasetSteps[dataset.id] = step.value">{{ step.label }}</Button>
        </nav>
        <div v-show="showDatasetStep(dataset.id, 'RELATIONS')" :data-report-step="'relations'">
        <div class="flex flex-wrap items-center gap-2">
          <span>多表关联</span
          ><span v-for="(relation, relationIndex) in dataset.relations" :key="relation" class="inline-flex items-center gap-1">
          <Tag
            :data-relation-id="relation"
            :closable="!disabled"
            @close.prevent="confirmRemoveRelation(dataset, relationIndex)"
          >
            {{ relationLabel(relation, dataset.leftRelations?.includes(relation)) }} </Tag>
          <Select
            :value="dataset.leftRelations?.includes(relation) ? 'LEFT' : 'INNER'"
            :disabled="disabled"
            :aria-label="`关联 ${relation} 的连接方式`"
            class="w-28"
            :options="[{ label: '内连接', value: 'INNER' }, { label: '左连接', value: 'LEFT' }]"
            @change="(value) => setJoinMode(dataset, relation, String(value))"
          />
          </span><Select
            :disabled="disabled || relationOptions(dataset).length === 0"
            :dropdown-match-select-width="false"
            class="w-48"
            placeholder="选择关联表"
            :options="relationOptions(dataset)"
            @change="(value) => dataset.relations.push(String(value))"
          />
        </div>
        <p class="text-muted-foreground text-xs">服务端自动对每个来源应用数据范围，无需重复配置。内连接仅保留可见的匹配记录；左连接保留左侧记录，右侧无匹配或不可见时显示空值，不计入明细统计。对右表设置筛选可能排除空值。一对多统计需以明细为指标。</p>
        </div>
        <div v-show="showDatasetStep(dataset.id, 'FIELDS')" :data-report-step="'fields'">
        <div class="flex flex-wrap items-center gap-2">
          <span>汇总方式</span>
          <Select
            :value="dataset.aggregationMode || 'STANDARD'"
            :disabled="disabled"
            :aria-label="`数据集 ${index + 1} 的汇总方式`"
            class="w-44"
            :options="[{ label: '普通汇总', value: 'STANDARD' }, { label: '按事实去重汇总', value: 'FACT_DISTINCT' }]"
            @change="(value) => { if (value === 'FACT_DISTINCT') dataset.aggregationMode = 'FACT_DISTINCT'; else delete dataset.aggregationMode; }"
          />
          <span class="text-muted-foreground text-xs">多对多或多事实汇总可按每个来源的记录去重；同一记录进入不同分组时分别计算。</span>
        </div>
        <div>
          <div class="mb-2 flex items-center justify-between">
            <span>展示字段与统计</span
            ><Button
              size="small"
              :disabled="disabled || fieldOptions(dataset).length === 0"
              @click="appendField(dataset)"
            >
              添加字段
            </Button>
          </div>
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <Select
              :value="bulkFields[dataset.id] || []"
              :disabled="disabled || unusedFieldOptions(dataset).length === 0"
              :dropdown-match-select-width="false"
              :options="unusedFieldOptions(dataset)"
              :aria-label="`批量选择数据集 ${index + 1} 的字段`"
              class="min-w-64 flex-1"
              mode="multiple"
              :filter-option="filterBulkField"
              placeholder="搜索来源或字段，一次选择多个"
              show-search
              @update:value="(value) => { bulkFields[dataset.id] = value as string[]; }"
            />
            <Button
              size="small"
              :disabled="disabled || !(bulkFields[dataset.id] || []).length"
              :aria-label="`批量添加数据集 ${index + 1} 的字段`"
              @click="appendSelectedFields(dataset)"
            >批量添加</Button>
          </div>
        <p class="text-muted-foreground mb-2 text-xs">
            字段顺序决定展示顺序；多个排序按字段从上到下依次生效。
          </p>
          <p v-if="dataset.fields.some((field) => isDateField(dataset, field))" class="text-muted-foreground mb-2 text-xs">
            时间分组使用字段本身的本地时间，不自动转换时区。
          </p>
          <div
            v-for="(field, fieldIndex) in dataset.fields"
            :key="fieldIndex"
            class="mb-2 flex flex-wrap gap-2"
          >
            <Select
              :value="`${field.source}:${field.name}`"
              aria-label="展示字段"
              :disabled="disabled"
              class="w-56"
              :options="fieldOptions(dataset)"
              @change="(value) => changeProjectionField(dataset, field, String(value))"
            /><Input
              :value="field.title || ''"
              :disabled="disabled"
              :maxlength="128"
              class="w-40"
              aria-label="字段显示名称"
              placeholder="显示名称（可选）"
              @update:value="(value) => { if (value === '') delete field.title; else field.title = String(value); }"
            /><Select
              v-model:value="field.aggregation"
              :disabled="disabled"
              class="w-40"
              :options="aggregationOptions(dataset, field)"
              @change="aggregationChanged(dataset, field)"
            /><Select
              v-if="isDateField(dataset, field)"
              :value="field.grainParameter ? 'PARAMETER' : field.grain || 'NONE'"
              :disabled="disabled"
              class="w-36"
              aria-label="时间分组"
              :options="[
                { label: '原始时间', value: 'NONE' },
                { label: '按日', value: 'DAY' },
                { label: '按月', value: 'MONTH' },
                { label: '页面共享粒度', value: 'PARAMETER' },
              ]"
              @change="(value) => setGrain(dataset, field, String(value))"
            /><Select
              :value="field.sort || 'NONE'"
              :disabled="disabled"
              class="w-32"
              aria-label="字段排序"
              :options="[
                { label: '不排序', value: 'NONE' },
                { label: '升序', value: 'ASC' },
                { label: '降序', value: 'DESC' },
              ]"
              @change="(value) => changeSort(field, String(value))"
            /><Select
              v-if="isNumericField(dataset, field)"
              :value="
                field.aggregation === 'COUNT'
                  ? 'QUANTITY'
                  : field.display || 'AUTO'
              "
              :disabled="disabled || field.aggregation === 'COUNT'"
              class="w-32"
              aria-label="数值展示语义"
              :options="[
                { label: '自动识别', value: 'AUTO' },
                { label: '普通数值', value: 'PLAIN' },
                { label: '金额', value: 'MONEY' },
                { label: '数量', value: 'QUANTITY' },
              ]"
              @change="(value) => changeDisplay(field, String(value))"
            /><Input
              v-if="
                field.aggregation === 'COUNT' ||
                field.display === 'MONEY' ||
                field.display === 'QUANTITY'
              "
              v-model:value="field.unit"
              :disabled="disabled"
              :maxlength="12"
              class="w-28"
              placeholder="单位（可选）"
            /><Button
              size="small"
              :disabled="disabled || fieldIndex === 0"
              :aria-label="`上移字段 ${fieldIndex + 1}`"
              @click="moveField(dataset, fieldIndex, -1)"
            >↑</Button><Button
              size="small"
              :disabled="disabled || fieldIndex === dataset.fields.length - 1"
              :aria-label="`下移字段 ${fieldIndex + 1}`"
              @click="moveField(dataset, fieldIndex, 1)"
            >↓</Button><Button
              danger
              type="link"
              :disabled="disabled"
              @click="dataset.fields.splice(fieldIndex, 1); cleanBindings(dataset)"
            >
              移除
            </Button>
          </div>
        </div>
        </div>
        <div v-show="showDatasetStep(dataset.id, 'FILTERS')" :data-report-step="'filters'">
          <div class="mb-2 flex items-center justify-between">
            <span>筛选条件</span
            ><Button
              size="small"
              :disabled="disabled || fieldOptions(dataset).length === 0"
              @click="appendFilter(dataset)"
            >
              添加筛选
            </Button>
          </div>
          <div
            v-for="(filter, filterIndex) in dataset.filters"
            :key="filterIndex"
            class="mb-2 flex flex-wrap gap-2"
          >
            <Select
              :value="`${filter.source}:${filter.name}`"
              aria-label="筛选字段"
              :disabled="disabled"
              class="w-56"
              :options="fieldOptions(dataset)"
              @change="(value) => changeFilterField(dataset, filter, String(value))"
            /><Select
              v-model:value="filter.operator"
              :disabled="disabled || !!filter.context || !!filter.literal || !!filter.boundary"
              class="w-36"
              :options="filter.context === 'AUTHORIZED_ORG_IDS' ? [...operators, { label: '属于', value: 'IN' }] : operators"
            /><Select
              v-if="isTimeFilter(dataset, filter)"
              :value="filter.boundary || 'NONE'"
              :disabled="disabled || !filter.parameter"
              class="w-36"
              aria-label="时间范围边界"
              :options="[
                { label: '单个时间', value: 'NONE' },
                { label: '范围开始', value: 'START' },
                { label: '范围结束', value: 'END' },
              ]"
              @change="(value) => setBoundary(dataset, filter, String(value))"
            /><Select
              :value="filter.literal ? `LITERAL:${filter.literal}` : filter.context || 'PARAMETER'"
              :disabled="disabled"
              class="w-44"
              :options="filterValueOptions(dataset, filter)"
              @change="
                (value) => setFilterValue(dataset, filter, String(value))
              "
            /><Button
              danger
              type="link"
              :disabled="disabled"
              @click="
                dataset.filters.splice(filterIndex, 1);
                cleanBindings(dataset);
              "
            >
              移除
            </Button>
          </div>
        </div>
        <!-- 数据集预览只演示所选列，不运行未保存的查询。 -->
        <details class="rounded border p-2" :data-dataset-preview="dataset.id">
          <summary class="cursor-pointer text-sm">预览已选字段（示例数据）</summary>
          <ReportDesignPreviewCard :catalog="catalog" :dataset="dataset"
            :component="{ id: `preview_${dataset.id}`, title: dataset.title || '数据集预览', type: 'TABLE', dataset: dataset.id, bindings: {}, position: { x: 0, y: 0, width: 12, height: 4 } }" />
        </details>
      </div>
    </section>

    <!-- 每个组件明确选择数据集并绑定页面共享参数。 -->
    <section class="bg-card rounded-lg border p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">报表组件</h3>
        <Button
          :disabled="disabled || design.datasets.length === 0"
          @click="addComponent(design, design.datasets[0]!.id)"
        >
          添加报表
        </Button>
      </div>
      <div
        v-for="(component, index) in design.components"
        :key="component.id"
        :data-report-component-editor="component.id"
        class="mb-3 space-y-3 rounded-md border p-3"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Tag>报表 {{ index + 1 }}</Tag
          ><Input
            v-model:value="component.title"
            :disabled="disabled"
            class="w-40"
            placeholder="报表名称"
          /><Select
            v-model:value="component.type"
            :disabled="disabled"
            class="w-36"
            :options="componentTypes"
          /><Select
            :value="component.tone || 'NEUTRAL'"
            :disabled="disabled"
            class="w-36"
            aria-label="面板配色"
            :options="[
              { label: '默认背景', value: 'NEUTRAL' },
              { label: '蓝紫渐变', value: 'LAVENDER' },
              { label: '柔粉渐变', value: 'ROSE' },
              { label: '暖金渐变', value: 'AMBER' },
            ]"
            @change="(value) => setComponentTone(component, value)"
          /><Select
            :value="component.dataset"
            :disabled="disabled"
            aria-label="组件数据集"
            class="w-44"
            :options="
              design.datasets.map((item) => ({
                label: datasetName(item.id),
                value: item.id,
              }))
            "
            @change="(value) => setComponentDataset(component, String(value))"
          /><Button size="small" :disabled="disabled" :aria-label="`复制报表 ${index + 1}`"
            @click="copyComponent(index)">复制报表</Button><Button
            danger
            type="link"
            :disabled="disabled"
            @click="design.components.splice(index, 1)"
          >
            移除
          </Button>
        </div>
        <!-- 自定义背景仅影响当前报表组件，不改变页面背景。 -->
        <div class="flex flex-wrap items-center gap-2">
          <span>图表背景</span>
          <Select :value="component.background?.gradient ? 'GRADIENT' : component.background?.color ? 'SOLID' : 'PRESET'"
            :disabled="disabled" class="w-32" aria-label="图表背景模式"
            :options="[{ label: '预设配色', value: 'PRESET' }, { label: '纯色', value: 'SOLID' }, { label: '渐变', value: 'GRADIENT' }]"
            @change="(value) => setComponentBackground(component, String(value))" />
          <label v-if="component.background?.color">颜色 <input v-model="component.background.color" :disabled="disabled" aria-label="图表背景颜色" type="color" /></label>
          <template v-if="component.background?.gradient">
            <label>起始色 <input v-model="component.background.gradient.from" :disabled="disabled" aria-label="图表渐变起始色" type="color" /></label>
            <label>结束色 <input v-model="component.background.gradient.to" :disabled="disabled" aria-label="图表渐变结束色" type="color" /></label>
            <Select v-model:value="component.background.gradient.direction" :disabled="disabled" class="w-32" aria-label="图表渐变方向"
              :options="[{ label: '从左到右', value: 'HORIZONTAL' }, { label: '从上到下', value: 'VERTICAL' }, { label: '斜向', value: 'DIAGONAL' }]" />
          </template>
        </div>
        <p
          v-if="['BAR', 'LINE', 'PIE'].includes(component.type)"
          class="text-muted-foreground text-xs"
        >
          图表按数据集字段顺序展示：第一列为分类，后续列为数值；饼图需且仅需一列非负数值。
        </p>
        <label
          v-if="['BAR', 'LINE', 'PIE'].includes(component.type)"
          class="flex items-center gap-2"
        >
          <Switch
            v-model:checked="component.showTable"
            :disabled="disabled"
            size="small"
          />图表下方显示数据表
        </label>
        <div
          v-for="field in (design.datasets.find((item) => item.id === component.dataset)?.fields || []).filter((item) => !!item.grainParameter)"
          :key="field.grainParameter"
          class="flex flex-wrap items-center gap-2"
        >
          <span>时间粒度绑定</span>
          <Select :value="component.bindings[field.grainParameter || ''] || undefined" :disabled="disabled"
            class="w-44" placeholder="选择时间粒度条件"
            :options="design.parameters.filter((item) => item.type === 'TIME_GRAIN').map((item) => ({ label: item.title || item.key, value: item.key }))"
            @change="(value) => (component.bindings[field.grainParameter || ''] = String(value))" />
        </div>
        <div
          v-for="(filter, filterIndex) in (
            design.datasets.find((item) => item.id === component.dataset)
              ?.filters || []
          ).filter((item) => !!item.parameter)"
          :key="filter.parameter"
          class="flex flex-wrap items-center gap-2"
        >
          <span>筛选项 {{ filterIndex + 1 }} 绑定</span
          ><Select
            :value="component.bindings[filter.parameter || ''] || undefined"
            :disabled="disabled"
            class="w-44"
            placeholder="选择共享条件"
            :options="parameterOptions(component, filter)"
            @change="
              (value) =>
                (component.bindings[filter.parameter || ''] = String(value))
            "
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <!-- 宽度预设不会改变其他组件，空间不足时自动避让。 -->
          <template v-if="design.layout === 'GRID'">
            <span>图表宽度</span>
            <Select
              :value="component.position.width === 12 ? 1 : component.position.width === 6 ? 2 : component.position.width === 4 ? 3 : undefined"
              :disabled="disabled"
              class="w-32"
              aria-label="图表宽度"
              placeholder="自定义"
              :options="[{ label: '一行一个', value: 1 }, { label: '一行两个', value: 2 }, { label: '一行三个', value: 3 }]"
              @change="(value) => { if (!setGridComponentColumns(design, index, Number(value) as 1 | 2 | 3)) message.warning('无法调整图表宽度，请先调整布局'); }"
            />
          </template>
          <span>位置与尺寸</span
          ><label
            v-for="dimension in ['x', 'y', 'width', 'height'] as const"
            :key="dimension"
            class="flex items-center gap-1"
            >{{ { x: '横', y: '纵', width: '宽', height: '高' }[dimension]
            }}<input
              v-model.number="component.position[dimension]"
              :disabled="disabled"
              class="bg-background w-16 rounded border p-1"
              :min="dimension === 'width' || dimension === 'height' ? 1 : 0"
              max="10000"
              type="number"
          /></label>
        </div>
      </div>
    </section>

    </div>
    <!-- 预览只使用示例数据；拖动卡片直接更新草稿布局。 -->
    <Teleport :to="previewTarget || 'body'" :disabled="!previewTarget">
    <section v-show="previewTarget" class="report-design-preview bg-card rounded-lg border p-4">
      <h3 class="mb-2 font-semibold">实时预览（布局预览）</h3>
      <p class="text-muted-foreground mb-3 text-xs">示例数据，仅用于预览样式；保存后可预览实际数据。</p>
      <div class="mb-3 font-medium" data-testid="report-preview-title">{{ design.title || '未命名报表' }}</div>
      <div
        v-if="design.layout === 'GRID'"
        data-testid="report-grid-preview"
        class="grid gap-3 rounded-md border border-dashed p-3"
        :style="{
          ...backgroundStyle,
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gridAutoRows: '40px',
        }"
        @dragover.prevent
        @drop.self.prevent="onGridDrop"
      >
        <div
          v-for="(component, index) in design.components"
          :key="component.id"
          :data-report-component="component.id"
          class="relative cursor-move overflow-hidden rounded-md"
          :draggable="!disabled"
          :style="{
            gridColumn: `${component.position.x + 1} / span ${component.position.width}`,
            gridRow: `${component.position.y + 1} / span ${component.position.height}`,
          }"
          @dragstart="startGridDrag($event, index)"
          @dragend="dragging = undefined"
          @dragover.prevent
          @drop.stop.prevent="onDrop(index)"
        >
          <ReportDesignPreviewCard :component="component" :dataset="design.datasets.find((item) => item.id === component.dataset)" :catalog="catalog" />
          <span class="report-design-dataset-label">{{ datasetName(component.dataset) }}</span>
        </div>
        <p v-if="design.components.length === 0" class="text-muted-foreground">
          添加报表后可在此拖动调整顺序。
        </p>
      </div>
      <div
        v-else
        data-testid="report-canvas-preview"
        class="relative min-h-96 overflow-auto rounded-md border border-dashed"
        :style="{ ...backgroundStyle, height: '520px' }"
        @dragover.prevent
        @drop.prevent="onCanvasDrop"
      >
        <div
          v-for="(component, index) in design.components"
          :key="component.id"
          :data-report-component="component.id"
          class="absolute cursor-move overflow-hidden rounded-md"
          :draggable="!disabled"
          :style="{
            left: `${component.position.x}px`,
            top: `${component.position.y}px`,
            width: `${component.position.width}px`,
            height: `${component.position.height}px`,
          }"
          @dragstart="startCanvasDrag($event, index)"
          @dragend="dragging = undefined"
        >
          <ReportDesignPreviewCard :component="component" :dataset="design.datasets.find((item) => item.id === component.dataset)" :catalog="catalog" />
          <span class="report-design-dataset-label">{{ datasetName(component.dataset) }}</span>
        </div>
        <p
          v-if="design.components.length === 0"
          class="text-muted-foreground p-4"
        >
          添加报表后可拖动调整位置。
        </p>
      </div>
    </section>
    </Teleport>
  </div>
</template>

<style scoped>
.report-design-workspace { display: grid; gap: 16px; align-items: start; }
.report-design-controls, .report-design-preview { min-width: 0; }
.report-design-dataset-label { position: absolute; right: 8px; bottom: 4px; left: 8px; overflow: hidden; color: #8190a5; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }
</style>
