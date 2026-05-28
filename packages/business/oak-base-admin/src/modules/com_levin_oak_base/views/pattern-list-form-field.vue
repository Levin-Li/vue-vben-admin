<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import type { PatternMatchMode, SelectOption } from '@levin/admin-framework';
import { PatternListEditor } from '@levin/admin-framework';
import type { CrudFieldConfig } from '@levin/admin-framework/framework-commons/shared/types';

defineOptions({
  name: 'PatternListFormField',
});

const props = withDefaults(
  defineProps<{
    customTest?: boolean;
    field: CrudFieldConfig;
    matchMode?: PatternMatchMode;
    modelValue: unknown;
    testable?: boolean;
    validateItem?: (value: string) => boolean | string | undefined;
  }>(),
  {
    customTest: false,
    matchMode: 'any',
    testable: true,
  },
);

const emit = defineEmits<{
  test: [];
  'update:modelValue': [value: unknown];
}>();

const localOptions = ref<SelectOption[]>([]);
const loading = ref(false);
let loadSeq = 0;

const modelProxy = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
const fieldOptions = computed(() => [
  ...(props.field.options || []),
  ...localOptions.value,
]);
const patternOptions = computed(() =>
  fieldOptions.value.map((option) => ({
    description: String((option as Record<string, unknown>).description || ''),
    disabled: !!(option as Record<string, unknown>).disabled,
    label: String(option.label ?? option.value ?? ''),
    value: String(option.value ?? ''),
  })),
);
const editorHint = computed(() => (props.field.help ? '' : undefined));
const showEmptyImage = computed(() => props.field.showEmptyImage === true);

async function loadOptions(keyword = '') {
  if (!props.field.loadOptions) {
    return;
  }

  const currentSeq = ++loadSeq;
  loading.value = true;

  try {
    const options = await props.field.loadOptions(keyword);

    if (currentSeq === loadSeq) {
      localOptions.value = options;
    }
  } finally {
    if (currentSeq === loadSeq) {
      loading.value = false;
    }
  }
}

function handleSearch(keyword: string) {
  void loadOptions(keyword);
}

function handleDropdownVisibleChange(open: boolean) {
  if (open) {
    void loadOptions();
  }
}

onMounted(() => {
  void loadOptions();
});
</script>

<template>
  <PatternListEditor
    v-model="modelProxy"
    class="min-w-0"
    :loading="loading"
    :hint="editorHint"
    :custom-test="customTest"
    :match-mode="matchMode"
    :options="patternOptions"
    :placeholder="field.placeholder || `请输入${field.label}`"
    :show-empty-image="showEmptyImage"
    :testable="testable"
    :test-placeholder="`测试${field.label}`"
    :validate-item="validateItem"
    @dropdown-visible-change="handleDropdownVisibleChange"
    @search="handleSearch"
    @test="$emit('test')"
  />
</template>
