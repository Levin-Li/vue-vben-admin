<script lang="ts" setup>
import type {
  WorkflowBusinessType,
  WorkflowDefinitionVersion,
  WorkflowDesignerOptions,
  WorkflowSimulationHistory,
} from './types';
import type { WorkflowTreeVersion } from './workflow-tree-version';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert as AAlert,
  Button as AButton,
  Card as ACard,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Popconfirm as APopconfirm,
  Space as ASpace,
} from 'ant-design-vue';

import { definitionFingerprint } from './definition-model';
import { WorkflowDesignerService } from './workflow-designer-service';
import WorkflowDesigner from './workflow-designer.vue';
import { workflowLifecycleLabels } from './workflow-labels';
import { projectDraftV3ToV2 } from './workflow-tree-version';

const props = withDefaults(
  defineProps<{
    definition: WorkflowTreeVersion;
    options?: WorkflowDesignerOptions;
    permissions?: {
      deleteSimulation?: boolean;
      publish?: boolean;
      save?: boolean;
      simulate?: boolean;
      viewSimulation?: boolean;
    };
    service?: WorkflowDesignerService;
    version: WorkflowDefinitionVersion;
  }>(),
  { options: () => ({}), permissions: () => ({}), service: undefined },
);
const emit = defineEmits<{
  refreshed: [value: WorkflowDefinitionVersion];
  'update:definition': [value: WorkflowTreeVersion];
}>();
const service = computed(() => props.service ?? new WorkflowDesignerService());
const valid = ref(false);
const validationMessages = ref<string[]>([]);
const saving = ref(false);
const actionMessage = ref<string>();
const actionError = ref<string>();
const businessTypes = ref<WorkflowBusinessType[]>([]);
const catalogLoading = ref(false);
const catalogError = ref<string>();
const history = ref<WorkflowSimulationHistory[]>([]);
const historyPage = ref(1);
const historyTotal = ref(0);
const selectedRun = ref<WorkflowSimulationHistory>();
const historyError = ref<string>();
const historyLoading = ref(false);
let historyRequest = 0;

async function loadHistory(pageIndex = 1) {
  const request = ++historyRequest;
  history.value = [];
  selectedRun.value = undefined;
  historyError.value = undefined;
  if (props.permissions?.viewSimulation === false) return;
  historyLoading.value = true;
  try {
    const result = await service.value.simulationRuns(
      props.version.id,
      pageIndex,
    );
    if (request !== historyRequest) return;
    history.value = result.items;
    historyTotal.value = result.totals;
    historyPage.value = pageIndex;
  } catch (error) {
    if (request === historyRequest)
      historyError.value =
        error instanceof Error ? error.message : '模拟历史加载失败';
  } finally {
    if (request === historyRequest) historyLoading.value = false;
  }
}

async function viewRun(runId: string) {
  const request = historyRequest;
  historyError.value = undefined;
  try {
    const result = await service.value.simulationRun(props.version.id, runId);
    if (request === historyRequest) selectedRun.value = result;
  } catch (error) {
    if (request === historyRequest)
      historyError.value =
        error instanceof Error ? error.message : '模拟报告加载失败';
  }
}

async function deleteRun(runId: string) {
  historyError.value = undefined;
  try {
    await service.value.deleteSimulationRun(props.version.id, runId);
    await loadHistory(historyPage.value);
    // 删除当前证明后，刷新版本门禁；旧摘要不再允许发布。
    if (props.version.simulationReport?.runId === runId)
      emit('refreshed', {
        ...props.version,
        simulationReport: undefined,
      });
  } catch (error) {
    historyError.value =
      error instanceof Error ? error.message : '删除模拟报告失败';
  }
}

watch(
  () => [props.version.id, props.permissions?.viewSimulation, service.value],
  () => void loadHistory(),
  { immediate: true },
);
const versionError = computed(() => {
  try {
    if (
      props.definition.schemaVersion !== 3 ||
      (props.version.lowflowDefinition &&
        props.version.lowflowDefinition.schemaVersion !== 3)
    )
      throw new Error('只接受 schemaVersion=3 的流程定义');
    projectDraftV3ToV2(props.definition);
    if (props.version.lowflowDefinition)
      projectDraftV3ToV2(props.version.lowflowDefinition);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : '版本格式不受支持';
  }
});
let catalogRequest = 0;
const resolvedOptions = computed(() => ({
  ...props.options,
  businessTypes: props.options.businessTypes ?? businessTypes.value,
}));
const catalogReady = computed(
  () => !catalogLoading.value && !catalogError.value,
);
const dirty = computed(() => {
  return (
    definitionFingerprint(props.definition) !==
    definitionFingerprint(props.version.lowflowDefinition)
  );
});
const canEdit = computed(
  () =>
    !versionError.value &&
    ['Draft', 'Testing'].includes(props.version.lifecycle) &&
    props.permissions?.save !== false,
);
const canSimulate = computed(
  () =>
    ['Draft', 'Testing'].includes(props.version.lifecycle) &&
    props.permissions?.simulate !== false &&
    catalogReady.value &&
    !versionError.value &&
    valid.value &&
    dirty.value === false,
);
const canPublish = computed(
  () =>
    props.version.lifecycle === 'Testing' &&
    props.permissions?.publish !== false &&
    catalogReady.value &&
    !versionError.value &&
    props.version.simulationReport?.successful &&
    !dirty.value &&
    valid.value,
);

