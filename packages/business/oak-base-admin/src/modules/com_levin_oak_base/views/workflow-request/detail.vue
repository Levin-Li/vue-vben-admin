<script setup lang="ts">
import type { WorkflowBusinessReference } from '@levin/bpm-runtime-ui';

import type { WorkflowRequestRecord } from '../../api/workflow-request-service';

import { ref, watch } from 'vue';

import { Alert, Descriptions, Spin } from 'ant-design-vue';

import { workflowRequestService } from '../../api/workflow-request-service';

// 该组件只在宿主的受控详情目录注册；每次读取仍经过业务接口数据范围校验。
const props = defineProps<{
  businessReference: WorkflowBusinessReference;
  readonly?: boolean;
}>();
const record = ref<WorkflowRequestRecord>();
const loading = ref(false);
const error = ref('');
let requestVersion = 0;

watch(
  () => [
    props.businessReference.businessType,
    props.businessReference.businessId,
    props.businessReference.tenantId,
    props.businessReference.orgId,
  ],
  async () => {
    const current = ++requestVersion;
    record.value = undefined;
    error.value = '';
    if (props.businessReference.businessType !== 'workflow-request') {
      loading.value = false;
      error.value = '当前业务类型不适用此详情。';
      return;
    }
    loading.value = true;
    try {
      const value = await workflowRequestService.retrieve({
        id: props.businessReference.businessId,
        ...(props.businessReference.tenantId
          ? { tenantId: props.businessReference.tenantId }
          : {}),
        ...(props.businessReference.orgId
          ? { orgId: props.businessReference.orgId }
          : {}),
      });
      if (current === requestVersion) record.value = value;
    } catch (error_) {
      if (current === requestVersion)
        error.value =
          error_ instanceof Error ? error_.message : '业务详情读取失败。';
    } finally {
      if (current === requestVersion) loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <Spin :spinning="loading">
    <Alert v-if="error" type="error" :message="error" show-icon />
    <!-- 明确列出只读业务字段，不展示归属标识或未经声明的原始 JSON。 -->
    <Descriptions v-if="record" :column="1" size="small">
      <Descriptions.Item label="申请标题">{{ record.title }}</Descriptions.Item>
      <Descriptions.Item label="申请金额">
        {{ record.amount }}
      </Descriptions.Item>
      <Descriptions.Item label="申请类别">
        {{ record.category }}
      </Descriptions.Item>
      <Descriptions.Item label="资料齐全">
        {{ record.documentsComplete ? '是' : '否' }}
      </Descriptions.Item>
      <Descriptions.Item label="办理结果摘要">
        {{ record.resultSummary || '暂无' }}
      </Descriptions.Item>
    </Descriptions>
  </Spin>
</template>
