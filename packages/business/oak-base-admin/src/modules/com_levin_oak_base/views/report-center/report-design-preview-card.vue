<script setup lang="ts">
import type { ReportComponent, ReportDataset, ReportSourceCatalog } from '../../api/report-definition-management-service';

import { computed } from 'vue';

import { AnalysisChartCard } from '@vben/common-ui';

import ReportChart from '../report-view/report-chart.vue';
import { formatReportNumber } from '../report-view/report-number-format';
import { reportBackground } from '../report-view/report-background';

const props = defineProps<{
  catalog: ReportSourceCatalog;
  component: ReportComponent;
  dataset?: ReportDataset;
}>();

// 使用当前字段配置生成固定示例，不访问接口或执行未保存的查询。
const fields = computed(() => props.dataset?.fields || []);
const columns = computed(() => fields.value.map((field) => {
  const source = props.catalog.sources.find((item) => item.id === field.source);
  const title = source?.fields.find((item) => item.id === field.name)?.title || field.name || '字段';
  const suffix = { SUM: '求和', COUNT: '计数', AVG: '平均', MIN: '最小', MAX: '最大', NONE: '' }[field.aggregation];
  return field.title || (suffix ? `${title}（${suffix}）` : title);
}));
const formats = computed(() => fields.value.map((field) => {
  const metadata = props.catalog.sources.find((source) => source.id === field.source)?.fields.find((item) => item.id === field.name);
  const name = `${field.name} ${metadata?.title || ''}`;
  let kind: 'MONEY' | 'PLAIN' | 'QUANTITY' = 'PLAIN';
  if (field.aggregation === 'COUNT') kind = 'QUANTITY';
  else if (field.display) kind = field.display;
  else if (['INTEGER', 'DECIMAL'].includes(metadata?.type || '') && !/(id|code|number)$/i.test(field.name)
    && !/编号|rate|ratio|percent|percentage|费率|汇率|比率|比例|比重|百分比/i.test(name)) {
    if (/amount|balance|price|fee|revenue|income|cost|profit|金额|余额|价格|费用|额度|收入|成本|利润|销售额/i.test(name)) kind = 'MONEY';
    else if (/quantity|qty|count|数量|件数|人数|订单数|次数|总数|用户数/i.test(name)) kind = 'QUANTITY';
  }
  return { kind, unit: field.unit };
}));
const rows = computed(() => ['示例甲', '示例乙', '示例丙'].map((label, row) =>
  fields.value.map((field, index) => {
    const metadata = props.catalog.sources.find((source) => source.id === field.source)?.fields.find((item) => item.id === field.name);
    if (index === 0 && field.aggregation === 'NONE' && !['INTEGER', 'DECIMAL'].includes(metadata?.type || '')) return label;
    return (row + 1) * (index + 1) * 12000;
  }),
));
const metric = computed(() => formatReportNumber(rows.value[0]?.[0], formats.value[0]).text);
const chartReady = computed(() => columns.value.length >= 2
  && (props.component.type !== 'PIE' || columns.value.length === 2));
const chartType = computed(() => ['BAR', 'LINE', 'PIE'].includes(props.component.type)
  ? props.component.type as 'BAR' | 'LINE' | 'PIE' : undefined);
</script>

<template>
  <!-- 复用运行页面板和图表；示例值只用于说明样式。 -->
  <AnalysisChartCard class="design-preview-card" :class="`design-tone-${(component.tone || 'NEUTRAL').toLowerCase()}`" :style="reportBackground(component.background, true)" :title="component.title || '未命名报表'">
    <div v-if="!fields.length" class="design-preview-empty">请选择数据集和展示字段</div>
    <div v-else-if="component.type === 'METRIC'" class="design-preview-metric">{{ metric }}</div>
    <ReportChart v-else-if="component.type !== 'TABLE' && chartReady && chartType" :type="chartType" :columns="columns" :rows="rows" :formats="formats" height="180px" />
    <div v-else-if="component.type !== 'TABLE'" class="design-preview-empty">请配置图表分类和数值字段</div>
    <div v-if="fields.length && (component.type === 'TABLE' || (chartReady && component.showTable))" class="design-preview-table-wrap">
      <table class="design-preview-table">
        <thead><tr><th v-for="(column, index) in columns" :key="index">{{ column }}</th></tr></thead>
        <tbody><tr v-for="(row, rowIndex) in rows" :key="rowIndex"><td v-for="(value, index) in row" :key="index">{{ formatReportNumber(value, formats[index]).text }}</td></tr></tbody>
      </table>
    </div>
  </AnalysisChartCard>
</template>

<style scoped>
/* 与运行页保持一致的卡片配色。 */
.design-preview-card { height: 100%; overflow: hidden; }
.design-tone-lavender { background: linear-gradient(115deg, #eef5ff 0%, #fff 55%, #f5efff 100%); border-color: #d7d0ff; }
.design-tone-rose { background: linear-gradient(115deg, #fff1f1 0%, #fff 64%, #f9f5ff 100%); border-color: #f2dfe5; }
.design-tone-amber { background: linear-gradient(115deg, #fff7e6 0%, #fff 65%, #f6fbfb 100%); border-color: #f4dfb7; }
.design-preview-card :deep(h3) { border-left: 4px solid #7064f5; padding-left: 12px; color: #6258eb; }
:global(.dark) .design-tone-lavender, :global(.dark) .design-tone-rose, :global(.dark) .design-tone-amber { background: hsl(var(--card)); border-color: hsl(var(--border)); }
.design-preview-metric { padding: 24px 0; font-size: 28px; font-weight: 600; }
.design-preview-empty { padding: 24px 0; color: #8190a5; }
.design-preview-table-wrap { overflow: auto; }
.design-preview-table { width: 100%; border-collapse: collapse; text-align: left; }
.design-preview-table th, .design-preview-table td { border-bottom: 1px solid #e8edf3; padding: 8px; white-space: nowrap; }
</style>