// 主界面只展示覆盖数量；原始节点键留在实施者展开的诊断资料里。
function coverageCount(values?: null | string[]): string {
  return values === null || values === undefined
    ? '未记录'
    : `${values.length} 个`;
}

function simulationStatusLabel(status: WorkflowSimulationHistory['status']) {
  return {
    Deleted: '已删除',
    Failed: '未通过',
    Passed: '通过',
    Running: '运行中',
  }[status];
}

// 显式目录加载失败保留草稿，阻止未经目录验证的模拟和发布。
async function loadCatalog() {
  const request = ++catalogRequest;
  // 目录来源改变即撤销旧候选，避免请求待决或失败时继续展示前一来源的授权能力。
  businessTypes.value = [];
  if (props.options.businessTypes) {
    catalogLoading.value = false;
    catalogError.value = undefined;
    return;
  }
  catalogLoading.value = true;
  catalogError.value = undefined;
  try {
    const values = await service.value.listBusinessTypes();
    if (request === catalogRequest) businessTypes.value = values;
  } catch (error) {
    if (request === catalogRequest)
      catalogError.value =
        error instanceof Error ? error.message : '业务能力目录加载失败';
  } finally {
    if (request === catalogRequest) catalogLoading.value = false;
  }
}
watch(
  () => [props.options.businessTypes, service.value],
  () => {
    void loadCatalog();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  catalogRequest++;
  historyRequest++;
});

async function run(
  action: () => Promise<WorkflowDefinitionVersion>,
  message: string,
) {
  if (saving.value) return;
  saving.value = true;
  actionMessage.value = undefined;
  actionError.value = undefined;
  try {
    const value = await action();
    if (!value.lowflowDefinition)
      throw new Error('服务端未返回固定版本的 v3 流程树。');
    if (value.lowflowDefinition.schemaVersion !== 3)
      throw new Error('只接受 schemaVersion=3 的流程定义');
    projectDraftV3ToV2(value.lowflowDefinition);
    emit('refreshed', value);
    emit('update:definition', value.lowflowDefinition);
    void loadHistory();
    actionMessage.value = message;
  } catch (error) {
    // 失败只呈现错误，不关闭工作台、不清空用户正在编辑的配置。
    actionError.value =
      error instanceof Error ? error.message : '操作失败，请检查配置后重试。';
  } finally {
    saving.value = false;
  }
}
function save() {
  if (canEdit.value && dirty.value && !versionError.value)
    return run(
      () =>
        service.value.saveDraft(
          props.version.id,
          props.definition,
          props.version.optimisticLock,
        ),
      '草稿已保存；任何修改都会使原模拟结果失效。',
    );
}
function simulate() {
  if (canSimulate.value)
    return run(
      () => service.value.startSimulation(props.version.id),
      '模拟已执行，请查看服务端覆盖报告。',
    );
}
function publish() {
  if (canPublish.value)
    return run(
      () => service.value.publishAfterSimulation(props.version.id),
      '版本已发布。',
    );
}
</script>

