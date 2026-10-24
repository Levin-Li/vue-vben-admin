<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';
import type {
  WorkflowInstanceOperation,
  WorkflowInstanceOperationCommand,
} from '@levin/bpm-runtime-ui';

import type { WorkflowManagedInstance } from '../../api/workflow-management-service';

import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import {
  WorkflowInstanceOperations,
  WorkflowProcessDiagram,
  WorkflowStateEvents,
} from '@levin/bpm-runtime-ui';
import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Empty,
  Spin,
  Timeline,
  TimelineItem,
} from 'ant-design-vue';

import { workflowManagementService } from '../../api/workflow-management-service';
import { loadWorkflowRequestOrgTree } from '../../api/workflow-request-service';
import {
  workflowOperationPermissions,
  workflowRuntimeService,
} from '../../api/workflow-runtime-service';
import {
  createWorkflowInstanceCrudConfig,
  workflowInstanceStatusLabel as statusLabel,
} from './config';

// 当前会话和授权组织共同确定管理范围，范围切换时清除全部旧数据。
const userStore = useUserStore();
const { hasPermission } = useRbacAccess();
const selectedOrg = ref<UserOrgSelectorRecord>();
const route = useRoute();
const routeDefinitionId = computed(() =>
  typeof route.query.definitionId === 'string'
    ? route.query.definitionId
    : undefined,
);
watch(
  () => JSON.stringify(userStore.userInfo),
  () => {
    selectedOrg.value = undefined;
  },
  { flush: 'sync' },
);
const isPlatformActor = computed(() => {
  const actor = userStore.userInfo as null | Record<string, unknown>;
  return [
    'platformUser',
    'isPlatformUser',
    'superAdmin',
    'isSuperAdmin',
    'platformAdmin',
    'isPlatformAdmin',
  ].some((key) => actor?.[key] === true);
});
const tenantId = computed(() =>
  isPlatformActor.value
    ? selectedOrg.value?.tenantId
    : userStore.userInfo?.tenantId,
);
const orgId = computed(() =>
  isPlatformActor.value ? selectedOrg.value?.id : undefined,
);
const canQuery = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowManagementService, 'instances'),
  ),
);
const canDetail = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowManagementService, 'instance'),
  ),
);
const operationPermissions = computed(() => ({
  withdraw: false,
  terminate: hasPermission(workflowOperationPermissions.terminate),
  recover: hasPermission(workflowOperationPermissions.recover),
}));
const executeOperation = (
  action: WorkflowInstanceOperation,
  command: WorkflowInstanceOperationCommand,
) => workflowRuntimeService[action](command);
async function operationCompleted() {
  const instanceId = selected.value?.instanceId;
  await crudPage.value?.reload();
  if (instanceId) await viewInstance(instanceId);
}
const scopeKey = computed(() =>
  JSON.stringify([
    userStore.userInfo,
    tenantId.value,
    orgId.value,
    canQuery.value,
    canDetail.value,
  ]),
);
function changeOrganization(
  value: undefined | UserOrgSelectorRecord | UserOrgSelectorRecord[],
) {
  selectedOrg.value = Array.isArray(value) ? value[0] : value;
}

// 查询、表格和游标分页交给标准CRUD；页面仅适配真实管理接口。
const crudPage = ref<InstanceType<typeof CrudPage>>();
const definitions = ref<Array<{ label: string; value: string }>>([]);
const selected = ref<WorkflowManagedInstance>();
const detailLoading = ref(false);
const detailError = ref('');
let listGeneration = 0;
let detailGeneration = 0;
const crudConfig = computed(() =>
  createWorkflowInstanceCrudConfig({
    apiService: { list: listInstances },
    showOrganization: isPlatformActor.value,
    initialDefinitionId: routeDefinitionId.value,
    loadDefinitions: async () => {
      const choices = [...definitions.value];
      const id = routeDefinitionId.value;
      if (id && !choices.some((item) => item.value === id))
        choices.unshift({ value: id, label: '来自流程设计的流程' });
      return choices;
    },
  }),
);

