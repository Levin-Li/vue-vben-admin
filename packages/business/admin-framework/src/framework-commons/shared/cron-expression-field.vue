<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import { Button, Input, Modal, Radio, Select } from 'ant-design-vue';

type CronSegmentKey =
  | 'dayOfMonth'
  | 'dayOfWeek'
  | 'hour'
  | 'minute'
  | 'month'
  | 'second';
type CronSegmentMode = 'any' | 'fixed' | 'interval' | 'range' | 'specific';

interface CronSegmentConfig {
  key: CronSegmentKey;
  label: string;
  max: number;
  min: number;
  unit: string;
}

interface CronSegmentState {
  end: number;
  mode: CronSegmentMode;
  start: number;
  step: number;
  value: number;
  values: number[];
}

const DEFAULT_CRON = '0 0/5 * * * *';
const CRON_SEGMENTS: CronSegmentConfig[] = [
  { key: 'second', label: '秒', min: 0, max: 59, unit: '秒' },
  { key: 'minute', label: '分钟', min: 0, max: 59, unit: '分钟' },
  { key: 'hour', label: '小时', min: 0, max: 23, unit: '小时' },
  { key: 'dayOfMonth', label: '日期', min: 1, max: 31, unit: '天' },
  { key: 'month', label: '月份', min: 1, max: 12, unit: '月' },
  { key: 'dayOfWeek', label: '星期', min: 0, max: 7, unit: '周' },
];
const CRON_PRESETS = [
  { label: '每分钟', value: '0 * * * * *' },
  { label: '每 5 分钟', value: DEFAULT_CRON },
  { label: '每 10 分钟', value: '0 0/10 * * * *' },
  { label: '每小时', value: '0 0 * * * *' },
  { label: '每天 00:00', value: '0 0 0 * * *' },
  { label: '每周一 00:00', value: '0 0 0 * * 1' },
  { label: '每月 1 日 00:00', value: '0 0 0 1 * *' },
];

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modalStyle?: Record<string, any>;
    modalWidth?: number | string;
    modelValue?: string;
    placeholder?: string;
    title?: string;
  }>(),
  {
    disabled: false,
    modalWidth: 'min(70vw, 980px)',
    placeholder: '点击编辑 Cron 表达式',
    title: 'Cron 表达式',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const open = ref(false);
const unsupportedExpression = ref('');
const draftSegments = reactive<Record<CronSegmentKey, CronSegmentState>>(
  createDefaultSegments(),
);

const previewText = computed(() => props.modelValue || '');
const modalTitle = computed(() => `编辑${props.title}`);
const draftExpression = computed(() =>
  CRON_SEGMENTS.map((segment) =>
    buildSegmentExpression(draftSegments[segment.key], segment),
  ).join(' '),
);
const validationMessages = computed(() =>
  CRON_SEGMENTS.flatMap((segment) =>
    validateSegment(draftSegments[segment.key], segment),
  ),
);
const hasValidationError = computed(() => validationMessages.value.length > 0);
const okButtonProps = computed(() => ({ disabled: hasValidationError.value }));

function createDefaultSegment(segment: CronSegmentConfig): CronSegmentState {
  return {
    mode: 'any',
    end: segment.max,
    start: segment.min,
    step: Math.min(5, Math.max(1, segment.max - segment.min + 1)),
    value: segment.min,
    values: [],
  };
}

function createDefaultSegments() {
  return CRON_SEGMENTS.reduce(
    (result, segment) => {
      result[segment.key] = createDefaultSegment(segment);
      return result;
    },
    {} as Record<CronSegmentKey, CronSegmentState>,
  );
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(numberValue)));
}

function copySegmentState(target: CronSegmentState, source: CronSegmentState) {
  target.mode = source.mode;
  target.end = source.end;
  target.start = source.start;
  target.step = source.step;
  target.value = source.value;
  target.values = [...source.values];
}