<template>
  <section class="levin-workflow-definition-workbench">
    <AAlert
      v-if="versionError"
      class="mb-4"
      :message="`版本格式不受支持：${versionError}`"
      show-icon
      type="error"
    />
    <AAlert
      v-if="actionMessage"
      class="mb-4"
      :message="actionMessage"
      show-icon
      type="success"
    />
    <AAlert
      v-if="actionError"
      class="mb-4"
      :message="actionError"
      show-icon
      type="error"
    />
    <AAlert
      v-if="catalogError"
      class="mb-4"
      :message="catalogError"
      show-icon
      type="error"
    >
      <template #description>
        <AButton :loading="catalogLoading" @click="loadCatalog">
          重新加载业务对象资料
        </AButton>
      </template>
    </AAlert>
    <AAlert
      v-if="!canEdit"
      class="mb-4"
      :message="`当前版本：${workflowLifecycleLabels[version.lifecycle]}`"
      show-icon
      type="info"
    >
      <template #description>
        此版本暂不能修改。如需调整已发布流程，请新建草稿并完成检查后发布。
      </template>
    </AAlert>
    <WorkflowDesigner
      v-if="!versionError"
      :model-value="definition"
      :options="resolvedOptions"
      :readonly="!canEdit || saving"
      @update:model-value="emit('update:definition', $event)"
      @validate="
        (isValid, messages) => {
          valid = isValid;
          validationMessages = messages;
        }
      "
    />
    <ACard class="mt-4" size="small" title="检查与发布">
      <AAlert
        v-if="validationMessages.length > 0"
        class="mb-3"
        :message="validationMessages.join('；')"
        type="warning"
      />
      <p v-if="canEdit && dirty" class="mb-3">
        请先保存草稿，再执行流程检查。修改设置后需要重新检查。
      </p>
      <p v-else-if="canEdit && !valid" class="mb-3">
        请完善上方提示的设置，再执行流程检查。
      </p>
      <p
        v-else-if="canEdit && !version.simulationReport?.successful"
        class="mb-3"
      >
        请执行流程检查；检查通过后才能发布。
      </p>
      <ASpace wrap>
        <AButton
          v-if="permissions?.save !== false"
          :disabled="!canEdit || !dirty"
          :loading="saving"
          @click="save"
        >
          保存草稿
        </AButton>
        <AButton
          v-if="permissions?.simulate !== false"
          :disabled="!canSimulate || !!catalogError || catalogLoading"
          :loading="saving"
          type="primary"
          @click="simulate"
        >
          执行检查
        </AButton>
        <APopconfirm
          v-if="permissions?.publish !== false"
          title="确认发布通过模拟测试的版本？"
          :disabled="!canPublish || saving"
          @confirm="publish"
        >
          <AButton
            :disabled="!canPublish || !!catalogError || catalogLoading"
            :loading="saving"
            type="primary"
          >
            发布
          </AButton>
        </APopconfirm>
      </ASpace>
      <ADescriptions
        v-if="version.simulationReport"
        class="mt-4"
        :column="1"
        size="small"
      >
        <ADescriptionsItem label="检查结果">
          {{ version.simulationReport.successful ? '通过' : '未通过' }}
        </ADescriptionsItem>
        <ADescriptionsItem label="已检查审批步骤">
          {{ coverageCount(version.simulationReport.coveredTaskKeys) }}
        </ADescriptionsItem>
        <ADescriptionsItem label="已检查路线">
          {{ coverageCount(version.simulationReport.coveredBranches) }}
        </ADescriptionsItem>
        <ADescriptionsItem label="待检查路线">
          {{ coverageCount(version.simulationReport.uncoveredBranches) }}
        </ADescriptionsItem>
        <ADescriptionsItem v-if="version.simulationReport.message" label="报告">
          {{ version.simulationReport.message }}
        </ADescriptionsItem>
      </ADescriptions>
      <div v-if="permissions?.viewSimulation !== false" class="mt-4">
        <h3>检查记录</h3>
        <AAlert
          v-if="historyError"
          :message="historyError"
          type="error"
          show-icon
        />
        <p v-if="historyLoading">正在加载模拟历史…</p>
        <p v-else-if="history.length === 0">暂无检查记录</p>
        <div
          v-for="item in history"
          :key="item.id"
          class="mb-2 flex items-center gap-2"
        >
          <span>{{ item.finishedTime || item.startedTime || '—' }}</span>
          <span>{{ simulationStatusLabel(item.status) }}</span>
          <AButton size="small" @click="viewRun(item.id)">
            查看检查结果
          </AButton>
          <APopconfirm
            v-if="
              permissions?.deleteSimulation !== false &&
              item.status !== 'Deleted'
            "
            title="删除这条模拟报告及轨迹？删除当前证明后必须重新模拟才能发布。"
            @confirm="deleteRun(item.id)"
          >
            <AButton size="small" danger>删除</AButton>
          </APopconfirm>
        </div>
        <ASpace v-if="historyTotal > 10">
          <AButton
            :disabled="historyPage <= 1"
            @click="loadHistory(historyPage - 1)"
          >
            上一页
          </AButton>
          <span>第 {{ historyPage }} 页，共 {{ historyTotal }} 条</span>
          <AButton
            :disabled="historyPage * 10 >= historyTotal"
            @click="loadHistory(historyPage + 1)"
          >
            下一页
          </AButton>
        </ASpace>
        <div v-if="selectedRun" class="mt-3">
          <h4>流程检查结果</h4>
          <p>{{ simulationStatusLabel(selectedRun.status) }}</p>
          <p v-if="selectedRun.failureMessage">
            {{ selectedRun.failureMessage }}
          </p>
          <details>
            <summary>实施者查看原始执行轨迹</summary>
            <pre class="max-h-80 overflow-auto whitespace-pre-wrap">{{
              JSON.stringify(
                {
                  coverageReport: selectedRun.coverageReport,
                  executionTrace: selectedRun.executionTrace,
                },
                null,
                2,
              )
            }}</pre>
          </details>
        </div>
      </div>
    </ACard>
  </section>
</template>
