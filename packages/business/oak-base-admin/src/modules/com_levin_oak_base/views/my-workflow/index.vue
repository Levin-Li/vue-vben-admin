<script setup lang="ts">
import { computed } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { WorkflowRuntimeWorkbench } from '@levin/bpm-runtime-ui';
import { message } from 'ant-design-vue';

import { workflowRuntimeService } from '../../api/workflow-runtime-service';
import WorkflowRequestDetail from '../workflow-request/detail.vue';
import WorkflowExpenseDetail from './workflow-expense-detail.vue';

// 仅注册明确业务组件，不根据服务器字符串动态 import 任意路径。
const detailComponents = {
  'workflow-request': WorkflowRequestDetail,
  'workflow-expense': WorkflowExpenseDetail,
};
const { hasPermission } = useRbacAccess();
const canRetry = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'retry')),
);

// 运行工作台消费当前登录会话，不从路由参数接收用户或租户身份。
function showError(error: unknown) {
  message.error(
    error instanceof Error ? error.message : '流程信息加载或办理失败，请重试。',
  );
}
</script>

<template>
  <WorkflowRuntimeWorkbench
    :detail-components="detailComponents"
    :service="workflowRuntimeService"
    :can-retry="canRetry"
    @error="showError"
  />
</template>
