<script setup lang="ts">
import type { SelectOption } from '../api';
import type { CrudFieldConfig } from './types';

import { computed, ref, watch } from 'vue';

import { Input, InputNumber, Select } from 'ant-design-vue';

import {
  findMatchingCrudChoiceOption,
  normalizeCrudChoiceOptions,
} from './crud-choice-value';

const props = defineProps<{
  field?: CrudFieldConfig;
  value?: unknown;
}>();
const emit = defineEmits<{ 'update:value': [value: unknown] }>();

// 仅使用页面声明的选项来源；未知字段不能从名称或当前值猜成数值。
const optionSource = computed(() => props.field?.loadOptions?.optionSource);
const hasChoices = computed(
  () =>
    Array.isArray(props.field?.options) ||
    optionSource.value === 'enum' ||
    optionSource.value === 'dictionary',
);
const isNumber = computed(
  () =>
    !hasChoices.value &&
    (props.field?.valueType === 'number' || props.field?.type === 'number'),
);
const loadedOptions = ref<SelectOption[]>([]);
const loading = ref(false);
const loadFailed = ref(false);

// 切换字段时取消旧请求的回填，避免异步枚举覆盖当前字段的候选列表。
watch(
  () => props.field,
  async (field, _previous, onCleanup) => {
    loadedOptions.value = [];
    loadFailed.value = false;
    if (
      !field?.loadOptions ||
      (field.loadOptions.optionSource !== 'enum' &&
        field.loadOptions.optionSource !== 'dictionary')
    ) {
      loading.value = false;
      return;
    }

    let active = true;
    onCleanup(() => {
      active = false;
    });
    loading.value = true;
    try {
      const options = await field.loadOptions();
      if (active)
        loadedOptions.value = normalizeCrudChoiceOptions(field, options);
    } catch (error) {
      if (active) {
        loadFailed.value = true;
        console.warn(`加载${field.label}默认值选项失败。`, error);
      }
    } finally {
      if (active) loading.value = false;
    }
  },
  { immediate: true },
);

const choices = computed(() => {
  const field = props.field;
  if (!field) return [];
  const staticOptions = normalizeCrudChoiceOptions(field, field.options || []);
  const options = [...staticOptions, ...loadedOptions.value];
  const current = props.value;
  if (
    current !== undefined &&
    current !== null &&
    current !== '' &&
    !findMatchingCrudChoiceOption(field, current, options)
  ) {
    options.unshift({
      label: `当前值：${String(current)}`,
      value: current as SelectOption['value'],
    });
  }
  return options;
});
// 选择器内部只用索引定位，提交时映射回选项原值，保留数字和布尔值类型。
const selectOptions = computed(() =>
  choices.value.map((option, index) => ({ ...option, value: String(index) })),
);
const selectedValue = computed(() => {
  const field = props.field;
  if (!field) return undefined;
  const option = findMatchingCrudChoiceOption(
    field,
    props.value,
    choices.value,
  );
  return option ? String(choices.value.indexOf(option)) : undefined;
});
const textValue = computed(() =>
  props.value === undefined || props.value === null ? '' : String(props.value),
);
const numericValue = computed(() =>
  typeof props.value === 'number' ? props.value : undefined,
);

function updateChoice(value: unknown) {
  emit(
    'update:value',
    typeof value === 'string' ? choices.value[Number(value)]?.value : undefined,
  );
}
</script>

<template>
  <Select
    v-if="hasChoices"
    :value="selectedValue"
    :options="selectOptions"
    :loading="loading"
    :not-found-content="loadFailed ? '选项加载失败' : '暂无选项'"
    option-filter-prop="label"
    show-search
    allow-clear
    class="w-full"
    placeholder="默认值"
    aria-label="默认值"
    @update:value="updateChoice"
  />
  <InputNumber
    v-else-if="isNumber"
    :value="numericValue"
    class="w-full"
    placeholder="默认值"
    aria-label="默认值"
    @update:value="emit('update:value', $event)"
  />
  <Input
    v-else
    :value="textValue"
    placeholder="默认值"
    aria-label="默认值"
    @update:value="emit('update:value', $event)"
  />
</template>
