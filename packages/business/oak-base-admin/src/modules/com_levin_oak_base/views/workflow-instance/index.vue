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
import {
  WorkflowInstanceOperations,
  WorkflowProcessDiagram,
} from '@levin/bpm-runtime-ui';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Timeline,
  TimelineItem,
} from 'ant-design-vue';

import { workflowManagementService } from '../../api/workflow-management-service';
import { loadWorkflowRequestOrgTree } from '../../api/workflow-request-service';
import {
  workflowOperationPermissions,
  workflowRuntimeService,
} from '../../api/workflow-runtime-service';

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
  await loadPage();
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

// 查询只发送显式筛选与游标，不推测未授权总数。
const keyword = ref('');
const status = ref<string>();
const definitionId = ref<string>();
const definitions = ref<Array<{ label: string; value: string }>>([]);
const rows = ref<WorkflowManagedInstance[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const cursors = ref<Array<string | undefined>>([undefined]);
const pageIndex = ref(0);
const nextCursor = ref<string>();
const hasMore = ref(false);
const selected = ref<WorkflowManagedInstance>();
const detailLoading = ref(false);
const detailError = ref('');
let listGeneration = 0;
let lastFilterKey = '';
let detailGeneration = 0;
const statusOptions = [
  { label: '运行中', value: 'Running' },
  { label: '已结束', value: 'Completed' },
  { label: '等待结果交付', value: 'PendingEffects' },
  { label: '已挂起', value: 'Suspended' },
];
const labels: Record<string, string> = {
  Running: '运行中',
  Completed: '已结束',
  Cancelled: '已取消',
  Suspended: '已挂起',
  PendingEffects: '等待结果交付',
  Approved: '通过',
  Rejected: '拒绝',
  Withdrawn: '已撤回',
  Terminated: '已终止',
  Pending: '待处理',
  Applied: '已应用',
  Failed: '处理失败',
};
const statusLabel = (value?: string) =>
  value ? (labels[value] ?? value) : '—';

// 时间来自服务端真实轨迹，仅在展示时转为当前浏览器时区。
function timelineTime(value?: string) {
  if (!value) return '';
  const time = new Date(value);
  return Number.isNaN(time.getTime())
    ? value
    : time.toLocaleString('zh-CN', { hour12: false });
}
const columns = [
  { title: '流程', key: 'definitionName', dataIndex: 'definitionName' },
  { title: '关联业务', key: 'businessTitle', dataIndex: 'businessTitle' },
  { title: '执行状态', key: 'executionStatus' },
  { title: '审批结果', key: 'outcome' },
  { title: '业务交付', key: 'effectStatus' },
  { title: '操作', key: 'action' },
];

function clearDetail() {
  ++detailGeneration;
  selected.value = undefined;
  detailError.value = '';
  detailLoading.value = false;
}
async function loadPage(reset = false) {
  const generation = ++listGeneration;
  clearDetail();
  rows.value = [];
  errorMessage.value = '';
  loading.value = false;
  // 修改筛选后刷新或翻页也必须回到首游标，不能复用旧筛选的游标。
  const filterKey = JSON.stringify([
    keyword.value.trim(),
    status.value,
    definitionId.value,
  ]);
  if (reset || filterKey !== lastFilterKey) {
    lastFilterKey = filterKey;
    pageIndex.value = 0;
    cursors.value = [undefined];
  }
  if ((!tenantId.value && !isPlatformActor.value) || !canQuery.value) return;
  loading.value = true;
  try {
    const page = await workflowManagementService.instances({
      tenantId: tenantId.value,
      orgId: orgId.value,
      keyword: keyword.value.trim() || undefined,
      status: status.value,
      definitionId: definitionId.value,
      size: 20,
      cursor: cursors.value[pageIndex.value],
    });
    if (generation !== listGeneration) return;
    rows.value = page.items;
    hasMore.value = page.hasMore;
    nextCursor.value = page.nextCursor;
    for (const row of page.items) {
      if (
        row.definitionId &&
        !definitions.value.some((option) => option.value === row.definitionId)
      ) {
        definitions.value.push({
          value: row.definitionId,
          label: row.definitionName || row.definitionId,
        });
      }
    }
  } catch (error) {
    if (generation !== listGeneration) return;
    hasMore.value = false;
    nextCursor.value = undefined;
    errorMessage.value =
      error instanceof Error ? error.message : '运行实例加载失败，请重试。';
  } finally {
    if (generation === listGeneration) loading.value = false;
  }
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
function nextPage() {
  if (loading.value || !hasMore.value || !nextCursor.value) return;
  cursors.value[pageIndex.value + 1] = nextCursor.value;
  pageIndex.value += 1;
  void loadPage();
}
function previousPage() {
  if (loading.value || pageIndex.value === 0) return;
  pageIndex.value -= 1;
  void loadPage();
}
watch(
  [scopeKey, routeDefinitionId],
  () => {
    keyword.value = '';
    status.value = undefined;
    definitionId.value = routeDefinitionId.value;
    definitions.value = [];
    hasMore.value = false;
    nextCursor.value = undefined;
    void loadPage(true);
  },
  { immediate: true, flush: 'sync' },
);
onBeforeUnmount(() => {
  ++listGeneration;
  ++detailGeneration;
});
</script>

<template>
  <div class="space-y-4">
    <!-- 平台用户从当前授权组织树选择业务范围。 -->
    <Card v-if="isPlatformActor" title="业务范围" size="small">
      <UserOrgSelector
        :model-value="selectedOrg"
        :selectable-types="['org']"
        value-mode="record"
        :multiple="false"
        :show-tenant-nodes="true"
        :load-org-tree="loadWorkflowRequestOrgTree"
        placeholder="全部授权范围，可选择组织收窄查询"
        @update:selected-records="changeOrganization"
      />
    </Card>
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
    <Card v-else title="工作流实例管理">
      <!-- 查询、刷新和游标翻页均重新执行服务端数据范围校验。 -->
      <Space wrap class="mb-4">
        <Input
          v-model:value="keyword"
          aria-label="流程或业务关键词"
          placeholder="流程或业务关键词"
          allow-clear
          @press-enter="loadPage(true)"
        />
        <Select
          v-model:value="status"
          aria-label="执行状态"
          placeholder="全部执行状态"
          allow-clear
          :options="statusOptions"
          class="min-w-40"
        />
        <Select
          v-model:value="definitionId"
          aria-label="筛选流程"
          placeholder="已浏览流程"
          allow-clear
          show-search
          option-filter-prop="label"
          :options="definitions"
          class="min-w-48"
        />
        <Button type="primary" :loading="loading" @click="loadPage(true)">
          查询
        </Button>
        <Button :disabled="loading" @click="loadPage()">刷新</Button>
      </Space>
      <Alert
        v-if="errorMessage"
        class="mb-4"
        type="error"
        :message="errorMessage"
      />
      <Table
        :columns="columns"
        :data-source="rows"
        row-key="instanceId"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 800 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'executionStatus'">
            {{ statusLabel(record.executionStatus || record.status) }}
          </template>
          <template v-else-if="column.key === 'outcome'">
            {{ statusLabel(record.outcome) }}
          </template>
          <template v-else-if="column.key === 'effectStatus'">
            {{ statusLabel(record.effectStatus) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <Button
              v-if="canDetail"
              type="link"
              @click="viewInstance(record.instanceId)"
            >
              查看实例
            </Button>
          </template>
        </template>
        <template #emptyText>
          <Empty description="当前授权范围和筛选条件下暂无运行实例" />
        </template>
      </Table>
      <Space class="mt-4">
        <Button :disabled="loading || pageIndex === 0" @click="previousPage">
          上一页
        </Button>
        <span>第 {{ pageIndex + 1 }} 页 · 本页 {{ rows.length }} 条</span>
        <Button
          :disabled="loading || !hasMore || !nextCursor"
          @click="nextPage"
        >
          下一页
        </Button>
      </Space>
    </Card>
    <!-- 管理详情复用固定版本只读图，只展示事实和轨迹。 -->
    <Spin :spinning="detailLoading">
      <Alert v-if="detailError" type="error" :message="detailError" />
      <Card v-if="selected" title="运行实例详情">
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
      </Card>
    </Spin>
  </div>
</template>
