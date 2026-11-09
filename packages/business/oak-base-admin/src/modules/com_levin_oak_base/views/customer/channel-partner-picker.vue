<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { Button, Select } from 'ant-design-vue';

import { channelPartnerService } from '../../api/channel-partner-service';
import { loadChannelPartnerPage } from './channel-partner-options';
import { loadChannelReferencePage } from './channel-partner-reference';

type Option = { label: string; value: number | string };
type PartnerSummary = {
  name?: string;
  id?: number | string;
  legalSubjectName?: string;
  subjectOrgId?: number | string;
  tenantId?: string;
  type?: string;
};

const props = defineProps<{
  disabled?: boolean;
  modelValue?: number | string;
  requireTenant?: boolean;
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
let detailVersion = 0;

// 分页读取当前用户可访问的渠道合作关系，避免将供应商关系作为客户渠道。
async function loadPage(nextPage: number) {
  const version = ++requestVersion;
  if (props.requireTenant && !props.tenantId) {
    options.value = [];
    return;
  }
  loading.value = true;
  loadError.value = false;
  try {
    const page = props.requireTenant
      ? await loadChannelReferencePage(
          String(props.tenantId),
          nextPage,
          keyword.value,
        )
      : await loadChannelPartnerPage(nextPage, props.tenantId, keyword.value);
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

watch(
  () => props.tenantId,
  (_next, previous) => {
    requestVersion++;
    detailVersion++;
    options.value = [];
    pageIndex.value = 0;
    hasMore.value = false;
    if (previous && !props.disabled) emit('update:modelValue', undefined);
    void loadPage(1);
  },
);

// 回显仅接受服务端详情确认过的渠道关系。
watch(
  () => [props.modelValue, props.tenantId] as const,
  async ([id]) => {
    const version = ++detailVersion;
    if (
      (props.requireTenant && !props.tenantId) ||
      id === undefined ||
      id === null ||
      id === ''
    )
      return;
    if (options.value.some((option) => option.value === id)) return;
    try {
      // 平台租户回显走同一受控候选接口，避免依赖被脱敏的租户字段。
      if (props.requireTenant && props.tenantId) {
        const page = await loadChannelReferencePage(
          String(props.tenantId),
          1,
          '',
          String(id),
        );
        if (version === detailVersion && props.modelValue === id) {
          options.value = [
            ...page.options,
            ...options.value.filter((option) => option.value !== id),
          ];
        }
        return;
      }
      const result = (await channelPartnerService.retrieve({
        id,
        ...(props.tenantId ? { tenantId: props.tenantId } : {}),
      })) as PartnerSummary | { data: PartnerSummary };
      const partner = 'data' in result ? result.data : result;
      if (
        version !== detailVersion ||
        props.modelValue !== id ||
        (props.tenantId &&
          partner.tenantId &&
          partner.tenantId !== String(props.tenantId))
      )
        return;
      options.value = [
        {
          label: `${partner.name || `渠道伙伴 ${id}`} · 组织 ${partner.subjectOrgId || '未配置'} · ${partner.type || '渠道'}`,
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

onMounted(() => {
  void loadPage(1);
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <Select
      :value="modelValue"
      :disabled="disabled || (requireTenant && !tenantId)"
      :loading="loading"
      :options="options"
      :filter-option="false"
      :show-search="true"
      class="w-full"
      placeholder="选择渠道伙伴，可输入名称搜索"
      @search="searchPartner"
      @update:value="
        (value) =>
          !(requireTenant && !tenantId) &&
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
