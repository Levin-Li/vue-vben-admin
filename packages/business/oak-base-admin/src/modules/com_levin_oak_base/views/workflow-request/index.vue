<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type { WorkflowRequestRecord } from '../../api/workflow-request-service';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { WorkflowBusinessPanel } from '@levin/bpm-runtime-ui';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  message,
  Modal,
  Space,
} from 'ant-design-vue';

import {
  loadWorkflowRequestOrgTree,
  WorkflowRequestService,
} from '../../api/workflow-request-service';
import { workflowRuntimeService } from '../../api/workflow-runtime-service';
import CrudPage from '../crud-page.vue';
import { workflowRequestPageConfig } from './config';

// 保留原有业务 CRUD；平台关联及办理历史通过公开运行组件独立展示。
const router = useRouter();
const userStore = useUserStore();
const selectedOrg = ref<UserOrgSelectorRecord>();
const selectedScope = computed(() =>
  selectedOrg.value?.tenantId
    ? { tenantId: selectedOrg.value.tenantId, orgId: selectedOrg.value.id }
    : undefined,
);
const scopeKey = computed(() => JSON.stringify(selectedScope.value));
const scopedRequestService = new WorkflowRequestService(
  () => selectedScope.value,
);
const scopedConfig = computed(() => ({
  ...workflowRequestPageConfig,
  apiService: scopedRequestService,
}));
const isPlatformUser = computed(() => {
  const user = (userStore.userInfo ?? {}) as Record<string, unknown>;
  return (
    user.platformUser === true ||
    user.isPlatformUser === true ||
    user.superAdmin === true ||
    user.isSuperAdmin === true
  );
});
const { hasPermission } = useRbacAccess();
const canRetry = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'retry')),
);
// 各写命令使用自己的方法权限，并要求可读取用于确认的轮次状态。
const canReadRound = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'roundState'),
  ),
);
const canNewRound = computed(
  () =>
    canReadRound.value &&
    hasPermission(
      buildApiMethodPermissions(workflowRuntimeService, 'newRound'),
    ),
);
const canResubmit = computed(
  () =>
    canReadRound.value &&
    hasPermission(
      buildApiMethodPermissions(workflowRuntimeService, 'resubmit'),
    ),
);
const detailPermission = buildApiMethodPermissions(
  scopedRequestService,
  'retrieve',
);
const selected = ref<WorkflowRequestRecord>();
const opening = ref(false);
let reloadList: (() => Promise<unknown> | unknown) | undefined;

async function openWorkflow(
  record: WorkflowRequestRecord,
  reload: () => unknown,
) {
  if (!hasPermission(detailPermission) || opening.value) return;
  opening.value = true;
  const requestedScope = scopeKey.value;
  try {
    const result = await scopedRequestService.retrieve({ id: record.id });
    if (scopeKey.value !== requestedScope) return;
    selected.value = result;
    reloadList = reload;
  } catch (error) {
    showError(error);
  } finally {
    opening.value = false;
  }
}

function showError(error: unknown) {
  message.error(
    error instanceof Error ? error.message : '流程操作失败，请重试。',
  );
}

async function refreshRecord() {
  const requestedScope = scopeKey.value;
  const id = selected.value?.id;
  if (id) {
    const result = await scopedRequestService.retrieve({ id });
    if (scopeKey.value !== requestedScope || selected.value?.id !== id) return;
    selected.value = result;
  }
  await reloadList?.();
}

function changeOrganization(records: UserOrgSelectorRecord[]) {
  const next = records[0];
  if (next && (next.kind !== 'org' || !next.tenantId)) {
    message.error('请选择携带租户归属的已授权组织。');
    return;
  }
  if (
    next?.id === selectedOrg.value?.id &&
    next?.tenantId === selectedOrg.value?.tenantId
  )
    return;
  const apply = () => {
    // 范围变化后卸载旧业务表单和流程抽屉，避免沿用另一组织的记录。
    selected.value = undefined;
    reloadList = undefined;
    selectedOrg.value = next;
  };
  if (selectedOrg.value) {
    Modal.confirm({
      title: '切换业务组织？',
      content: '切换将关闭当前业务表单并重新加载列表，请先保存需要保留的内容。',
      onOk: apply,
    });
  } else apply();
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 复用授权组织选择器，只影响本页请求，不启用或修改全局选择器配置。 -->
    <Card size="small" title="当前业务组织">
      <UserOrgSelector
        :model-value="selectedOrg"
        :selectable-types="['org']"
        value-mode="record"
        :multiple="false"
        :show-tenant-nodes="isPlatformUser"
        :load-org-tree="loadWorkflowRequestOrgTree"
        placeholder="请选择本次办理的授权组织"
        class="w-full max-w-md"
        @update:selected-records="changeOrganization"
      />
    </Card>
    <!-- 样例没有业务状态选择器；是否可启动以服务端资格为准。 -->
    <Alert
      type="info"
      show-icon
      message="同一申请可关联多个用途的流程。修改关键资料是否允许，由服务端根据当前办理记录校验。"
    />
    <Alert
      v-if="!selectedScope"
      type="info"
      show-icon
      message="请先选择业务组织，再创建或查看申请。范围将由服务端重新校验。"
    />
    <CrudPage v-else :key="scopeKey" :config="scopedConfig">
      <template #row-actions="{ record, reload }">
        <Button
          v-if="hasPermission(detailPermission)"
          size="small"
          type="link"
          :loading="opening"
          @click="openWorkflow(record, reload)"
        >
          业务流程
        </Button>
      </template>
    </CrudPage>

    <!-- 只读业务上下文与可嵌入流程组件共用同一个经过授权的业务引用。 -->
    <Drawer
      :open="!!selected"
      title="申请流程与历史"
      width="min(900px, 95vw)"
      @close="selected = undefined"
    >
      <template v-if="selected">
        <Descriptions :column="1" class="mb-4" size="small">
          <Descriptions.Item label="申请标题">
            {{ selected.title }}
          </Descriptions.Item>
          <Descriptions.Item label="申请金额">
            {{ selected.amount }}
          </Descriptions.Item>
          <Descriptions.Item label="业务类别">
            {{ selected.category || '—' }}
          </Descriptions.Item>
          <Descriptions.Item label="资料齐全">
            {{ selected.documentsComplete ? '是' : '否' }}
          </Descriptions.Item>
          <Descriptions.Item label="处理结果">
            {{ selected.resultSummary || '暂无' }}
          </Descriptions.Item>
        </Descriptions>
        <Space class="mb-4">
          <Button @click="refreshRecord">刷新业务结果</Button>
          <Button @click="router.push('/clob/V1/MyWorkflow')">
            前往我的流程办理
          </Button>
        </Space>
        <WorkflowBusinessPanel
          :business-reference="{
            businessType: 'workflow-request',
            businessId: selected.id,
            ...selectedScope,
          }"
          :service="workflowRuntimeService"
          :can-retry="canRetry"
          :can-new-round="canNewRound"
          :can-resubmit="canResubmit"
          contract-version="1"
          @error="showError"
          @started="refreshRecord"
          @retried="refreshRecord"
          @round-changed="refreshRecord"
        />
      </template>
    </Drawer>
  </div>
</template>
