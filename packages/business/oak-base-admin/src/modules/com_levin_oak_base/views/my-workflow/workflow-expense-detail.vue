<script setup lang="ts">
import type { WorkflowBusinessReference } from '@levin/bpm-runtime-ui';

import type { WorkflowExpenseRecord } from '../../api/workflow-expense-service';

import { onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Descriptions, Spin } from 'ant-design-vue';

import { workflowExpenseService } from '../../api/workflow-expense-service';

// 本地登记的业务详情只负责读取，节点核定表单仍使用公共工作流动作组件。
const props = defineProps<{
  businessReference: WorkflowBusinessReference;
  readonly?: boolean;
}>();
const record = ref<WorkflowExpenseRecord>();
const loading = ref(false);
const error = ref('');
let requestVersion = 0;

// 业务类型、主键及作用域任一变化立即清空旧值，迟到响应不得泄露上一对象详情。
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
    const reference = { ...props.businessReference };
    if (reference.businessType !== 'workflow-expense') {
      loading.value = false;
      error.value = '当前业务类型不适用报销详情。';
      return;
    }
    loading.value = true;
    try {
      const value = await workflowExpenseService.retrieve({
        id: reference.businessId,
        ...(reference.tenantId ? { tenantId: reference.tenantId } : {}),
        ...(reference.orgId ? { orgId: reference.orgId } : {}),
      });
      if (current === requestVersion) record.value = value;
    } catch (error_) {
      if (current === requestVersion)
        error.value =
          error_ instanceof Error ? error_.message : '报销详情读取失败。';
    } finally {
      if (current === requestVersion) loading.value = false;
    }
  },
  { immediate: true, flush: 'sync' },
);

// 关闭任务或离开工作台后不再更新已卸载组件。
onBeforeUnmount(() => requestVersion++);
</script>

<template>
  <Spin :spinning="loading">
    <Alert v-if="error" type="error" :message="error" show-icon />
    <!-- 显式列出六个只读字段，不展示申请人或租户组织原始标识，不提供可写表单。 -->
    <Descriptions v-if="record" :column="1" size="small">
      <Descriptions.Item label="报销事由">
        {{ record.subject }}
      </Descriptions.Item>
      <Descriptions.Item label="申报金额">
        {{ record.claimedAmount }}
      </Descriptions.Item>
      <Descriptions.Item label="票据齐全">
        {{ record.receiptsReady ? '是' : '否' }}
      </Descriptions.Item>
      <Descriptions.Item label="核定金额">
        {{ record.verifiedAmount ?? '尚未核定' }}
      </Descriptions.Item>
      <Descriptions.Item label="核定说明">
        {{ record.reviewNote || '暂无' }}
      </Descriptions.Item>
      <Descriptions.Item label="处理结果">
        {{ record.resultSummary || '暂无' }}
      </Descriptions.Item>
    </Descriptions>
  </Spin>
</template>
