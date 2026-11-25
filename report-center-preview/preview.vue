<script setup lang="ts">
import ReportRuntimeView from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-view/report-runtime-view.vue';
import ReportDesignEditor from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-center/report-design-editor.vue';
import type { ReportRuntimePage } from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-view/report-runtime';
import type { ReportDatasetFilter, ReportPageDesign, ReportParameter, ReportSourceCatalog } from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/report-definition-management-service';
import { ref } from 'vue';
import { Button, ConfigProvider, message } from 'ant-design-vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { demoEnumChoices, queryDemoDataset, retainCompatibleParameters } from './demo-query';
import { validateReportDesign } from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-center/report-design';

const examplePage: ReportRuntimePage = {
  title: '报表预览', layout: 'GRID', background: { color: '#ffffff' },
  parameters: [
    { key: 'org', title: '组织', type: 'ORGANIZATION', required: false, requiredForAll: false },
    { key: 'period', title: '时间粒度', type: 'TIME_GRAIN', required: true, requiredForAll: false,
      choices: [{ value: 'DAY', label: '按日' }, { value: 'MONTH', label: '按月' }] },
    { key: 'window', title: '日期范围', type: 'DATE_RANGE', required: false, requiredForAll: false },
  ],
  components: [
    { id: 'trend', title: '收入趋势', type: 'LINE', tone: 'LAVENDER', columns: ['日期', '销售收入', '服务收入'],
      formats: [{ kind: 'PLAIN' }, { kind: 'MONEY', unit: '元' }, { kind: 'MONEY', unit: '元' }],
      position: { x: 0, y: 0, width: 12, height: 8 } },
    { id: 'channel', title: '渠道收入排行', type: 'PIE', tone: 'ROSE', showTable: true, columns: ['渠道', '收入'],
      formats: [{ kind: 'PLAIN' }, { kind: 'MONEY', unit: '元' }], position: { x: 0, y: 8, width: 6, height: 13 } },
    { id: 'product', title: '产品收入排行', type: 'PIE', tone: 'AMBER', showTable: true, columns: ['产品', '收入'],
      formats: [{ kind: 'PLAIN' }, { kind: 'MONEY', unit: '元' }], position: { x: 6, y: 8, width: 6, height: 13 } },
  ],
};
const page = ref<ReportRuntimePage>(structuredClone(examplePage));
const appliedDesign = ref<ReportPageDesign | null>(null);
const runtimeView = ref<InstanceType<typeof ReportRuntimeView>>();
const savedParameters = ref<Record<string, string>>({});
const savedParameterDefinitions = ref<ReportParameter[]>([]);
const savedParameterObjects = new Map<string, ReportParameter>();

// 设计器使用独立的内存样本，不调用业务接口或保存配置。
const editing = ref(false);
function openDesigner() {
  savedParameters.value = runtimeView.value?.getParameters() || {};
  savedParameterDefinitions.value = page.value.parameters.map((parameter) => ({ ...parameter }));
  savedParameterObjects.clear();
  for (const parameter of design.value.parameters) savedParameterObjects.set(parameter.key, parameter);
  editing.value = true;
}
const catalog: ReportSourceCatalog = {
  sources: [
    { id: 'sales', title: '示例收入', fields: [
      { id: 'category', title: '分类', type: 'STRING' },
      { id: 'product', title: '产品', type: 'STRING' },
      { id: 'amount', title: '收入', type: 'DECIMAL' },
      { id: 'salesAmount', title: '销售收入', type: 'DECIMAL' },
      { id: 'serviceAmount', title: '服务收入', type: 'DECIMAL' },
      { id: 'day', title: '日期', type: 'DATE' },
      { id: 'orgId', title: '所属组织', type: 'ORGANIZATION' },
      { id: 'ownerId', title: '创建人标识', type: 'STRING' },
      { id: 'tenantId', title: '租户标识', type: 'STRING' },
      { id: 'status', title: '结算状态', type: 'ENUM', choices: [
        { value: 'SETTLED', label: '已结算' }, { value: 'PENDING', label: '待结算' },
      ] },
    ] },
    { id: 'organizations', title: '示例组织', fields: [
      { id: 'id', title: '组织标识', type: 'ORGANIZATION' },
      { id: 'name', title: '组织名称', type: 'STRING' },
      { id: 'parentId', title: '上级组织标识', type: 'ORGANIZATION' },
    ] },
    { id: 'parentOrganizations', title: '示例上级组织', fields: [
      { id: 'id', title: '上级组织标识', type: 'ORGANIZATION' },
      { id: 'name', title: '上级组织名称', type: 'STRING' },
    ] },
    { id: 'goals', title: '示例目标', fields: [
      { id: 'id', title: '目标标识', type: 'STRING' },
      { id: 'orgId', title: '目标组织', type: 'ORGANIZATION' },
      { id: 'amount', title: '目标金额', type: 'DECIMAL' },
    ] },
  ],
  relations: [{ id: 'salesOrganization', leftSource: 'sales', leftField: 'orgId',
    rightSource: 'organizations', rightField: 'id', multipliesLeft: false },
  { id: 'organizationParent', leftSource: 'organizations', leftField: 'parentId',
    rightSource: 'parentOrganizations', rightField: 'id', multipliesLeft: false },
  { id: 'parentOrganizationChildren', leftSource: 'parentOrganizations', leftField: 'id',
    rightSource: 'organizations', rightField: 'parentId', multipliesLeft: true, leftPrimaryKey: true },
  { id: 'organizationGoals', leftSource: 'organizations', leftField: 'id',
    rightSource: 'goals', rightField: 'orgId', multipliesLeft: true, leftPrimaryKey: true }],
};
const sharedFilters = (): ReportDatasetFilter[] => [
  { source: 'sales', name: 'orgId', operator: 'EQ', parameter: 'orgFilter' },
  { source: 'sales', name: 'day', operator: 'GE', parameter: 'from', boundary: 'START' },
  { source: 'sales', name: 'day', operator: 'LE', parameter: 'to', boundary: 'END' },
];
const design = ref<ReportPageDesign>({
  version: 1, title: '示例报表', layout: 'GRID', background: { color: '#ffffff' }, parameters: [
    { key: 'org', title: '组织', type: 'ORGANIZATION', required: false, requiredForAll: true },
    { key: 'period', title: '时间粒度', type: 'TIME_GRAIN', required: true, requiredForAll: false },
    { key: 'window', title: '日期范围', type: 'DATE_RANGE', required: false, requiredForAll: true },
  ],
  datasets: [
    { id: 'trendData', title: '收入趋势', root: 'sales', relations: [], filters: sharedFilters(), fields: [
      { source: 'sales', name: 'day', aggregation: 'NONE', grainParameter: 'grain', sort: 'ASC' },
      { source: 'sales', name: 'salesAmount', aggregation: 'SUM' },
      { source: 'sales', name: 'serviceAmount', aggregation: 'SUM' },
    ] },
    { id: 'channelData', title: '渠道排行', root: 'sales', relations: [], filters: sharedFilters(), fields: [
      { source: 'sales', name: 'category', aggregation: 'NONE' },
      { source: 'sales', name: 'amount', aggregation: 'SUM', sort: 'DESC' },
    ] },
    { id: 'productData', title: '产品排行', root: 'sales', relations: [], filters: sharedFilters(), fields: [
      { source: 'sales', name: 'product', aggregation: 'NONE' },
      { source: 'sales', name: 'amount', aggregation: 'SUM', sort: 'DESC' },
    ] },
  ],
  components: examplePage.components.map((item) => ({
    id: item.id, dataset: ({ trend: 'trendData', channel: 'channelData', product: 'productData' } as Record<string, string>)[item.id]!,
    title: item.title, type: item.type, tone: item.tone, showTable: item.showTable,
    bindings: { orgFilter: 'org', from: 'window', to: 'window', ...(item.id === 'trend' ? { grain: 'period' } : {}) },
    position: { ...item.position },
  })),
});

