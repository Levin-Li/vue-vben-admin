<script setup lang="ts">
import type { WorkflowBusinessReference } from '@levin/bpm-runtime-ui';

import type { ContractDocumentReference } from '../../api/electronic-contract-service';

import { onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Spin } from 'ant-design-vue';

import { electronicContractService } from '../../api/electronic-contract-service';
import ContractPreviewPanel from '../electronic-contract/contract-preview-panel.vue';

// 合同正文作为已授权业务资料展示，节点的结构化办理表单继续由运行组件负责。
const props = defineProps<{
  businessReference: WorkflowBusinessReference;
  readonly?: boolean;
}>();
const contract = ref<ContractDocumentReference>();
const loading = ref(false);
const error = ref('');
let requestVersion = 0;

// 租户、组织或业务引用变化时立即清空旧正文，迟到的详情不得覆盖当前合同。
watch(
  () => [
    props.businessReference.businessType,
    props.businessReference.businessId,
    props.businessReference.tenantId,
    props.businessReference.orgId,
  ],
  async () => {
    const current = ++requestVersion;
    contract.value = undefined;
    error.value = '';
    loading.value = true;
    const reference = { ...props.businessReference };
    try {
      if (reference.businessType !== 'electronic-contract')
        throw new Error('当前业务类型不适用电子合同详情。');
      const result = await electronicContractService.documentReference({
        id: reference.businessId,
        ...(reference.tenantId ? { tenantId: reference.tenantId } : {}),
        ...(reference.orgId ? { orgId: reference.orgId } : {}),
      });
      if (current === requestVersion) contract.value = result;
    } catch (error_) {
      if (current === requestVersion)
        error.value =
          error_ instanceof Error ? error_.message : '合同详情读取失败。';
    } finally {
      if (current === requestVersion) loading.value = false;
    }
  },
  { immediate: true, flush: 'sync' },
);
onBeforeUnmount(() => requestVersion++);
</script>

<template>
  <Spin :spinning="loading">
    <Alert v-if="error" type="error" :message="error" show-icon />
    <ContractPreviewPanel v-if="contract" :contract="contract" />
  </Spin>
</template>