function resetDraftSegments() {
  for (const segment of CRON_SEGMENTS) {
    copySegmentState(draftSegments[segment.key], createDefaultSegment(segment));
  }
}

function parseSegmentExpression(
  token: string,
  segment: CronSegmentConfig,
): CronSegmentState | undefined {
  if (token === '*' || token === '?') {
    return createDefaultSegment(segment);
  }

  const fixedValue = token.match(/^\d+$/);
  if (fixedValue) {
    const value = normalizeNumber(token, segment.min, segment.min, segment.max);
    return {
      mode: 'fixed',
      end: segment.max,
      start: segment.min,
      step: Math.min(5, Math.max(1, segment.max - segment.min + 1)),
      value,
      values: [],
    };
  }

  const intervalValue = token.match(/^(\*|\d+)\/(\d+)$/);
  if (intervalValue) {
    const start =
      intervalValue[1] === '*'
        ? segment.min
        : normalizeNumber(intervalValue[1], segment.min, segment.min, segment.max);
    const step = normalizeNumber(intervalValue[2], 1, 1, segment.max);
    return {
      mode: 'interval',
      end: segment.max,
      start,
      step,
      value: segment.min,
      values: [],
    };
  }

  const rangeValue = token.match(/^(\d+)-(\d+)$/);
  if (rangeValue) {
    const start = normalizeNumber(rangeValue[1], segment.min, segment.min, segment.max);
    const end = normalizeNumber(rangeValue[2], segment.max, segment.min, segment.max);
    return {
      mode: 'range',
      end,
      start,
      step: Math.min(5, Math.max(1, segment.max - segment.min + 1)),
      value: segment.min,
      values: [],
    };
  }

  const specificValues = token.split(',').filter(Boolean);
  if (
    specificValues.length > 0 &&
    specificValues.every((item) => /^\d+$/.test(item))
  ) {
    const values = [...new Set(
      specificValues.map((item) =>
        normalizeNumber(item, segment.min, segment.min, segment.max),
      ),
    )].sort((left, right) => left - right);

    return {
      mode: 'specific',
      end: segment.max,
      start: segment.min,
      step: Math.min(5, Math.max(1, segment.max - segment.min + 1)),
      value: segment.min,
      values,
    };
  }

  return undefined;
}

function applyExpressionToDraft(expression: string) {
  const tokens = expression.trim().split(/\s+/).filter(Boolean);
  const normalizedTokens = tokens.length === 5 ? ['0', ...tokens] : tokens;

  if (normalizedTokens.length !== 6) {
    return false;
  }

  const nextSegments = CRON_SEGMENTS.map((segment, index) =>
    parseSegmentExpression(normalizedTokens[index] || '*', segment),
  );

  if (nextSegments.some((segment) => !segment)) {
    return false;
  }

  nextSegments.forEach((nextSegment, index) => {
    copySegmentState(draftSegments[CRON_SEGMENTS[index]!.key], nextSegment!);
  });
  unsupportedExpression.value = '';
  return true;
}

function buildSegmentExpression(
  state: CronSegmentState,
  segment: CronSegmentConfig,
) {
  if (state.mode === 'fixed') {
    return String(normalizeNumber(state.value, segment.min, segment.min, segment.max));
  }

  if (state.mode === 'interval') {
    const start = normalizeNumber(state.start, segment.min, segment.min, segment.max);
    const step = normalizeNumber(state.step, 1, 1, segment.max);
    return `${start}/${step}`;
  }

  if (state.mode === 'range') {
    const start = normalizeNumber(state.start, segment.min, segment.min, segment.max);
    const end = normalizeNumber(state.end, segment.max, segment.min, segment.max);
    return `${start}-${end}`;
  }

  if (state.mode === 'specific') {
    const values = [...new Set(state.values)]
      .map((value) => normalizeNumber(value, segment.min, segment.min, segment.max))
      .sort((left, right) => left - right);

    return values.length > 0 ? values.join(',') : '*';
  }

  return '*';
}