// 应用声明式设计，仅在浏览器内的固定样本上计算，不访问业务数据。
function applyLayout() {
  const errors = validateReportDesign(design.value, catalog);
  if (errors.length) { message.warning(errors[0]!); return; }
  const snapshot = JSON.parse(JSON.stringify(design.value)) as ReportPageDesign;
  const enumChoices = demoEnumChoices(snapshot, catalog);
  savedParameters.value = retainCompatibleParameters(savedParameterDefinitions.value, design.value.parameters, savedParameters.value, savedParameterObjects, enumChoices);
  const components = design.value.components.map((item) => {
    const dataset = snapshot.datasets.find((candidate) => candidate.id === item.dataset)!;
    const metadata = dataset.fields.map((field) => catalog.sources.find((source) => source.id === field.source)?.fields.find((candidate) => candidate.id === field.name));
    return {
      id: item.id, title: item.title, type: item.type, tone: item.tone, background: item.background,
      showTable: item.showTable, position: { ...item.position },
      columns: dataset.fields.map((field, index) => field.title || `${metadata[index]?.title || field.name}${field.aggregation === 'NONE' ? '' : `（${{ SUM: '求和', COUNT: '计数', AVG: '平均', MIN: '最小', MAX: '最大' }[field.aggregation]}）`}`),
      formats: dataset.fields.map((field) => ({
        kind: field.display || (field.aggregation === 'COUNT' ? 'QUANTITY' as const : /amount$/i.test(field.name) ? 'MONEY' as const : 'PLAIN' as const),
        unit: field.unit,
      })),
    };
  });
  appliedDesign.value = snapshot;
  page.value = { title: snapshot.title, layout: snapshot.layout, background: { ...snapshot.background }, components,
    parameters: snapshot.parameters.map((parameter) => ({ ...parameter,
      ...(parameter.type === 'TIME_GRAIN' ? { choices: [{ value: 'DAY', label: '按日' }, { value: 'MONTH', label: '按月' }] } : {}),
      ...(parameter.type === 'ENUM' ? { choices: enumChoices[parameter.key] || [] } : {}),
    })) };
  editing.value = false;
}
async function query(id: string, parameters: Readonly<Record<string, string>>) {
  return queryDemoDataset(appliedDesign.value || design.value, catalog, id, parameters);
}
async function exportComponent(id: string, parameters: Readonly<Record<string, string>>) {
  const component = page.value.components.find((item) => item.id === id)!;
  const result = await query(id, parameters);
  return { title: component.title, columns: component.columns, formats: component.formats || [], rows: result.rows };
}
</script>
<template>
  <ConfigProvider :locale="zhCN">
    <div class="notice">
      <span>隔离体验 · 使用本地虚构数据计算，配置仅保存在当前页面</span>
      <Button v-if="editing" size="small" @click="applyLayout">应用设计并返回</Button>
      <Button v-else size="small" @click="openDesigner">体验设计器</Button>
    </div>
    <div v-if="editing" class="designer"><ReportDesignEditor v-model="design" :catalog="catalog" /></div>
    <ReportRuntimeView v-else ref="runtimeView" :page="page" :query="query" :export-component="exportComponent"
      :initial-parameters="savedParameters" initial-context-key="preview" context-key="preview" />
  </ConfigProvider>
</template>
<style>body{margin:0;background:#f3f6fb;color:#18243b;font-family:system-ui,sans-serif}.notice{padding:9px 20px;background:#e9f2ff;color:#245ba6;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:12px}.designer{padding:24px}</style>
