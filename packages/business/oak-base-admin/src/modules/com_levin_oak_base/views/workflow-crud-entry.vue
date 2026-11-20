<script setup lang="ts">
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';
import type { WorkflowBusinessType } from '@levin/bpm-designer';
import type {
  WorkflowBusinessReference,
  WorkflowManualStart,
} from '@levin/bpm-runtime-ui';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import { globalOrgContextRevision } from '@levin/admin-framework/framework-commons/app/global-org-context-state';
import { isDataAttrPolicyReady } from '@levin/admin-framework/framework-commons/data-attr-policy';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { WorkflowBusinessPanel } from '@levin/bpm-runtime-ui';
import { Alert, Button, Drawer, message, Select } from 'ant-design-vue';

import { getSessionWorkflowCatalog } from '../api/session-directories';
import { workflowRuntimeService } from '../api/workflow-runtime-service';
import {
  workflowCrudContracts,
  workflowCrudReference,
} from './workflow-crud-resource';

// 工作流适配只存在于业务包，公共 CRUD 与运行组件都不反向依赖业务模块。
const props = defineProps<{ config: CrudPageConfig }>();
const userStore = useUserStore();
const accessStore = useAccessStore();
const { hasPermission } = useRbacAccess();
const permits = (method: string) =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, method));
const canEligibility = computed(() => permits('eligibility'));
const canHistory = computed(() => permits('history'));
const ready = computed(
  () => Boolean(accessStore.accessToken) && isDataAttrPolicyReady(),
);
const catalog = ref<WorkflowBusinessType[]>([]);
const stateObjects = ref<string[]>([]);
const stateObject = computed(() => {
  const resource = /^\/?([A-Z][A-Za-z0-9]*)\/?$/.exec(
    props.config.apiBase,
  )?.[1];
  return stateObjects.value.find((item) => item.split('.').pop() === resource);
});
const statePage = ref(1);
const stateMore = ref(false);
const stateLoading = ref(false);
const stateChoices = ref<WorkflowManualStart[]>([]);
const stateSelected = ref<string>();
const stateChoice = computed(() =>
  stateChoices.value.find((item) => item.purposeKey === stateSelected.value),
);
const contracts = computed(() =>
  workflowCrudContracts(props.config.apiBase, catalog.value),
);
const selectedContract = ref<string>();
const selected = ref<WorkflowBusinessReference>();
let reload: (() => unknown) | undefined;
let generation = 0;
const contract = computed(() =>
  contracts.value.find(
    (item) => String(item.contractVersion) === selectedContract.value,
  ),
);
const reference = computed(() =>
  selected.value && contract.value
    ? {
        ...selected.value,
        contractVersion: String(contract.value.contractVersion),
      }
    : undefined,
);
const options = computed(() =>
  contracts.value.map((item) => ({
    value: String(item.contractVersion),
    label: `${item.title} · ${item.contractVersion}`,
  })),
);

function close() {
  selected.value = undefined;
  selectedContract.value = undefined;
  reload = undefined;
  stateSelected.value = undefined;
  stateChoices.value = [];
  stateMore.value = false;
}

// 角色、账号或资源变化立即卸载旧面板；迟到目录响应不能恢复旧范围。
watch(
  () =>
    JSON.stringify([
      props.config.apiBase,
      userStore.userInfo,
      accessStore.accessCodes,
      globalOrgContextRevision.value,
      ready.value,
      permits('catalog'),
      canEligibility.value,
      canHistory.value,
    ]),
  async () => {
    const request = ++generation;
    close();
    catalog.value = [];
    stateObjects.value = [];
    if (
      !ready.value ||
      (!canEligibility.value && !canHistory.value) ||
      props.config.apiBase === '/WorkflowRequest'
    )
      return;
    if (permits('catalog')) {
      try {
        const result = await getSessionWorkflowCatalog();
        if (request === generation) catalog.value = result;
      } catch {
        // 工作流未安装或目录无权时，普通业务 CRUD 继续可用。
      }
    }
    if (permits('boundBusinessTypes')) {
      try {
        const result = await workflowRuntimeService.boundBusinessTypes();
        if (request === generation) stateObjects.value = result;
      } catch {
        // 目录无权或不可用时不展示状态流程入口。
      }
    }
  },
  { immediate: true, flush: 'sync' },
);

