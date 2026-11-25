<script setup lang="ts">
import type { UserOrgSelectorModelValue } from '@levin/admin-framework';

import type { ReportRuntimePage, ReportRuntimeQuery } from './report-runtime';

import { computed, h, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import { AnalysisChartCard } from '@vben/common-ui';

import { UserOrgSelector } from '@levin/admin-framework';
import { getApiErrorMessage } from '@levin/admin-framework/framework-commons/app/api';
import { buildExcelXlsx, downloadExcelXlsx } from '@levin/admin-framework/framework-commons/shared/crud-file-export';
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Modal,
  Radio,
  Select,
  Spin,
  Table,
  Tooltip,
  message,
} from 'ant-design-vue';

import { reportBackground } from './report-background';
import ReportChart from './report-chart.vue';
import { formatReportNumber } from './report-number-format';
import { createReportRuntime } from './report-runtime';

const props = defineProps<{
  contextKey: string;
  page: ReportRuntimePage;
  query: ReportRuntimeQuery;
  initialParameters?: Readonly<Record<string, string>>;
  initialContextKey?: string;
  exportComponent?: (componentId: string, parameters: Readonly<Record<string, string>>) => Promise<{
    title: string; columns: string[];
    formats: NonNullable<ReportRuntimePage['components'][number]['formats']>;
    rows: unknown[][];
  }>;
}>();

const runtime = shallowRef(createReportRuntime(props.page, props.query));
const state = computed(() => runtime.value.state);
defineExpose({ getParameters: () => ({ ...state.value.parameters }) });
const exportTarget = ref<ReportRuntimePage['components'][number]>();
const exportFields = ref<Array<{ index: number; title: string; selected: boolean }>>([]);
const exporting = ref(false);
let exportGeneration = 0;
let initialized = false;

function openExport(component: ReportRuntimePage['components'][number]) {
  if (!props.exportComponent || state.value.missingRequired) return;
  exportTarget.value = component;
  exportFields.value = component.columns.map((title, index) => ({ index, title, selected: true }));
}
function cancelExport() {
  exportGeneration += 1;
  exporting.value = false;
  exportTarget.value = undefined;
}
function moveExportField(index: number, step: number) {
  const target = index + step;
  if (target < 0 || target >= exportFields.value.length) return;
  const fields = [...exportFields.value];
  [fields[index], fields[target]] = [fields[target]!, fields[index]!];
  exportFields.value = fields;
}
async function exportReport() {
  const component = exportTarget.value;
  const selected = exportFields.value.filter((field) => field.selected);
  if (!component || !props.exportComponent || exporting.value) return;
  if (!selected.length) return void message.warning('请选择至少一个导出字段');
  const parameters = Object.freeze({ ...state.value.parameters });
  const snapshot = JSON.stringify(parameters);
  const serial = exportGeneration;
  exporting.value = true;
  try {
    const result = await props.exportComponent(component.id, parameters);
    if (serial !== exportGeneration || snapshot !== JSON.stringify(state.value.parameters)) return;
    if (JSON.stringify(result.columns) !== JSON.stringify(component.columns)
      || result.rows.some((row) => !Array.isArray(row) || row.length !== result.columns.length)) {
      throw new Error('报表已更新，请刷新后重新导出');
    }
    const fields = selected.map((field) => ({ key: `c${field.index}`, label: field.title, type: 'text' as const }));
    const records = result.rows.map((row) => Object.fromEntries(row.map((value, index) => [`c${index}`, value])));
    const bytes = buildExcelXlsx({ fields, records, worksheetName: result.title,
      getFieldHeader: (field) => field.label,
      formatCellValue: (field, record) => {
        const index = Number(field.key.slice(1));
        const value = record[field.key];
        return typeof value === 'boolean' ? (value ? '是' : '否') : formatReportNumber(value, result.formats[index]).text;
      },
    });
    downloadExcelXlsx(bytes, `${result.title.replace(/[\\/:*?"<>|]/g, '_') || '报表'}.xlsx`);
    exportTarget.value = undefined;
    message.success('报表导出成功');
  } catch (error) {
    if (serial === exportGeneration) message.error(error instanceof Error && error.message === '报表已更新，请刷新后重新导出'
      ? error.message : getApiErrorMessage(error));
  } finally {
    if (serial === exportGeneration) exporting.value = false;
  }
}
const height = computed(() =>
  Math.max(
    240,
    ...props.page.components.map(
      (component) => component.position.y + component.position.height,
    ),
  ),
);

