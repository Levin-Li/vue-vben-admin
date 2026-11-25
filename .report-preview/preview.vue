<script setup lang="ts">
import ReportRuntimeView from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-view/report-runtime-view.vue';
import ReportDesignEditor from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-center/report-design-editor.vue';
import type { ReportRuntimePage } from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-view/report-runtime';
import type { ReportPageDesign, ReportSourceCatalog } from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/report-definition-management-service';
import { ref } from 'vue';
import { Button, ConfigProvider } from 'ant-design-vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';

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

// 设计器使用独立的内存样本，不调用业务接口或保存配置。
const editing = ref(false);
const catalog: ReportSourceCatalog = {
  sources: [
    { id: 'sales', title: '示例收入', fields: [
      { id: 'category', title: '分类', type: 'STRING' },
      { id: 'amount', title: '收入', type: 'DECIMAL' },
      { id: 'day', title: '日期', type: 'DATE' },
    ] },
  ],
  relations: [],
};
const design = ref<ReportPageDesign>({
  version: 1, title: '示例报表', layout: 'GRID', background: { color: '#ffffff' }, parameters: [],
  datasets: [{ id: 'salesData', root: 'sales', relations: [], filters: [], fields: [
    { source: 'sales', name: 'category', aggregation: 'NONE' },
    { source: 'sales', name: 'amount', aggregation: 'SUM' },
  ] }],
  components: examplePage.components.map((item) => ({
    id: item.id, dataset: 'salesData', title: item.title, type: item.type,
    tone: item.tone, showTable: item.showTable, bindings: {}, position: { ...item.position },
  })),
});

// 仅把外观和布局应用到样本；数据集配置不会执行真实或模拟查询。
function applyLayout() {
  const components = design.value.components.map((item) => {
    const example = examplePage.components.find((candidate) => candidate.id === item.id);
    return {
      id: item.id, title: item.title, type: item.type, tone: item.tone,
      showTable: item.showTable, position: { ...item.position },
      columns: example?.columns || ['分类', '数值'],
      formats: example?.formats || [{ kind: 'PLAIN' as const }, { kind: 'QUANTITY' as const }],
    };
  });
  page.value = { ...examplePage, layout: design.value.layout,
    background: { ...design.value.background }, components };
  editing.value = false;
}
async function query(id: string, parameters: Readonly<Record<string, string>>) {
  const factor = parameters.org === 'south' ? 0.65 : parameters.org === 'north' ? 0.8 : 1;
  const sample = [
    ['2026-10-24', 72000, 13000], ['2026-10-28', 155000, 22000], ['2026-11-01', 43000, 18000],
    ['2026-11-05', 56000, 24000], ['2026-11-09', 32000, 14000], ['2026-11-13', 88000, 30000],
    ['2026-11-17', 230000, 41000], ['2026-11-21', 67000, 16000],
  ] as const;
  const [start, end] = parameters.window?.split('/') || [];
  const filtered = sample.filter(([date]) => (!start || date >= start) && (!end || date <= end));
  if (filtered.length === 0) return { rows: [], hasMore: false };
  const grouped = new Map<string, [number, number]>();
  for (const [date, sales, services] of filtered) {
    const key = parameters.period === 'MONTH' ? date.slice(0, 7) : date.slice(5);
    const previous = grouped.get(key) || [0, 0];
    grouped.set(key, [previous[0] + Math.round(sales * factor), previous[1] + Math.round(services * factor)]);
  }
  const trend = [...grouped].map(([date, [sales, services]]) => [date, sales, services]);
  const total = trend.reduce((sum, row) => sum + Number(row[1]) + Number(row[2]), 0);
  const distribute = (weights: number[]) => {
    const weight = weights.reduce((sum, item) => sum + item, 0);
    let remainder = total;
    return weights.map((item, index) => {
      const amount = index === weights.length - 1 ? remainder : Math.round(total * item / weight);
      remainder -= amount;
      return amount;
    });
  };
  const channel = distribute([41, 17, 8, 4]);
  const product = distribute([62, 18, 9, 4]);
  const values: Record<string, unknown[][]> = {
    trend,
    channel: [['渠道甲', channel[0]], ['渠道乙', channel[1]], ['渠道丙', channel[2]], ['渠道丁', channel[3]]],
    product: [['产品甲', product[0]], ['产品乙', product[1]], ['产品丙', product[2]], ['产品丁', product[3]]],
  };
  return { rows: values[id] || [], hasMore: false };
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
      <span>隔离体验 · 仅应用布局和样式，数据集不执行查询；配置保存在当前页面</span>
      <Button v-if="editing" size="small" @click="applyLayout">应用布局并返回</Button>
      <Button v-else size="small" @click="editing = true">体验设计器</Button>
    </div>
    <div v-if="editing" class="designer"><ReportDesignEditor v-model="design" :catalog="catalog" /></div>
    <ReportRuntimeView v-else :page="page" :query="query" :export-component="exportComponent" context-key="preview" />
  </ConfigProvider>
</template>
<style>body{margin:0;background:#f3f6fb;color:#18243b;font-family:system-ui,sans-serif}.notice{padding:9px 20px;background:#e9f2ff;color:#245ba6;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:12px}.designer{padding:24px}</style>
