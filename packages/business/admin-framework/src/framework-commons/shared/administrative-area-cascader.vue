<script lang="ts" setup>
import type { AdministrativeAreaLevel } from './administrative-area-data';

import { computed, ref, watch } from 'vue';

import { Cascader, message } from 'ant-design-vue';

import {
  filterAdministrativeAreaOptions,
  formatAdministrativeArea,
  getAdministrativeAreaCascaderOptions,
  getCurrentOpenAreaCodes,
  hasOpenAreaContext,
  normalizeAdministrativeAreaCode,
  restrictAdministrativeAreaOptionsByLevels,
  resolveAdministrativeAreaSelectableLevels,
  resolveAdministrativeAreaPath,
} from './administrative-area-data';

const props = withDefaults(
  defineProps<{
    bizCategory?: string;
    bizType?: string;
    disabled?: boolean;
    domain?: string;
    modelValue?: string;
    normalizeToSixDigits?: boolean;
    placeholder?: string;
    selectableLevels?: AdministrativeAreaLevel[];
  }>(),
  {
    modelValue: '',
    normalizeToSixDigits: true,
    placeholder: '请选择省、市、区县',
  },
);

const emit = defineEmits<{
  change: [code: string];
  'update:modelValue': [code: string];
}>();

const effectiveSelectableLevels = computed(() =>
  resolveAdministrativeAreaSelectableLevels(
    props.selectableLevels,
    props.modelValue,
  ),
);

const valuePath = ref<string[]>([]);
const options = ref<any[]>(getRestrictedOptions());
const loading = ref(false);

const isLevelRestricted = computed(
  () => new Set(effectiveSelectableLevels.value).size < 3,
);

function getRestrictedOptions(options = getAdministrativeAreaCascaderOptions()) {
  return restrictAdministrativeAreaOptionsByLevels(
    options,
    effectiveSelectableLevels.value,
  );
}

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
    options.value = getRestrictedOptions();
  },
  { immediate: true },
);

const cascaderOptions = computed(() => options.value);

const openAreaContext = computed(() => ({
  bizCategory: props.bizCategory,
  bizType: props.bizType,
  domain: props.domain,
}));

watch(
  openAreaContext,
  () => {
    options.value = getRestrictedOptions();
  },
  { deep: true },
);

watch(
  () => props.selectableLevels,
  () => {
    options.value = getRestrictedOptions();
  },
  { deep: true },
);

async function handleDropdownVisibleChange(open: boolean) {
  if (!open) return;
  if (!hasOpenAreaContext(openAreaContext.value)) {
    options.value = getRestrictedOptions();
    return;
  }
  loading.value = true;
  try {
    options.value = getRestrictedOptions(
      filterAdministrativeAreaOptions(
        await getCurrentOpenAreaCodes(openAreaContext.value),
      ),
    );
  } catch {
    options.value = [];
    message.error('获取开通区域失败，请重试');
  } finally {
    loading.value = false;
  }
}

function displayAreaPath() {
  return formatAdministrativeArea(valuePath.value.at(-1));
}

function handleChange(nextValue: unknown) {
  const selectedPath = Array.isArray(nextValue)
    ? nextValue.map((value) => String(value))
    : nextValue === null || nextValue === undefined
      ? []
      : [String(nextValue)];
  const code = selectedPath.at(-1) || '';
  if (!code) {
    emit('update:modelValue', '');
    emit('change', '');
    return;
  }
  const path = resolveAdministrativeAreaPath(code);
  const level = path.at(-1)?.level;
  const isDirectMunicipalityCity =
    effectiveSelectableLevels.value.length === 1 &&
    effectiveSelectableLevels.value[0] === 'city' &&
    level === 'province' &&
    path.at(-1)?.children?.every((child) => child.level !== 'city');
  if (
    (!level || !effectiveSelectableLevels.value.includes(level)) &&
    !isDirectMunicipalityCity
  ) {
    message.warning('当前层级不可选择');
    valuePath.value = path.slice(0, -1).map((node) => node.code);
    return;
  }
  const emittedCode = props.normalizeToSixDigits
    ? normalizeAdministrativeAreaCode(code)
    : code;
  emit('update:modelValue', emittedCode);
  emit('change', emittedCode);
}
</script>

<template>
  <Cascader
    v-model:value="valuePath"
    :allow-clear="true"
    :change-on-select="!isLevelRestricted"
    :disabled="disabled"
    :display-render="displayAreaPath"
    :loading="loading"
    :options="cascaderOptions"
    :placeholder="placeholder"
    class="w-full"
    show-search
    @change="handleChange"
    @dropdown-visible-change="handleDropdownVisibleChange"
  />
</template>
