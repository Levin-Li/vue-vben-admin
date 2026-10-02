<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import { computed, ref } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { WorkflowStartWorkbench } from '@levin/bpm-runtime-ui';
import { Alert, Card, message } from 'ant-design-vue';

import { loadWorkflowRequestOrgTree } from '../../api/workflow-request-service';
import { workflowRuntimeService } from '../../api/workflow-runtime-service';

// 各实际 API 权限独立判断，菜单存在不代表可查询对象或发起流程。
const { hasPermission } = useRbacAccess();
const userStore = useUserStore();
const selectedOrg = ref<UserOrgSelectorRecord>();
// 普通主体使用会话租户；平台主体从已授权组织继承租户，不接收任意 ID 输入。
const isPlatformActor = computed(() => {
  const actor = userStore.userInfo as null | Record<string, unknown>;
  return (
    actor?.platformUser === true ||
    actor?.isPlatformUser === true ||
    actor?.isSuperAdmin === true ||
    actor?.superAdmin === true ||
    actor?.platformAdmin === true ||
    actor?.isPlatformAdmin === true
  );
});
const tenantId = computed(() =>
  isPlatformActor.value
    ? selectedOrg.value?.tenantId
    : userStore.userInfo?.tenantId,
);
function changeOrganization(
  value: undefined | UserOrgSelectorRecord | UserOrgSelectorRecord[],
) {
  selectedOrg.value = Array.isArray(value) ? value[0] : value;
}
const canReadCatalog = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'manualStarts'),
  ),
);
const canReadRecords = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'businessRecords'),
  ),
);
const canReadEligibility = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'eligibility'),
  ),
);
const canStart = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'start')),
);
// 当前会话切换清除旧页面引用；租户由会话/宿主范围和服务端共同确定。
const actorKey = computed(() => JSON.stringify(userStore.userInfo));
function showError(error: unknown) {
  message.error(
    error instanceof Error ? error.message : '流程信息加载或发起失败，请重试。',
  );
}
</script>

<template>
  <div class="space-y-4">
    <!-- 平台主体先选择当前有权组织的租户范围，不改变全局选择器。 -->
    <Card v-if="isPlatformActor" title="业务范围" size="small">
      <UserOrgSelector
        :model-value="selectedOrg"
        :selectable-types="['org']"
        value-mode="record"
        :multiple="false"
        :show-tenant-nodes="true"
        :load-org-tree="loadWorkflowRequestOrgTree"
        placeholder="请选择本次发起流程的授权组织"
        @update:selected-records="changeOrganization"
      />
    </Card>
    <Alert
      v-if="!tenantId"
      type="info"
      message="请先确认当前业务租户范围，再选择手动流程。"
    />
    <WorkflowStartWorkbench
      v-else
      :tenant-id="tenantId"
      :key="actorKey"
      :service="workflowRuntimeService"
      :can-read-catalog="canReadCatalog"
      :can-read-records="canReadRecords"
      :can-read-eligibility="canReadEligibility"
      :can-start="canStart"
      @error="showError"
      @started="message.success('流程已发起，可在我的流程中查看办理进度。')"
    />
  </div>
</template>
