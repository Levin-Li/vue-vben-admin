<script setup lang="ts">
import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import { ref, watch } from 'vue';

import { Select } from 'ant-design-vue';

import { invitationLinkService } from '../../api/invitation-link-service';

const props = defineProps<{
  disabled?: boolean;
  modelValue?: string;
  targetOrgId?: string;
  tenantId?: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: string | undefined];
}>();
const options = ref<Array<{ label: string; value: string }>>([]);
const loading = ref(false);
let requestVersion = 0;

async function load(keyword = '') {
  // 只读取服务端针对当前租户和组织授权后的渠道；失效响应不得覆盖新选择。
  const version = ++requestVersion;
  options.value = [];
  if (props.disabled || !props.targetOrgId) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const rows = await invitationLinkService.targetChannels(
      props.targetOrgId,
      props.tenantId,
      keyword.trim(),
    );
    if (version === requestVersion) {
      options.value = rows.map((row) => ({ label: row.name, value: row.id }));
    }
  } catch (error) {
    if (version === requestVersion) {
      notifyApiErrorOnce(error);
    }
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}

watch(
  () => [props.tenantId, props.targetOrgId, props.disabled],
  () => void load(),
  { immediate: true },
);
</script>

<template>
  <Select
    :disabled="disabled"
    :filter-option="false"
    :loading="loading"
    :options="options"
    :value="modelValue"
    allow-clear
    class="w-full"
    placeholder="请选择渠道伙伴"
    show-search
    @search="load"
    @update:value="
      (value) =>
        emit('update:modelValue', value == null ? undefined : String(value))
    "
  />
</template>
