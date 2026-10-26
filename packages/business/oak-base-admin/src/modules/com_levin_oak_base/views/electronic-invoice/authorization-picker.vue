<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { Button, Select } from 'ant-design-vue';

import { electronicInvoiceProviderConnectionService } from '../../api/electronic-invoice-provider-connection-service';

const props = defineProps<{
  modelValue?: string;
  tenantId?: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: string | undefined];
}>();
const options = ref<{ label: string; value: string }[]>([]);
const loading = ref(false);
const pageIndex = ref(0);
const hasMore = ref(false);
const loadError = ref(false);
let version = 0;

async function loadPage(nextPage: number) {
  const current = ++version;
  loading.value = true;
  loadError.value = false;
  try {
    const result = await electronicInvoiceProviderConnectionService.list({
      tenantId: props.tenantId,
      status: 'Active',
      pageIndex: nextPage,
      pageSize: 50,
    });
    if (current !== version) return;
    const page = (result as any)?.data ?? result;
    const items = page?.items ?? [];
    const nextOptions = items
      .filter((item: any) => item.id && item.status === 'Active')
      .map((item: any) => ({
        label: `${item.legalSubjectName || `公司 ${item.legalSubjectId}`} · ${item.providerCode || '开票服务商'}`,
        value: String(item.id),
      }));
    options.value =
      nextPage === 1 ? nextOptions : [...options.value, ...nextOptions];
    pageIndex.value = nextPage;
    hasMore.value = items.length === 50;
  } catch {
    if (current === version) loadError.value = true;
  } finally {
    if (current === version) loading.value = false;
  }
}

watch(
  () => props.tenantId,
  () => {
    version++;
    options.value = [];
    pageIndex.value = 0;
    emit('update:modelValue', undefined);
    void loadPage(1);
  },
);
onMounted(() => void loadPage(1));
</script>

<template>
  <Select
    :value="modelValue"
    :loading="loading"
    :options="options"
    class="w-full"
    placeholder="选择销售方公司及开票授权"
    @update:value="
      (value) =>
        emit('update:modelValue', value == null ? undefined : String(value))
    "
  />
  <Button
    v-if="hasMore"
    size="small"
    type="link"
    @click="loadPage(pageIndex + 1)"
  >
    加载更多公司
  </Button>
  <Button
    v-if="loadError"
    size="small"
    type="link"
    @click="loadPage(pageIndex || 1)"
  >
    授权加载失败，重试
  </Button>
</template>
