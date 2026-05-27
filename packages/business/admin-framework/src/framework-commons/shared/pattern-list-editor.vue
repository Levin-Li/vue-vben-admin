<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  Segmented,
  Select,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';

import {
  evaluatePatternList,
  filterPatternOptions,
  normalizePatternList,
  stringifyPatternList,
  type PatternListOption,
  type PatternMatchMode,
} from './pattern-list-utils';

defineOptions({
  name: 'PatternListEditor',
});

const props = withDefaults(
  defineProps<{
    bulkPlaceholder?: string;
    disabled?: boolean;
    jsonRows?: number;
    loading?: boolean;
    matchMode?: PatternMatchMode;
    modelValue?: null | string | string[];
    options?: PatternListOption[];
    placeholder?: string;
    testPlaceholder?: string;
    testValue?: string;
  }>(),
  {
    bulkPlaceholder: '输入 JSON 数组、换行、逗号或分号分隔的匹配规则',
    disabled: false,
    jsonRows: 4,
    loading: false,
    matchMode: 'any',
    modelValue: () => [],
    options: () => [],
    placeholder: '输入或选择匹配规则',
    testPlaceholder: '输入待匹配文本',
    testValue: '',
  },
);

const emit = defineEmits<{
  change: [value: string[], matchMode: PatternMatchMode];
  dropdownVisibleChange: [open: boolean];
  search: [keyword: string];
  'update:matchMode': [value: PatternMatchMode];
  'update:modelValue': [value: string[]];
  'update:testValue': [value: string];
}>();

const bulkText = ref('');
const optionSearch = ref('');
const innerTestValue = ref(props.testValue);

watch(
  () => props.testValue,
  (value) => {
    innerTestValue.value = value || '';
  },
);

const patterns = computed(() => normalizePatternList(props.modelValue));

const selectedPatterns = computed({
  get: () => patterns.value,
  set: (value: unknown) => updatePatterns(value),
});

const currentMatchMode = computed<PatternMatchMode>({
  get: () => props.matchMode || 'any',
  set: (value) => {
    emit('update:matchMode', value);
    emit('change', patterns.value, value);
  },
});

const selectOptions = computed<SelectProps['options']>(() =>
  filterPatternOptions(props.options, optionSearch.value).map((option) => ({
    disabled: option.disabled,
    label: option.label || option.value,
    title: option.description || option.value,
    value: option.value,
  })),
);

const jsonOutput = computed(() => stringifyPatternList(patterns.value));
const testResult = computed(() =>
  evaluatePatternList(
    patterns.value,
    innerTestValue.value,
    currentMatchMode.value,
  ),
);

const matchModeOptions = [
  { label: '任一命中 OR', value: 'any' },
  { label: '全部命中 AND', value: 'all' },
];

function updatePatterns(value: unknown) {
  const next = normalizePatternList(value);
  emit('update:modelValue', next);
  emit('change', next, currentMatchMode.value);
}

function handleSearch(value: string) {
  optionSearch.value = value;
  emit('search', value);
}

function appendBulkPatterns() {
  const next = normalizePatternList([
    ...patterns.value,
    ...normalizePatternList(bulkText.value),
  ]);
  updatePatterns(next);
  bulkText.value = '';
}

function clearPatterns() {
  updatePatterns([]);
}

function updateTestValue(value: string) {
  innerTestValue.value = value;
  emit('update:testValue', value);
}

async function copyJsonOutput() {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(jsonOutput.value);
  message.success('已复制');
}
</script>

<template>
  <div
    class="pattern-list-editor border-border bg-card space-y-3 rounded-md border p-3"
  >
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
      <Select
        v-model:value="selectedPatterns"
        :disabled="disabled"
        :filter-option="false"
        :loading="loading"
        :options="selectOptions"
        :placeholder="placeholder"
        allow-clear
        class="w-full"
        mode="tags"
        show-search
        @dropdown-visible-change="(open) => emit('dropdownVisibleChange', open)"
        @search="handleSearch"
      />

      <Segmented
        v-model:value="currentMatchMode"
        :disabled="disabled"
        :options="matchModeOptions"
        block
      />
    </div>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <Input.TextArea
        v-model:value="bulkText"
        :auto-size="{ minRows: 2, maxRows: 6 }"
        :disabled="disabled"
        :placeholder="bulkPlaceholder"
      />
      <div class="flex items-start gap-2">
        <Tooltip title="加入">
          <Button
            :disabled="disabled || !bulkText.trim()"
            type="primary"
            @click="appendBulkPatterns"
          >
            <IconifyIcon class="size-4" icon="lucide:plus" />
          </Button>
        </Tooltip>
        <Tooltip title="清空">
          <Button
            :disabled="disabled || patterns.length === 0"
            @click="clearPatterns"
          >
            <IconifyIcon class="size-4" icon="lucide:trash-2" />
          </Button>
        </Tooltip>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
      <div class="space-y-2">
        <Input
          :disabled="disabled"
          :placeholder="testPlaceholder"
          :value="innerTestValue"
          allow-clear
          @update:value="updateTestValue"
        >
          <template #prefix>
            <IconifyIcon
              class="text-muted-foreground size-4"
              icon="lucide:search-check"
            />
          </template>
        </Input>

        <div class="flex flex-wrap gap-2">
          <Tag
            v-if="innerTestValue && patterns.length"
            :color="testResult.matched ? 'success' : 'error'"
          >
            {{ testResult.matched ? '匹配' : '未匹配' }}
          </Tag>
          <Tag v-else>待测试</Tag>
          <Tag
            v-for="item in testResult.items"
            :key="item.pattern"
            :color="item.matched ? 'success' : undefined"
          >
            {{ item.pattern }}
          </Tag>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-muted-foreground text-sm">JSON</span>
          <Tooltip title="复制 JSON">
            <Button size="small" @click="copyJsonOutput">
              <IconifyIcon class="size-3.5" icon="lucide:copy" />
            </Button>
          </Tooltip>
        </div>
        <Input.TextArea
          :rows="jsonRows"
          :value="jsonOutput"
          class="pattern-list-editor__json"
          readonly
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pattern-list-editor__json :deep(textarea) {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}
</style>