function validateSegment(state: CronSegmentState, segment: CronSegmentConfig) {
  const messages: string[] = [];

  if (
    state.mode === 'fixed' &&
    (state.value < segment.min || state.value > segment.max)
  ) {
    messages.push(`${segment.label}固定值必须在 ${segment.min}-${segment.max} 之间`);
  }

  if (state.mode === 'interval') {
    if (state.start < segment.min || state.start > segment.max) {
      messages.push(`${segment.label}起始值必须在 ${segment.min}-${segment.max} 之间`);
    }

    if (state.step < 1 || state.step > segment.max) {
      messages.push(`${segment.label}间隔必须在 1-${segment.max} 之间`);
    }
  }

  if (state.mode === 'range') {
    if (state.start < segment.min || state.start > segment.max) {
      messages.push(`${segment.label}起始值必须在 ${segment.min}-${segment.max} 之间`);
    }

    if (state.end < segment.min || state.end > segment.max) {
      messages.push(`${segment.label}结束值必须在 ${segment.min}-${segment.max} 之间`);
    }

    if (state.start > state.end) {
      messages.push(`${segment.label}范围起始值不能大于结束值`);
    }
  }

  if (state.mode === 'specific') {
    if (state.values.length === 0) {
      messages.push(`${segment.label}指定值至少选择一个`);
    }

    if (
      state.values.some((value) => value < segment.min || value > segment.max)
    ) {
      messages.push(`${segment.label}指定值必须在 ${segment.min}-${segment.max} 之间`);
    }
  }

  return messages;
}

function getSegmentValueOptions(segment: CronSegmentConfig) {
  return Array.from({ length: segment.max - segment.min + 1 }, (_, index) => {
    const value = segment.min + index;
    return {
      label: String(value),
      value,
    };
  });
}

function getSegmentStepOptions(segment: CronSegmentConfig) {
  return Array.from({ length: segment.max }, (_, index) => {
    const value = index + 1;
    return {
      label: String(value),
      value,
    };
  });
}

function openEditor() {
  if (props.disabled) {
    return;
  }

  resetDraftSegments();
  const currentExpression = props.modelValue || DEFAULT_CRON;
  const parsed = applyExpressionToDraft(currentExpression);
  unsupportedExpression.value = parsed ? '' : currentExpression;
  open.value = true;
}

function applyPreset(expression: string) {
  applyExpressionToDraft(expression);
}

