<script lang="ts" setup>
import type { AdministrativeAreaLevel } from './administrative-area-data';

import { computed, ref, watch } from 'vue';

import { Cascader, message } from 'ant-design-vue';

import {
  filterAdministrativeAreaOptions,
  getAdministrativeAreaCascaderOptions,
  getCurrentOpenAreaCodes,
  normalizeAdministrativeAreaCode,
  resolveAdministrativeAreaPath,
} from './administrative-area-data';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modelValue?: string;
    placeholder?: string;
    selectableLevels?: AdministrativeAreaLevel[];
  }>(),
  {
    modelValue: '',
    placeholder: '请选择省、市、区县',
    selectableLevels: () => ['province', 'city', 'district'],
  },
);

const emit = defineEmits<{
  change: [code: string];
  'update:modelValue': [code: string];
}>();

const valuePath = ref<string[]>([]);
const options = ref<any[]>(getAdministrativeAreaCascaderOptions());
const loading = ref(false);

watch(
  () => props.modelValue,
  (value) => {
    try {
      valuePath.value = resolveAdministrativeAreaPath(value).map(
        (node) => node.code,
      );
    } catch {
      valuePath.value = [];
      if (value) message.error('行政编码必须为2至6位数字');
    }
  },
  { immediate: true },
);

const cascaderOptions = computed(() => options.value);

async function handleDropdownVisibleChange(open: boolean) {
  if (!open) return;
  loading.value = true;
  try {
    options.value = filterAdministrativeAreaOptions(
      await getCurrentOpenAreaCodes(),
    );
  } catch {
    options.value = [];
    message.error('获取开通区域失败，请重试');
  } finally {
    loading.value = false;
  }
}

function handleChange(nextValue: string[]) {
  const code = nextValue.at(-1) || '';
  if (!code) {
    emit('update:modelValue', '');
    emit('change', '');
    return;
  }
  const path = resolveAdministrativeAreaPath(code);
  const level = path.at(-1)?.level;
  if (!level || !props.selectableLevels.includes(level)) {
    message.warning('当前层级不可选择');
    valuePath.value = path.slice(0, -1).map((node) => node.code);
    return;
  }
  const normalizedCode = normalizeAdministrativeAreaCode(code);
  emit('update:modelValue', normalizedCode);
  emit('change', normalizedCode);
}
</script>

<template>
  <Cascader
    v-model:value="valuePath"
    :allow-clear="true"
    :change-on-select="true"
    :disabled="disabled"
    :loading="loading"
    :options="cascaderOptions"
    :placeholder="placeholder"
    class="w-full"
    show-search
    @change="handleChange"
    @dropdown-visible-change="handleDropdownVisibleChange"
  />
</template>
