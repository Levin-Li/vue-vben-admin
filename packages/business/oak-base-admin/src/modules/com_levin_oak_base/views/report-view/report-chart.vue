<script setup lang="ts">
import type { EchartsUIType } from '@vben/runtime/plugins/echarts';

import type { ReportNumberFormat } from './report-number-format';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/runtime/plugins/echarts';

import { chartData } from './report-chart';
import { formatReportAxis, formatReportNumber } from './report-number-format';

const props = withDefaults(
  defineProps<{
    columns: string[];
    formats?: ReportNumberFormat[];
    height?: string;
    rows: unknown[][];
    type: 'BAR' | 'LINE' | 'PIE';
  }>(),
  { height: '260px', formats: () => [] },
);
const chartRef = ref<EchartsUIType>();
const { renderEcharts, clearEcharts } = useEcharts(chartRef);
const data = computed(() => chartData(props.type, props.columns, props.rows));
const failed = ref(false);
const colors = [
  '#6d5df5',
  '#ec5c9b',
  '#18a67a',
  '#f5a12b',
  '#4387f2',
  '#9162e9',
];
let revision = 0;

function safeLabel(value: unknown, limit = 128) {
  return String(value ?? '')
    .replaceAll(/[{}|\r\n]/g, ' ')
    .slice(0, limit);
}

function tooltip(input: unknown) {
  const values = (Array.isArray(input) ? input : [input]).filter(
    (
      item,
    ): item is {
      axisValueLabel?: unknown;
      dataIndex: number;
      name?: unknown;
      seriesIndex: number;
      seriesName?: unknown;
    } =>
      !!item &&
      typeof item === 'object' &&
      Number.isInteger((item as { dataIndex?: unknown }).dataIndex),
  );
  if (values.length === 0) return '';
  const first = values[0];
  if (!first) return '';
  const title = safeLabel(first.axisValueLabel ?? first.name);
  const lines = values.map((item) => {
    const column = props.type === 'PIE' ? 1 : Number(item.seriesIndex) + 1;
    const value = props.rows[item.dataIndex]?.[column];
    const formatted = formatReportNumber(value, props.formats?.[column]);
    const label = safeLabel(
      props.type === 'PIE' ? props.columns[column] : item.seriesName,
    );
    return `${label}: ${safeLabel(formatted.hint || formatted.text, 512)}`;
  });
  return [title, ...lines].filter(Boolean).join('\n');
}
watch(
  data,
  () => {
    failed.value = false;
  },
  { flush: 'sync' },
);
onBeforeUnmount(() => {
  revision += 1;
});

watch(
  [data, chartRef],
  ([value, target]) => {
    const current = ++revision;
    if ('error' in value || !target) {
      clearEcharts();
      return;
    }
    const option =
      props.type === 'PIE'
        ? {
            color: colors,
            tooltip: {
              trigger: 'item' as const,
              renderMode: 'richText' as const,
              formatter: tooltip,
            },
            legend: { bottom: '2%', left: 'center' },
            series: [
              {
                type: 'pie' as const,
                stillShowZeroSum: false,
                radius: ['34%', '50%'],
                avoidLabelOverlap: true,
                itemStyle: { borderRadius: 8, borderWidth: 2 },
                // 标签只使用清理后的纯文本，长名称和拥挤标签保持可读。
                label: {
                  show: true,
                  position: 'outside' as const,
                  formatter: (item: { name?: unknown; percent?: unknown }) => {
                    const percent = Number(item.percent);
                    return `${safeLabel(item.name, 20)}\n${Number.isFinite(percent) ? percent : 0}%`;
                  },
                },
                labelLine: { length: 8, length2: 8 },
                labelLayout: { hideOverlap: true },
                data: value.categories.map((name, index) => ({
                  name,
                  value: value.series[0]?.[index],
                })),
              },
            ],
          }
        : {
            color: colors,
            tooltip: {
              trigger: 'axis' as const,
              renderMode: 'richText' as const,
              formatter: tooltip,
            },
            legend: { top: 0, left: 0, type: 'scroll' as const },
            grid: {
              left: '3%',
              right: '3%',
              top: '16%',
              bottom: '6%',
              containLabel: true,
            },
            xAxis: {
              type: 'category' as const,
              data: value.categories,
              boundaryGap: props.type === 'BAR',
            },
            yAxis: {
              type: 'value' as const,
              axisLabel: { formatter: formatReportAxis },
            },
            series: value.series.map((values, index) => ({
              name: props.columns[index + 1],
              type: props.type === 'BAR' ? ('bar' as const) : ('line' as const),
              ...(props.type === 'LINE'
                ? { smooth: true, symbolSize: 7 }
                : { barMaxWidth: 48 }),
              data: values,
            })),
          };
    void renderEcharts(option).catch(() => {
      if (current === revision) failed.value = true;
    });
  },
  { flush: 'post', immediate: true },
);
</script>

<template>
  <div v-if="'error' in data" class="text-muted-foreground py-6 text-sm">
    {{ data.error }}
  </div>
  <div v-else-if="failed" class="text-muted-foreground py-6 text-sm">
    图表暂不可用，请查看数据表。
  </div>
  <EchartsUI v-else ref="chartRef" :height="height" />
</template>
