<script lang="ts" setup>
import { ref, watch } from 'vue';

import { Alert, Select } from 'ant-design-vue';

import { channelPartnerService } from '../../api/channel-partner-service';
import { customerService } from '../../api/customer-service';
import { supplierPartnerService } from '../../api/supplier-partner-service';

type Kind = 'ChannelPartner' | 'Customer' | 'SupplierPartner';
type Option = { label: string; value: string };

const props = defineProps<{
  disabled?: boolean;
  kind?: Kind;
  modelValue?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const options = ref<Option[]>([]);
const error = ref('');
const loading = ref(false);
const pageIndex = ref(0);
const hasMore = ref(true);
let loadVersion = 0;

// 候选只读取当前业务关系；下拉滚动时按页追加，避免前一百条外无法选择。
async function loadMore() {
  const kind = props.kind;
  if (!kind || loading.value || !hasMore.value) return;
  const version = loadVersion;
  const nextPage = pageIndex.value + 1;
  loading.value = true;

  try {
    let service = channelPartnerService;
    if (kind === 'Customer') service = customerService;
    if (kind === 'SupplierPartner') service = supplierPartnerService;
    const response = await service.list({ pageIndex: nextPage, pageSize: 100 });
    if (version !== loadVersion) return;
    const payload =
      response && typeof response === 'object' && 'data' in response
        ? response.data
        : response;
    const page = payload as {
      items?: unknown;
      list?: unknown;
      records?: unknown;
    };
    const items = Array.isArray(payload)
      ? payload
      : (page?.items ?? page?.records ?? page?.list);
    const records = Array.isArray(items) ? items : [];
    options.value = [
      ...options.value,
      ...records
        .filter((item) => item?.id !== null && item?.id !== undefined)
        .map((item) => ({
          label: String(
            item.name || item.displayName || item.subjectName || item.id,
          ),
          value: String(item.id),
        })),
    ];
    pageIndex.value = nextPage;
    hasMore.value = records.length === 100;
  } catch (error_) {
    if (version !== loadVersion) return;
    error.value = error_ instanceof Error ? error_.message : '加载签约对方失败';
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}

// 对方类型变化时清空旧选择，避免把客户 ID 当作伙伴 ID 提交。
watch(
  () => props.kind,
  (kind, previousKind) => {
    if (previousKind && previousKind !== kind) emit('update:modelValue', '');
    loadVersion++;
    loading.value = false;
    options.value = [];
    error.value = '';
    pageIndex.value = 0;
    hasMore.value = true;
    void loadMore();
  },
  { immediate: true },
);

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 32) {
    void loadMore();
  }
}
</script>

<template>
  <div class="contract-counterparty-picker">
    <Select
      :disabled="disabled || !kind"
      :loading="loading"
      :options="options"
      :value="modelValue || undefined"
      class="w-full"
      option-filter-prop="label"
      placeholder="选择签约对方"
      show-search
      @popup-scroll="handleScroll"
      @update:value="(value) => emit('update:modelValue', String(value || ''))"
    />
    <Alert v-if="error" :message="error" show-icon type="error" />
  </div>
</template>
