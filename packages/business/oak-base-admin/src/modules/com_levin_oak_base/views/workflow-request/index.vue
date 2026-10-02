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

import { workflowDefinitionVersionService } from '../../api/workflow-definition-version-service';
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
const canReadEligibility = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowRuntimeService, 'eligibility'),
  ),
);
const canStart = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowRuntimeService, 'start')),
);
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
const globalPanel = ref<InstanceType<typeof WorkflowBusinessPanel>>();
const versionPanel = ref<InstanceType<typeof WorkflowBusinessPanel>>();
const contractVersions = ref<string[]>([]);
const selectedContractVersion = ref<string>();
const catalogLoading = ref(false);
const catalogError = ref(false);
let catalogRequestVersion = 0;
let reloadList: (() => Promise<unknown> | unknown) | undefined;

// 能力目录按当前所选租户读取；其内容只控制入口展示，操作权限仍由服务端复核。
async function loadContractVersions() {
  const tenantId = selectedScope.value?.tenantId;
  const businessId = selected.value?.id;
  if (!tenantId || !businessId) return;
  const version = ++catalogRequestVersion;
  catalogLoading.value = true;
  catalogError.value = false;
  contractVersions.value = [];
  try {
    const catalog =
      await workflowDefinitionVersionService.listBusinessTypes(tenantId);
    if (version !== catalogRequestVersion || selected.value?.id !== businessId)
      return;
    contractVersions.value = [
      ...new Set(
        catalog
          .filter((item) => item.businessType === 'workflow-request')
          .map((item) => String(item.contractVersion)),
      ),
    ].toSorted((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    );
    const currentVersion = selectedContractVersion.value;
    if (!currentVersion || !contractVersions.value.includes(currentVersion)) {
      selectedContractVersion.value = contractVersions.value.includes('1')
        ? '1'
        : contractVersions.value[0];
    }
  } catch (error) {
    if (version !== catalogRequestVersion) return;
    catalogError.value = true;
    selectedContractVersion.value = undefined;
    showError(error);
  } finally {
    if (version === catalogRequestVersion) catalogLoading.value = false;
  }
}

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
    await loadContractVersions();
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

// 两个面板各自刷新自身；动作成功时补刷新另一面板的资格或历史。
async function afterGlobalStart() {
  await refreshRecord();
  await versionPanel.value?.refresh?.();
}

async function afterVersionAction() {
  await refreshRecord();
  await globalPanel.value?.refresh?.();
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
    catalogRequestVersion++;
    contractVersions.value = [];
    selectedContractVersion.value = undefined;
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
          <Button :loading="catalogLoading" @click="loadContractVersions">
            刷新契约版本
          </Button>
          <Button @click="router.push('/clob/V1/MyWorkflow')">
            前往我的流程办理
          </Button>
        </Space>
        <!-- 只从当前租户授权目录选择契约；一次仅展示一个版本的轮次和历史。 -->
        <Alert
          v-if="catalogError"
          type="error"
          show-icon
          message="契约版本加载失败，请刷新后重试。"
          class="mb-4"
        />
        <Alert
          v-else-if="!catalogLoading && contractVersions.length === 0"
          type="info"
          show-icon
          message="当前没有可用的申请流程契约版本。"
          class="mb-4"
        />
        <Space v-if="contractVersions.length > 1" class="mb-4">
          <Button
            v-for="version in contractVersions"
            :key="version"
            :type="selectedContractVersion === version ? 'primary' : 'default'"
            @click="selectedContractVersion = version"
          >
            申请契约 @{{ version }}
          </Button>
        </Space>
        <WorkflowBusinessPanel
          ref="versionPanel"
          v-if="selectedContractVersion && !catalogLoading"
          :key="selectedContractVersion"
          :business-reference="{
            businessType: 'workflow-request',
            businessId: selected.id,
            ...selectedScope,
          }"
          :service="workflowRuntimeService"
          :show-eligibility="false"
          :can-retry="canRetry"
          :can-new-round="canNewRound"
          :can-resubmit="canResubmit"
          :contract-version="selectedContractVersion"
          @error="showError"
          @started="afterVersionAction"
          @retried="afterVersionAction"
          @round-changed="afterVersionAction"
        />
        <WorkflowBusinessPanel
          ref="globalPanel"
          :show-eligibility="canReadEligibility"
          :can-start="canStart"
          :key="selected.id"
          class="mt-4"
          :business-reference="{
            businessType: 'workflow-request',
            businessId: selected.id,
            ...selectedScope,
          }"
          :service="workflowRuntimeService"
          :show-history="false"
          @error="showError"
          @started="afterGlobalStart"
        />
      </template>
    </Drawer>
  </div>
</template>
