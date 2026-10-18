<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { Button, Select } from 'ant-design-vue';

import { channelPartnerService } from '../../api/channel-partner-service';
import { loadChannelPartnerPage } from './channel-partner-options';

type Option = { label: string; value: number | string };
type PartnerSummary = {
  displayName?: string;
  id?: number | string;
  legalSubjectName?: string;
  orgId?: number | string;
  type?: string;
};

const props = defineProps<{
  disabled?: boolean;
  modelValue?: number | string;
  tenantId?: number | string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: number | string | undefined];
}>();

const options = ref<Option[]>([]);
const keyword = ref('');
const pageIndex = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const loadError = ref(false);
let requestVersion = 0;

// 分页读取当前用户可访问的渠道合作关系，避免将供应商关系作为客户渠道。
async function loadPage(nextPage: number) {
  const version = ++requestVersion;
  loading.value = true;
  loadError.value = false;
  try {
    const page = await loadChannelPartnerPage(
      nextPage,
      props.tenantId,
      keyword.value,
    );
    if (version !== requestVersion) return;
    const existing =
      nextPage === 1
        ? options.value.filter((item) => item.value === props.modelValue)
        : options.value;
    options.value = [
      ...existing,
      ...page.options.filter(
        (item) => !existing.some((current) => current.value === item.value),
      ),
    ];
    pageIndex.value = nextPage;
    hasMore.value = page.hasMore;
  } catch {
    if (version === requestVersion) loadError.value = true;
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}

function searchPartner(value: string) {
  keyword.value = value;
  pageIndex.value = 0;
  void loadPage(1);
}

// 回显仅接受服务端详情确认过的渠道关系。
watch(
  () => props.modelValue,
  async (id) => {
    if (id === undefined || id === null || id === '') return;
    if (options.value.some((option) => option.value === id)) return;
    try {
      const result = (await channelPartnerService.retrieve({ id })) as
        | PartnerSummary
        | { data: PartnerSummary };
      const partner = 'data' in result ? result.data : result;
      if (props.modelValue !== id) return;
      options.value = [
        {
          label: `${partner.displayName || `渠道伙伴 ${id}`} · 组织 ${partner.orgId || '当前组织'} · ${partner.type || '渠道'}`,
          value: id,
        },
        ...options.value,
      ];
    } catch {
      // 没有合作关系详情权限时不查询或展示渠道伙伴资料。
    }
  },
  { immediate: true },
);

watch(
  () => props.tenantId,
  () => {
    requestVersion++;
    options.value = [];
    pageIndex.value = 0;
    hasMore.value = false;
    if (!props.disabled) emit('update:modelValue', undefined);
    void loadPage(1);
  },
);

onMounted(() => {
  void loadPage(1);
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <Select
      :value="modelValue"
      :disabled="disabled"
      :loading="loading"
      :options="options"
      :filter-option="false"
      :show-search="true"
      class="w-full"
      placeholder="选择渠道伙伴，可输入伙伴 ID 搜索"
      @search="searchPartner"
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
      :disabled="disabled || loading"
      size="small"
      type="link"
      @click="loadPage(pageIndex + 1)"
    >
      加载更多渠道伙伴
    </Button>
    <Button
      v-if="loadError"
      size="small"
      type="link"
      @click="loadPage(pageIndex || 1)"
    >
      渠道伙伴加载失败，重试
    </Button>
  </div>
</template>