function handleOk() {
  if (hasValidationError.value) {
    return;
  }

  emit('update:modelValue', draftExpression.value);
  open.value = false;
}

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!open.value && nextValue) {
      applyExpressionToDraft(nextValue);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="crud-cron-editor-field">
    <Input
      :disabled="disabled"
      :placeholder="placeholder"
      readonly
      :value="previewText"
      @click="openEditor"
    />

    <Modal
      v-model:open="open"
      destroy-on-close
      ok-text="应用"
      :ok-button-props="okButtonProps"
      :style="modalStyle"
      :title="modalTitle"
      :width="modalWidth"
      @ok="handleOk"
    >
      <div class="cron-editor">
        <div class="cron-editor-presets">
          <Button
            v-for="preset in CRON_PRESETS"
            :key="preset.value"
            size="small"
            @click="applyPreset(preset.value)"
          >
            {{ preset.label }}
          </Button>
        </div>

        <div v-if="unsupportedExpression" class="cron-editor-warning">
          当前表达式 {{ unsupportedExpression }} 暂不支持自动拆解，请选择预设或按字段重新配置后应用。
        </div>

        <div class="cron-editor-segments">
          <div
            v-for="segment in CRON_SEGMENTS"
            :key="segment.key"
            class="cron-editor-segment"
          >
            <div class="cron-editor-segment-title">
              <span>{{ segment.label }}</span>
              <small>{{ segment.min }}-{{ segment.max }}</small>
            </div>
            <Radio.Group
              v-model:value="draftSegments[segment.key].mode"
              button-style="solid"
              option-type="button"
            >
              <Radio.Button value="any">每{{ segment.unit }}</Radio.Button>
              <Radio.Button value="fixed">固定</Radio.Button>
              <Radio.Button value="interval">间隔</Radio.Button>
              <Radio.Button value="range">范围</Radio.Button>
              <Radio.Button value="specific">指定</Radio.Button>
            </Radio.Group>
            <div class="cron-editor-segment-control">
              <template v-if="draftSegments[segment.key].mode === 'fixed'">
                <Select
                  v-model:value="draftSegments[segment.key].value"
                  class="cron-editor-number-select"
                  :options="getSegmentValueOptions(segment)"
                />
              </template>
              <template v-else-if="draftSegments[segment.key].mode === 'interval'">
                <span>从</span>
                <Select
                  v-model:value="draftSegments[segment.key].start"
                  class="cron-editor-number-select"
                  :options="getSegmentValueOptions(segment)"
                />
                <span>开始，每</span>
                <Select
                  v-model:value="draftSegments[segment.key].step"
                  class="cron-editor-number-select"
                  :options="getSegmentStepOptions(segment)"
                />
                <span>{{ segment.unit }}</span>
              </template>
              <template v-else-if="draftSegments[segment.key].mode === 'range'">
                <span>从</span>
                <Select
                  v-model:value="draftSegments[segment.key].start"
                  class="cron-editor-number-select"
                  :options="getSegmentValueOptions(segment)"
                />
                <span>到</span>
                <Select
                  v-model:value="draftSegments[segment.key].end"
                  class="cron-editor-number-select"
                  :options="getSegmentValueOptions(segment)"
                />
              </template>
              <template v-else-if="draftSegments[segment.key].mode === 'specific'">
                <Select
                  v-model:value="draftSegments[segment.key].values"
                  class="cron-editor-specific-select"
                  :max-tag-count="3"
                  mode="multiple"
                  :options="getSegmentValueOptions(segment)"
                  placeholder="请选择"
                />
              </template>
              <span v-else class="cron-editor-muted">不限制</span>
            </div>
          </div>
        </div>

        <div class="cron-editor-preview">
          <span>表达式</span>
          <code>{{ draftExpression }}</code>
        </div>
        <div v-if="validationMessages.length > 0" class="cron-editor-errors">
          <div v-for="message in validationMessages" :key="message">
            {{ message }}
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.crud-cron-editor-field {
  width: 100%;
}

.crud-cron-editor-field :deep(.ant-input[readonly]) {
  cursor: pointer;
}

.cron-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cron-editor-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cron-editor-warning,
.cron-editor-errors {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
}

.cron-editor-warning {
  border: 1px solid #ffe58f;
  background: #fffbe6;
  color: #7a4b00;
}

.cron-editor-errors {
  border: 1px solid #ffccc7;
  background: #fff2f0;
  color: #a8071a;
}

.cron-editor-segments {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.cron-editor-segment {
  display: grid;
  grid-template-columns: minmax(76px, 0.28fr) minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.cron-editor-segment-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-weight: 500;
}

.cron-editor-segment-title small,
.cron-editor-muted {
  color: hsl(var(--muted-foreground));
  font-weight: 400;
}

.cron-editor-segment-control {
  display: flex;
  grid-column: 2;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.cron-editor-number-select {
  width: 72px;
}

.cron-editor-specific-select {
  min-width: 180px;
}

.cron-editor-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--muted) / 45%);
}

.cron-editor-preview span {
  color: hsl(var(--muted-foreground));
}

.cron-editor-preview code {
  overflow: hidden;
  min-width: 0;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .cron-editor-segments {
    grid-template-columns: 1fr;
  }

  .cron-editor-segment {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .cron-editor-segment-control {
    grid-column: 1;
  }
}
</style>