function rowReference(record: Record<string, unknown>) {
  const current = contracts.value[0];
  const object = stateObject.value;
  if (
    (!current && !object) ||
    !ready.value ||
    (!canEligibility.value && !canHistory.value)
  )
    return undefined;
  // 后端在读取资格、启动与历史时独立重验当前业务读取权；前端还须具备原页面详情权。
  if (
    !props.config.apiService?.retrieve ||
    !hasPermission(
      buildApiMethodPermissions(props.config.apiService, 'retrieve'),
    )
  )
    return undefined;
  return workflowCrudReference(
    record,
    current?.defaultBinding?.identityField || props.config.recordKey || 'id',
    current?.businessType || object!,
    (userStore.userInfo ?? {}) as Record<string, unknown>,
  );
}
function open(record: Record<string, unknown>, refresh: () => unknown) {
  const target = rowReference(record);
  if (!target) return;
  close();
  selected.value = target;
  selectedContract.value = contracts.value[0]
    ? String(contracts.value[0].contractVersion)
    : undefined;
  reload = refresh;
  if (stateObject.value && permits('manualStarts')) void loadStatePage(1);
}
async function loadStatePage(pageIndex: number) {
  const current = selected.value;
  const object = stateObject.value;
  if (!current || !object) return;
  stateLoading.value = true;
  stateSelected.value = undefined;
  try {
    const page = await workflowRuntimeService.manualStarts({
      tenantId: current.tenantId,
      pageIndex,
      pageSize: 20,
    });
    if (selected.value !== current) return;
    statePage.value = pageIndex;
    stateMore.value = page.hasMore;
    stateChoices.value = page.items.filter(
      (item) =>
        item.businessType === object &&
        ['state-graph-v4', 'task-graph-v5'].includes(item.contractVersion),
    );
  } catch (error) {
    if (selected.value === current) showError(error);
  } finally {
    if (selected.value === current) stateLoading.value = false;
  }
}
async function changed() {
  await reload?.();
}
function showError(error: unknown) {
  message.error(
    error instanceof Error ? error.message : '业务流程加载失败，请重试。',
  );
}
onBeforeUnmount(() => {
  ++generation;
});
</script>

<template>
  <slot
    :supported="contracts.length > 0 || !!stateObject"
    :can-open="rowReference"
    :open="open"
  ></slot>
  <Drawer
    :open="!!selected"
    title="业务流程与历史"
    width="min(900px, 95vw)"
    @close="close"
  >
    <template v-if="selected">
      <Alert
        class="mb-4"
        type="info"
        message="流程资格和业务读取权限由服务端实时校验。配置审批人不会自动授予业务数据权限。"
      />
      <Select
        v-if="options.length > 1"
        v-model:value="selectedContract"
        :options="options"
        aria-label="业务流程契约"
        class="mb-4 w-full"
      />
      <template v-if="stateObject && permits('manualStarts')">
        <p>选择此记录适用的已发布流程（第 {{ statePage }} 页）</p>
        <Select
          v-model:value="stateSelected"
          class="mb-4 w-full"
          show-search
          allow-clear
          :loading="stateLoading"
          placeholder="选择流程"
          :options="
            stateChoices.map((item) => ({
              value: item.purposeKey,
              label: item.definitionName,
            }))
          "
        />
        <Button
          :disabled="statePage <= 1 || stateLoading"
          @click="loadStatePage(statePage - 1)"
        >
          上一页
        </Button>
        <Button
          :disabled="!stateMore || stateLoading"
          @click="loadStatePage(statePage + 1)"
        >
          下一页
        </Button>
        <WorkflowBusinessPanel
          v-if="stateChoice"
          :key="stateChoice.purposeKey"
          :business-reference="{
            ...selected,
            businessType: stateChoice.businessType,
            contractVersion: stateChoice.contractVersion,
          }"
          :contract-version="stateChoice.contractVersion"
          :purpose-key="stateChoice.purposeKey"
          :service="workflowRuntimeService"
          :ready="ready"
          :show-history="canHistory"
          :show-eligibility="canEligibility"
          :can-start="permits('start') && canEligibility"
          @error="showError"
          @started="changed"
        />
      </template>
      <WorkflowBusinessPanel
        v-if="reference"
        :key="`${reference.tenantId}:${reference.orgId}:${reference.businessId}:${selectedContract}`"
        :business-reference="reference"
        :contract-version="selectedContract"
        :service="workflowRuntimeService"
        :ready="ready"
        :show-eligibility="canEligibility"
        :show-history="canHistory"
        :can-start="permits('start') && canEligibility"
        :can-retry="permits('retry')"
        :can-new-round="permits('newRound') && permits('roundState')"
        :can-resubmit="permits('resubmit') && permits('roundState')"
        @error="showError"
        @started="changed"
        @retried="changed"
        @round-changed="changed"
      />
    </template>
  </Drawer>
</template>
