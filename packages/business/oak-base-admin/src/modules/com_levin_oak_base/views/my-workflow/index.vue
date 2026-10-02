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
// 每个列表只消费对应控制器方法的当前权限，菜单展示权不替代 API 授权。
const canViewTodo = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'todo')),
);
const canViewDone = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'done')),
);
const canViewStarted = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'started')),
);
const canViewCopied = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'copied')),
);
const canSendCopy = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'copy')),
);
const canLoadCopyRecipients = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'copyRecipients'),
  ),
);
const canRetry = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'retry')),
);
const canUploadAttachment = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'uploadAttachment'),
  ),
);
const canViewAttachments = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'attachments'),
  ),
);
const canDownloadAttachment = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'downloadAttachment'),
  ),
);
const canViewPendingAttachments = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'pendingAttachments'),
  ),
);
const canDeletePendingAttachment = computed(() =>
  hasPermission(
    buildApiMethodPermissions(
      workflowRuntimeService,
      'deletePendingAttachment',
    ),
  ),
);

// 运行工作台消费当前登录会话，不从路由参数接收用户或租户身份。
function showError(error: unknown) {
  message.error(
    error instanceof Error ? error.message : '流程信息加载或办理失败，请重试。',
  );
}

// 接收人候选按所选实例由工作流专用接口授权，不依赖系统用户管理权限。
const loadCopyRecipients = (instanceId: string, keyword: string) =>
  workflowRuntimeService.copyRecipients(instanceId, keyword);
</script>

<template>
  <WorkflowRuntimeWorkbench
    :detail-components="detailComponents"
    :service="workflowRuntimeService"
    :can-view-todo="canViewTodo"
    :can-view-done="canViewDone"
    :can-view-started="canViewStarted"
    :can-view-copied="canViewCopied"
    :can-send-copy="canSendCopy"
    :can-load-copy-recipients="canLoadCopyRecipients"
    :load-copy-recipients="loadCopyRecipients"
    :can-retry="canRetry"
    :can-upload-attachment="canUploadAttachment && canViewPendingAttachments"
    :can-view-attachments="canViewAttachments"
    :can-download-attachment="canDownloadAttachment"
    :can-view-pending-attachments="canViewPendingAttachments"
    :can-delete-pending-attachment="canDeletePendingAttachment"
    @error="showError"
  />
</template>
