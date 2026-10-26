<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import { Button, Select } from 'ant-design-vue';

import { loadAuthorizationLegalSubjectPage } from './authorization-legal-subject-options';

type Option = { label: string; value: number | string };

const props = defineProps<{
  disabled?: boolean;
  modelValue?: number | string;
  tenantId?: number | string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: number | string | undefined];
}>();

const userStore = useUserStore();
const requiresTenant = computed(() => isPlatformUser(userStore.userInfo));

const options = ref<Option[]>([]);
const keyword = ref('');
const pageIndex = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const loadError = ref(false);
let requestVersion = 0;

// 搜索或切换租户时重载第一页，过期请求不得覆盖当前候选。
async function searchSubjects(value = '') {
  keyword.value = value;
  pageIndex.value = 0;
  await loadPage(1);
}

async function loadPage(nextPageIndex: number) {
  // 平台用户先选归属租户，再请求该租户下可办理授权的公司。
  if (requiresTenant.value && !props.tenantId) {
    options.value = [];
    hasMore.value = false;
    loadError.value = false;
    return;
  }

  const version = ++requestVersion;
  loading.value = true;
  loadError.value = false;
  try {
    const page = await loadAuthorizationLegalSubjectPage(
      keyword.value,
      nextPageIndex,
      props.tenantId,
    );
    if (version !== requestVersion) return;

    // 保留已选项的公司名称，避免搜索下一页时仅显示原始 ID。
    if (nextPageIndex === 1) {
      const selected = options.value.find(
        (option) => option.value === props.modelValue,
      );
      options.value =
        selected &&
        !page.options.some((option) => option.value === selected.value)
          ? [selected, ...page.options]
          : page.options;
    } else {
      const existing = new Set(options.value.map((option) => option.value));
      options.value = [
        ...options.value,
        ...page.options.filter((option) => !existing.has(option.value)),
      ];
    }
    pageIndex.value = nextPageIndex;
    hasMore.value = page.hasMore;
  } catch {
    if (version === requestVersion) loadError.value = true;
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}

watch(
  () => props.tenantId,
  (next, previous) => {
    if (next === previous) return;
    emit('update:modelValue', undefined);
    options.value = [];
    void searchSubjects();
  },
);

onMounted(() => {
  void searchSubjects();
});
</script>

<template>
  <div>
    <Select
      :value="modelValue"
      :allow-clear="true"
      :disabled="disabled"
      :filter-option="false"
      :loading="loading"
      :options="options"
      :show-search="true"
      class="w-full"
      :placeholder="
        requiresTenant && !tenantId
          ? '请先选择归属租户'
          : '搜索并选择要开票的公司'
      "
      @search="searchSubjects"
      @update:value="
        (value) =>
          emit(
            'update:modelValue',
            typeof value === 'string' || typeof value === 'number'
              ? value
              : undefined,
          )
      "
    />
    <Button
      v-if="hasMore"
      :disabled="loading || disabled"
      size="small"
      type="link"
      @click="loadPage(pageIndex + 1)"
    >
      加载更多公司
    </Button>
    <Button
      v-if="loadError"
      :disabled="loading || disabled"
      size="small"
      type="link"
      @click="loadPage(pageIndex || 1)"
    >
      公司列表加载失败，重试
    </Button>
  </div>
</template>
