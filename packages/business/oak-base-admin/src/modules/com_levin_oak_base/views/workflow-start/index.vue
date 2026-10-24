<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import { computed, ref } from 'vue';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import { isDataAttrPolicyReady } from '@levin/admin-framework/framework-commons/data-attr-policy';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import CrudLayout from '@levin/admin-framework/framework-commons/shared/crud-layout.vue';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { WorkflowStartWorkbench } from '@levin/bpm-runtime-ui';
import { Form, message } from 'ant-design-vue';

import { loadWorkflowRequestOrgTree } from '../../api/workflow-request-service';
import { workflowRuntimeService } from '../../api/workflow-runtime-service';

// 各实际 API 权限独立判断，菜单存在不代表可查询对象或发起流程。
const { hasPermission } = useRbacAccess();
const userStore = useUserStore();
const accessStore = useAccessStore();
const workflowReady = computed(
  () => !!accessStore.accessToken && isDataAttrPolicyReady(),
);
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
    <!-- 平台业务范围使用标准横向查询面板，不改变全局选择器。 -->
    <CrudLayout
      v-if="isPlatformActor"
      form-id="workflow-start-scope"
      form-name="发起流程业务范围"
    >
      <template #query>
        <Form.Item label="业务范围" name="orgId">
          <UserOrgSelector
            :model-value="selectedOrg"
            :selectable-types="['org']"
            value-mode="record"
            :multiple="false"
            :show-tenant-nodes="true"
            :load-org-tree="loadWorkflowRequestOrgTree"
            placeholder="平台全局业务；可选择授权组织"
            class="w-full"
            @update:selected-records="changeOrganization"
          />
        </Form.Item>
      </template>
      <template #notice>
        未选择组织时查询平台全局状态流程；选择组织后查询该业务范围。
      </template>
    </CrudLayout>
    <p
      v-if="!tenantId && !isPlatformActor"
      class="text-muted-foreground text-sm"
    >
      请先确认当前业务租户范围，再选择手动流程。
    </p>
    <WorkflowStartWorkbench
      v-if="(tenantId || isPlatformActor) && workflowReady"
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