// 时间来自服务端真实轨迹，仅在展示时转为当前浏览器时区。
function timelineTime(value?: string) {
  if (!value) return '';
  const time = new Date(value);
  return Number.isNaN(time.getTime())
    ? value
    : time.toLocaleString('zh-CN', { hour12: false });
}
function clearDetail() {
  ++detailGeneration;
  selected.value = undefined;
  detailError.value = '';
  detailLoading.value = false;
}
async function listInstances(params: Record<string, unknown> = {}) {
  const generation = ++listGeneration;
  const requestedScope = scopeKey.value;
  clearDetail();
  const page = await workflowManagementService.instances({
    tenantId: tenantId.value,
    orgId: orgId.value,
    keyword:
      typeof params.keyword === 'string'
        ? params.keyword.trim() || undefined
        : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
    definitionId:
      typeof params.definitionId === 'string' ? params.definitionId : undefined,
    size: 20,
    cursor: typeof params.cursor === 'string' ? params.cursor : undefined,
  });
  if (generation === listGeneration && requestedScope === scopeKey.value) {
    for (const row of page.items) {
      if (
        row.definitionId &&
        !definitions.value.some((item) => item.value === row.definitionId)
      ) {
        definitions.value.push({
          value: row.definitionId,
          label: row.definitionName || row.definitionId,
        });
      }
    }
  }
  return page;
}
async function viewInstance(instanceId: string) {
  if (!canDetail.value || (!tenantId.value && !isPlatformActor.value)) return;
  clearDetail();
  const generation = detailGeneration;
  detailLoading.value = true;
  try {
    const instance = await workflowManagementService.instance({
      instanceId,
      tenantId: tenantId.value,
      orgId: orgId.value,
    });
    if (generation === detailGeneration) selected.value = instance;
  } catch (error) {
    if (generation === detailGeneration)
      detailError.value =
        error instanceof Error ? error.message : '实例详情加载失败，请重试。';
  } finally {
    if (generation === detailGeneration) detailLoading.value = false;
  }
}
watch(
  [scopeKey, routeDefinitionId],
  () => {
    ++listGeneration;
    definitions.value = [];
    clearDetail();
  },
  { flush: 'sync' },
);
onBeforeUnmount(() => {
  ++listGeneration;
  ++detailGeneration;
});
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <Alert
      v-if="!canQuery"
      type="warning"
      message="当前账号没有查询运行实例的权限。"
    />
    <Alert
      v-else-if="!tenantId && !isPlatformActor"
      type="info"
      message="请先选择授权业务范围。"
    />
    <CrudPage
      v-else
      ref="crudPage"
      :key="scopeKey + (routeDefinitionId || '')"
      :config="crudConfig"
    >
      <template #search-field-orgId>
        <UserOrgSelector
          :model-value="selectedOrg"
          :selectable-types="['org']"
          value-mode="record"
          :multiple="false"
          :show-tenant-nodes="true"
          :load-org-tree="loadWorkflowRequestOrgTree"
          placeholder="全部授权范围"
          @update:selected-records="changeOrganization"
        />
      </template>
      <template v-if="canDetail" #row-actions="{ record }">
        <Button
          v-if="canDetail"
          size="small"
          type="link"
          @click="viewInstance(record.instanceId)"
        >
          查看实例
        </Button>
      </template>
      <template #emptyText>
        <Empty description="当前授权范围和筛选条件下暂无运行实例" />
      </template>
    </CrudPage>
    <!-- 管理详情复用固定版本只读图，只展示事实和轨迹。 -->
    <Drawer
      :open="detailLoading || Boolean(selected) || Boolean(detailError)"
      title="运行实例详情"
      width="min(1080px, 95vw)"
      @close="clearDetail"
    >
      <Spin :spinning="detailLoading">
        <Alert v-if="detailError" type="error" :message="detailError" />
        <div v-if="selected">
          <Descriptions bordered :column="2">
            <DescriptionsItem label="流程">
              {{ selected.definitionName || '—' }}
            </DescriptionsItem>
            <DescriptionsItem label="关联业务">
              {{ selected.businessTitle || '—' }}
            </DescriptionsItem>
            <DescriptionsItem label="业务类型">
              {{ selected.businessType || '—' }}
            </DescriptionsItem>
            <DescriptionsItem label="业务编号">
              {{ selected.businessId || '—' }}
            </DescriptionsItem>
            <DescriptionsItem label="执行状态">
              {{ statusLabel(selected.executionStatus || selected.status) }}
            </DescriptionsItem>
            <DescriptionsItem label="审批结果">
              {{ statusLabel(selected.outcome) }}
            </DescriptionsItem>
            <DescriptionsItem label="业务交付">
              {{ statusLabel(selected.effectStatus) }}
            </DescriptionsItem>
            <DescriptionsItem label="固定版本标识">
              {{ selected.definitionVersionId || '—' }}
            </DescriptionsItem>
          </Descriptions>
          <Alert
            v-if="selected.lastError"
            class="mt-4"
            type="warning"
            :message="selected.lastError"
          />
          <Alert
            v-if="selected.operationBlockedReason"
            class="my-3"
            type="warning"
            :message="selected.operationBlockedReason"
            show-icon
          />
          <WorkflowStateEvents
            :instance-id="selected.instanceId"
            :visit-id="selected.stateVisitId"
            :events="selected.allowedStateEvents"
            :execute="
              (command) => workflowRuntimeService.triggerStateEvent(command)
            "
            @completed="operationCompleted"
            @error="
              detailError =
                $event instanceof Error ? $event.message : '运行操作失败'
            "
          />
          <WorkflowInstanceOperations
            v-if="selected.businessType && selected.businessId"
            :key="scopeKey + selected.instanceId"
            :instance-id="selected.instanceId"
            :business-reference="{
              businessType: selected.businessType,
              businessId: selected.businessId,
              tenantId: selected.tenantId,
              orgId: selected.orgId,
            }"
            :dispatch-id="selected.pendingDispatchId"
            :allowed-actions="selected.allowedOperations"
            :permissions="operationPermissions"
            :execute="executeOperation"
            @completed="operationCompleted"
            @error="
              detailError =
                $event instanceof Error ? $event.message : '运行操作失败'
            "
          />
          <div class="my-4">
            <WorkflowProcessDiagram
              :task="{ ...selected, taskName: selected.definitionName }"
            />
          </div>
          <h3 class="mb-4">实际执行轨迹</h3>
          <Timeline v-if="selected.timeline?.length">
            <TimelineItem
              v-for="(item, index) in selected.timeline"
              :key="item.id || index"
            >
              {{ item.name }}
              <span v-if="item.status"> · {{ statusLabel(item.status) }}</span>
              {{ item.actor }} {{ timelineTime(item.time) }}
              <p v-if="item.comment">{{ item.comment }}</p>
            </TimelineItem>
          </Timeline>
          <Empty v-else description="尚无可展示的执行轨迹" />
          <Alert
            v-if="selected.timelineTruncated"
            type="info"
            message="轨迹较多，当前只展示服务端返回的部分记录。"
          />
        </div>
      </Spin>
    </Drawer>
  </div>
</template>