// 条件或数据版本变化后，旧导出请求不得再次下载，即使条件随后恢复原值。
function refresh(parameters: Readonly<Record<string, string>>) {
  exportGeneration += 1;
  exporting.value = false;
  exportTarget.value = undefined;
  void runtime.value.refresh(parameters);
}
function change(key: string, value: string) {
  refresh({ ...state.value.parameters, [key]: value });
}
function setOrg(key: string, value: UserOrgSelectorModelValue) {
  change(key, typeof value === 'string' ? value : '');
}
function rangeValue(key: string): [string, string] | undefined {
  const values = state.value.parameters[key]?.split('/');
  return values?.length === 2 && values[0] && values[1] ? [values[0], values[1]] : undefined;
}
function setRange(key: string, value: unknown) {
  change(key, Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === 'string' && item)
    ? `${value[0]}/${value[1]}` : '');
}
function columns(component: ReportRuntimePage['components'][number]) {
  return component.columns.map((title, index) => ({
    title,
    dataIndex: `c${index}`,
    key: `c${index}`,
    customRender: ({ text }: { text: unknown }) => {
      const display = formatReportNumber(text, component.formats?.[index]);
      return display.hint
        ? h(Tooltip, { title: display.hint }, () => h('span', display.text))
        : display.text;
    },
  }));
}
function rows(values: unknown[][]) {
  return values.map((row, index) => ({
    key: index,
    ...Object.fromEntries(
      row.map((value, column) => [`c${column}`, value ?? '—']),
    ),
  }));
}
function metric(component: ReportRuntimePage['components'][number]) {
  return formatReportNumber(
    state.value.components[component.id]?.result?.rows[0]?.[0],
    component.formats?.[0],
  );
}
function chartHeight(component: ReportRuntimePage['components'][number]) {
  const total = pageHeight(component);
  return `${Math.max(120, Math.min(360, total - 100))}px`;
}
function pageHeight(component: ReportRuntimePage['components'][number]) {
  return props.page.layout === 'GRID'
    ? component.position.height * 52 - 12
    : component.position.height;
}
function position(component: ReportRuntimePage['components'][number]) {
  const { x, y, width, height: h } = component.position;
  return props.page.layout === 'GRID'
    ? {
        gridColumn: `${x + 1} / span ${width}`,
        gridRow: `${y + 1} / span ${h}`,
        // 窄屏会变为纵向排列，保持与桌面网格一致的从上到下、从左到右顺序。
        order: y * 12 + x,
      }
    : {
        position: 'absolute' as const,
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${h}px`,
      };
}

watch(
  () => [props.page, props.query, props.contextKey] as const,
  () => {
    exportGeneration += 1;
    exporting.value = false;
    exportTarget.value = undefined;
    runtime.value.dispose();
    runtime.value = createReportRuntime(props.page, props.query);
    const defaults = Object.fromEntries(props.page.parameters
      .filter((parameter) => parameter.type === 'TIME_GRAIN')
      .map((parameter) => [parameter.key, 'DAY']));
    const initial = !initialized && props.initialContextKey === props.contextKey
      ? { ...defaults, ...props.initialParameters } : defaults;
    initialized = true;
    void runtime.value.refresh(initial);
  },
  { immediate: true },
);
onBeforeUnmount(() => { exportGeneration += 1; runtime.value.dispose(); });
</script>

<template>
  <section
    class="report-runtime"
    :style="reportBackground(page.background)"
  >
    <div class="report-parameters">
      <label v-for="parameter in page.parameters" :key="parameter.key">
        <span
          v-text="
            (parameter.title || parameter.key) +
            (parameter.required ? ' *' : '')
          "
        ></span>
        <UserOrgSelector
          v-if="parameter.type === 'ORGANIZATION'"
          :model-value="state.parameters[parameter.key] || undefined"
          :selectable-types="['org']"
          :max-select-count="1"
          value-mode="id"
          @update:model-value="setOrg(parameter.key, $event)"
        />
        <Radio.Group
          v-else-if="parameter.type === 'TIME_GRAIN'"
          :value="state.parameters[parameter.key] || 'DAY'"
          :options="parameter.choices || []"
          :aria-label="parameter.title || parameter.key"
          option-type="button"
          button-style="solid"
          @change="(event) => change(parameter.key, String(event.target.value))"
        />
        <Select
          v-else-if="parameter.type === 'ENUM'"
          :value="state.parameters[parameter.key] || ''"
          :options="[{ label: '全部', value: '' }, ...(parameter.choices || [])]"
          :aria-label="parameter.title || parameter.key"
          @change="(value) => change(parameter.key, String(value))"
        />
        <Select
          v-else-if="parameter.type === 'BOOLEAN'"
          :value="state.parameters[parameter.key] || ''"
          :options="[
            { label: '全部', value: '' },
            { label: '是', value: 'true' },
            { label: '否', value: 'false' },
          ]"
          @change="(value) => change(parameter.key, String(value))"
        />
        <DatePicker.RangePicker
          v-else-if="parameter.type === 'DATE_RANGE' || parameter.type === 'DATETIME_RANGE'"
          :value="rangeValue(parameter.key)"
          :show-time="parameter.type === 'DATETIME_RANGE'"
          :value-format="parameter.type === 'DATE_RANGE' ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm:ss'"
          :aria-label="parameter.title || parameter.key"
          @change="(value) => setRange(parameter.key, value)"
        />
        <DatePicker
          v-else-if="parameter.type === 'DATE' || parameter.type === 'DATETIME'"
          :value="state.parameters[parameter.key] || undefined"
          :show-time="parameter.type === 'DATETIME'"
          :value-format="
            parameter.type === 'DATE' ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm:ss'
          "
          :placeholder="
            parameter.type === 'DATE' ? '请选择日期' : '请选择日期时间'
          "
          :aria-label="parameter.title || parameter.key"
          @change="
            (value) =>
              change(parameter.key, typeof value === 'string' ? value : '')
          "
        />
        <Input
          v-else
          :type="parameter.type === 'NUMBER' ? 'number' : 'text'"
          :value="state.parameters[parameter.key] || ''"
          :maxlength="256"
          :aria-label="parameter.title || parameter.key"
          @change="
            change(parameter.key, ($event.target as HTMLInputElement).value)
          "
        />
      </label>
      <Button class="report-refresh" @click="refresh(state.parameters)">
        刷新报表
      </Button>
      <slot name="actions"></slot>
    </div>
    <Alert
      v-if="state.missingRequired"
      type="info"
      message="请选择必填条件后查看报表"
      show-icon
    />
    <div
      class="report-layout"
      :class="page.layout === 'GRID' ? 'report-grid' : 'report-canvas'"
      :style="
        page.layout === 'CANVAS' ? { minHeight: `${height}px` } : undefined
      "
    >
      <AnalysisChartCard
        v-for="component in page.components"
        :key="component.id"
        class="report-card"
        :class="`report-tone-${(component.tone || 'NEUTRAL').toLowerCase()}`"
        :style="{ ...position(component), ...reportBackground(component.background, true) }"
        :title="component.title"
      >
        <Spin :spinning="state.components[component.id]?.loading || false">
          <!-- 图表单独显示失败状态，不影响其他组件。 -->
          <div
            v-if="state.components[component.id]?.error"
            role="alert"
            class="text-destructive p-3"
          >报表加载失败或无权访问</div>
          <template v-else-if="state.components[component.id]?.result">
            <div v-if="exportComponent" class="report-export">
              <Button size="small" @click="openExport(component)">导出</Button>
            </div>
            <div v-if="component.type === 'METRIC'" class="report-metric">
              <Tooltip
                v-if="metric(component).hint"
                :title="metric(component).hint"
              >
                <span>{{ metric(component).text }}</span>
              </Tooltip>
              <span v-else>{{ metric(component).text }}</span>
            </div>
            <template v-else>
              <ReportChart
                v-if="
                  component.type === 'BAR' ||
                  component.type === 'LINE' ||
                  component.type === 'PIE'
                "
                :type="component.type"
                :columns="component.columns"
                :formats="component.formats"
                :rows="state.components[component.id]?.result?.rows || []"
                :height="chartHeight(component)"
              />
              <details
                v-if="component.type !== 'TABLE' && !component.showTable"
                class="report-data-details"
              >
                <summary>查看数据</summary>
                <Table
                  :columns="columns(component)"
                  :data-source="
                    rows(state.components[component.id]?.result?.rows || [])
                  "
                  :pagination="false"
                  size="small"
                  :scroll="{ x: true }"
                />
              </details>
              <Table
                v-else
                :columns="columns(component)"
                :data-source="
                  rows(state.components[component.id]?.result?.rows || [])
                "
                :pagination="false"
                size="small"
                :scroll="{ x: true }"
              />
            </template>
            <div
              v-if="state.components[component.id]?.result?.hasMore"
              class="report-hint"
            >
              结果已按配置限制显示数量
            </div>
          </template>
        </Spin>
      </AnalysisChartCard>
    </div>
    <Modal :open="Boolean(exportTarget)" title="选择导出字段" ok-text="导出"
      :confirm-loading="exporting" @ok="exportReport" @cancel="cancelExport">
      <p>按当前筛选条件导出，最多 5000 条。</p>
      <div v-for="(field, index) in exportFields" :key="field.index" class="report-export-field">
        <Checkbox v-model:checked="field.selected">{{ field.title }}</Checkbox>
        <span>
          <Button size="small" :disabled="index === 0" :aria-label="`上移${field.title}`" @click="moveExportField(index, -1)">↑</Button>
          <Button size="small" :disabled="index === exportFields.length - 1" :aria-label="`下移${field.title}`" @click="moveExportField(index, 1)">↓</Button>
        </span>
      </div>
    </Modal>
  </section>
</template>

<style scoped>
.report-runtime {
  min-height: 100%;
  padding: 24px;
  background-size: cover;
  background-position: center;
}
.report-parameters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--card));
}
.report-parameters label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 160px;
}
.report-refresh {
  margin-left: auto;
}
.report-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 40px;
  gap: 12px;
}
.report-canvas {
  position: relative;
  overflow: auto;
}
.report-card {
  min-width: 0;
  overflow: auto;
}
.report-export { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.report-export-field { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
.report-card :deep(h3) {
  border-left: 4px solid #7064f5;
  padding-left: 12px;
  color: #6258eb;
}
.report-tone-lavender {
  background: linear-gradient(115deg, #eef5ff 0%, #fff 55%, #f5efff 100%);
  border-color: #d7d0ff;
}
.report-tone-rose {
  background: linear-gradient(115deg, #fff1f1 0%, #fff 64%, #f9f5ff 100%);
  border-color: #f2dfe5;
}
.report-tone-amber {
  background: linear-gradient(115deg, #fff7e6 0%, #fff 65%, #f6fbfb 100%);
  border-color: #f4dfb7;
}
:global(.dark) .report-tone-lavender,
:global(.dark) .report-tone-rose,
:global(.dark) .report-tone-amber {
  background: hsl(var(--card));
  border-color: hsl(var(--border));
}
:global(.dark) .report-card :deep(h3) {
  color: #b5acff;
}
.report-metric {
  font-size: 36px;
  font-weight: 600;
  letter-spacing: -0.03em;
}
.report-data-details {
  margin-top: 8px;
}
.report-data-details summary {
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 12px;
  margin-bottom: 8px;
}
.report-hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  margin-top: 8px;
}
@media (max-width: 700px) {
  .report-runtime {
    padding: 16px;
  }
  .report-grid {
    display: flex;
    flex-direction: column;
  }
}
</style>
