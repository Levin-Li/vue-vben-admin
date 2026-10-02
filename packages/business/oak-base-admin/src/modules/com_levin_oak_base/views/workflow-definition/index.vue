<script setup lang="ts">
import type {
  WorkflowBusinessType,
  WorkflowDefinitionVersion,
  WorkflowDesignerOptions,
  WorkflowTreeVersion,
} from '@levin/bpm-designer';

import type { WorkflowDefinitionRecord } from '../../api/workflow-definition-service';

import { computed, onMounted, reactive, ref, toRaw } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  createTreeDefinition,
  WorkflowDefinitionWorkbench,
} from '@levin/bpm-designer';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Spin,
} from 'ant-design-vue';

import { loadWorkflowCandidates } from '../../api/workflow-candidate-service';
import { workflowDefinitionService } from '../../api/workflow-definition-service';
import { workflowDefinitionVersionService } from '../../api/workflow-definition-version-service';
import { workflowRuntimeService } from '../../api/workflow-runtime-service';
import { lifecycleLabels, pageMeta } from './config';

// 稳定定义与版本分别选择，已发布版本只读；切换时保护尚未保存的设计。
const definitions = ref<WorkflowDefinitionRecord[]>([]);
const versions = ref<WorkflowDefinitionVersion[]>([]);
const publishedVersions = ref<WorkflowDefinitionVersion[]>([]);
const currentDefinitionId = ref<string>();
const currentVersion = ref<WorkflowDefinitionVersion>();
const design = ref<WorkflowTreeVersion>(createTreeDefinition());
const businessTypes = ref<WorkflowBusinessType[]>([]);
const candidates = ref<Pick<WorkflowDesignerOptions, 'groups' | 'users'>>({
  users: [],
  groups: [],
});
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const candidateKeyword = ref('');
let candidateRequest = 0;
let selectionRequest = 0;
const createOpen = ref(false);
const { hasPermission } = useRbacAccess();
const canCreate = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowDefinitionService, 'create')),
);
const canCreateVersion = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowDefinitionVersionService, 'create'),
  ),
);
const designPermissions = computed(() => ({
  viewSimulation:
    hasPermission(
      buildApiMethodPermissions(
        workflowDefinitionVersionService,
        'simulationRuns',
      ),
    ) &&
    hasPermission(
      buildApiMethodPermissions(
        workflowDefinitionVersionService,
        'simulationRun',
      ),
    ),
  deleteSimulation: hasPermission(
    buildApiMethodPermissions(
      workflowDefinitionVersionService,
      'deleteSimulationRun',
    ),
  ),
  save: hasPermission(
    buildApiMethodPermissions(workflowDefinitionVersionService, 'saveDraft'),
  ),
  simulate: hasPermission(
    buildApiMethodPermissions(
      workflowDefinitionVersionService,
      'startSimulation',
    ),
  ),
  publish: hasPermission(
    buildApiMethodPermissions(
      workflowDefinitionVersionService,
      'publishAfterSimulation',
    ),
  ),
}));
const form = reactive({
  name: '',
  processKey: '',
  businessType: '',
});
const blankForm = () => ({
  name: '',
  processKey: '',
  businessType: '',
});
const selectedDefinition = computed(() =>
  definitions.value.find((item) => item.id === currentDefinitionId.value),
);
// 稳定定义只绑定业务类型；同类型的多个契约版本留在草稿设计器内明确选择。
const definitionBusinessOptions = computed(() => [
  ...new Map(
    businessTypes.value.map((item) => [
      item.businessType,
      { label: item.title, value: item.businessType },
    ]),
  ).values(),
]);
const options = computed<WorkflowDesignerOptions>(() => ({
  ...candidates.value,
  businessTypes: businessTypes.value,
  // 用途属于已发布版本正文，不从稳定定义的不存在字段读取。
  purposeOptions: publishedVersions.value.flatMap((version) => {
    const definition = version.lowflowDefinition;
    if (
      definition?.schemaVersion !== 3 ||
      !definition?.purposeKey ||
      definition.businessBinding?.businessType !==
        selectedDefinition.value?.businessType
    )
      return [];
    return [
      {
        label: `${definition.name}（${definition.purposeKey}）`,
        value: definition.purposeKey,
      },
    ];
  }),
}));
const hasDesignChanges = computed(
  () =>
    !!currentVersion.value &&
    ['Draft', 'Testing'].includes(currentVersion.value.lifecycle) &&
    JSON.stringify(design.value) !==
      JSON.stringify(currentVersion.value.lowflowDefinition ?? {}),
);

function showError(value: unknown) {
  error.value = value instanceof Error ? value.message : '操作失败，请重试。';
}

async function loadCandidates() {
  const current = ++candidateRequest;
  try {
    const result = await loadWorkflowCandidates(candidateKeyword.value.trim());
    if (current === candidateRequest) candidates.value = result;
  } catch (error_) {
    if (current === candidateRequest) showError(error_);
  }
}

async function loadDefinitions() {
  loading.value = true;
  error.value = '';
  try {
    const [list, directory, published] = await Promise.all([
      workflowDefinitionService.list({ pageIndex: 1, pageSize: 200 }),
      workflowRuntimeService.catalog(),
      workflowDefinitionVersionService.list({
        lifecycle: 'Published',
        pageSize: 200,
      }),
    ]);
    definitions.value = list.items;
    businessTypes.value = directory;
    publishedVersions.value = published.items;
  } catch (error_) {
    showError(error_);
  } finally {
    loading.value = false;
  }
}

function confirmDiscard(): Promise<boolean> {
  if (!hasDesignChanges.value) return Promise.resolve(true);
  return new Promise((resolve) =>
    Modal.confirm({
      title: '放弃尚未保存的流程设计？',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    }),
  );
}

async function selectDefinition(id: unknown) {
  if (typeof id !== 'string') return;
  if (!(await confirmDiscard())) return;
  const current = ++selectionRequest;
  loading.value = true;
  try {
    const result = await workflowDefinitionVersionService.list({
      workflowDefinitionId: id,
      pageSize: 200,
    });
    const latest = result.items.toSorted(
      (a, b) => (b.versionNo ?? 0) - (a.versionNo ?? 0),
    )[0];
    // 完整详情恢复模拟证明，不能把缺少报告的列表摘要直接传给发布面板。
    const detail = latest
      ? await workflowDefinitionVersionService.retrieve({ id: latest.id })
      : undefined;
    if (current !== selectionRequest) return;
    currentDefinitionId.value = id;
    versions.value = result.items;
    currentVersion.value = undefined;
    if (detail) applyVersion(detail);
  } catch (error_) {
    if (current === selectionRequest) showError(error_);
  } finally {
    if (current === selectionRequest) loading.value = false;
  }
}

function applyVersion(version: WorkflowDefinitionVersion) {
  // 已保存正文必须是服务端 v3 树；旧平面图不能在普通读取时暗转或继续编辑。
  if (
    version.lowflowDefinition &&
    (version.lowflowDefinition.schemaVersion !== 3 ||
      !version.lowflowDefinition.flowTree)
  )
    throw new Error('仅支持第三版流程树，旧版本须显式迁移后才能在此设计。');

  currentVersion.value = version;
  design.value = version.lowflowDefinition
    ? structuredClone(toRaw(version.lowflowDefinition))
    : createTreeDefinition(
        selectedDefinition.value?.processKey,
        selectedDefinition.value?.name,
      );
  if (!version.lowflowDefinition) {
    // 新版本延续该流程首次发布的用途；首次设计仍由设计者在版本编辑器明确填写。
    const published = publishedVersions.value.find(
      (item) => item.workflowDefinitionId === selectedDefinition.value?.id,
    );
    design.value.purposeKey = published?.lowflowDefinition?.purposeKey ?? '';
  }
}

async function selectVersion(id: unknown) {
  if (typeof id !== 'string') return;
  if (!(await confirmDiscard())) return;
  if (!versions.value.some((item) => item.id === id)) return;
  const current = ++selectionRequest;
  loading.value = true;
  try {
    const version = await workflowDefinitionVersionService.retrieve({ id });
    if (current === selectionRequest) applyVersion(version);
  } catch (error_) {
    if (current === selectionRequest) {
      currentVersion.value = undefined;
      showError(error_);
    }
  } finally {
    if (current === selectionRequest) loading.value = false;
  }
}

function refreshed(version: WorkflowDefinitionVersion) {
  // 保存和模拟回包同样必须保留树格式，异常回包不覆盖当前已授权草稿。
  if (
    version.lowflowDefinition &&
    (version.lowflowDefinition.schemaVersion !== 3 ||
      !version.lowflowDefinition.flowTree)
  ) {
    showError(new Error('仅支持第三版流程树，服务端返回的设计格式无效。'));
    return;
  }
  currentVersion.value = version;
  versions.value = versions.value.map((item) =>
    item.id === version.id ? version : item,
  );
  if (version.lowflowDefinition)
    design.value = structuredClone(toRaw(version.lowflowDefinition));
  if (version.lifecycle === 'Published') {
    // 当前页发布成功即刷新用途目录，后续新草稿无需整页重载即可沿用稳定用途。
    publishedVersions.value = [
      ...publishedVersions.value.filter(
        (item) => item.workflowDefinitionId !== version.workflowDefinitionId,
      ),
      version,
    ];
  }
}

async function createVersion() {
  if (
    !canCreateVersion.value ||
    !selectedDefinition.value ||
    busy.value ||
    !(await confirmDiscard())
  )
    return;
  busy.value = true;
  try {
    const id = await workflowDefinitionVersionService.create({
      workflowDefinitionId: selectedDefinition.value.id,
      versionNo:
        Math.max(0, ...versions.value.map((item) => item.versionNo ?? 0)) + 1,
    });
    const result = await workflowDefinitionVersionService.list({
      workflowDefinitionId: selectedDefinition.value.id,
      pageSize: 200,
    });
    versions.value = result.items;
    applyVersion(await workflowDefinitionVersionService.retrieve({ id }));
  } catch (error_) {
    showError(error_);
  } finally {
    busy.value = false;
  }
}

async function create() {
  if (!canCreate.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const id = await workflowDefinitionService.create({ ...form });
    createOpen.value = false;
    Object.assign(form, blankForm());
    await loadDefinitions();
    await selectDefinition(id);
    message.success('流程定义已创建，请新建草稿版本。');
  } catch (error_) {
    showError(error_);
  } finally {
    busy.value = false;
  }
}

function closeCreate() {
  if (busy.value) return;
  if (JSON.stringify(form) === JSON.stringify(blankForm())) {
    createOpen.value = false;
    return;
  }
  Modal.confirm({
    title: '放弃未保存的流程定义？',
    onOk: () => {
      createOpen.value = false;
      Object.assign(form, blankForm());
    },
  });
}

onMounted(() => {
  void loadDefinitions();
  void loadCandidates();
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 宿主承担定义选择和草稿创建，节点与配置编辑由公开设计组件负责。 -->
    <Alert
      v-if="error"
      :message="error"
      type="error"
      show-icon
      closable
      @close="error = ''"
    />
    <Card :title="pageMeta.title">
      <Space wrap>
        <Select
          :value="currentDefinitionId"
          :disabled="loading || busy"
          aria-label="选择流程定义"
          placeholder="选择流程定义"
          class="w-72"
          :options="
            definitions.map((item) => ({ label: item.name, value: item.id }))
          "
          @change="selectDefinition"
        />
        <Select
          :value="currentVersion?.id"
          :disabled="loading || busy"
          aria-label="选择流程版本"
          placeholder="选择版本"
          class="w-52"
          :options="
            versions.map((item) => ({
              label: `版本 ${item.versionNo} · ${lifecycleLabels[item.lifecycle] || item.lifecycle}`,
              value: item.id,
            }))
          "
          @change="selectVersion"
        />
        <Button v-if="canCreate" type="primary" @click="createOpen = true">
          新建流程定义
        </Button>
        <Button
          v-if="canCreateVersion"
          :disabled="!selectedDefinition"
          :loading="busy"
          @click="createVersion"
        >
          新建草稿版本
        </Button>
        <Button :loading="loading" @click="loadDefinitions">刷新目录</Button>
      </Space>
      <Space class="mt-4" wrap>
        <Input
          v-model:value="candidateKeyword"
          aria-label="审批人搜索"
          placeholder="按姓名搜索审批人"
          class="w-72"
          @press-enter="loadCandidates"
        />
        <Button @click="loadCandidates">刷新人员候选</Button>
      </Space>
    </Card>
    <Spin :spinning="loading">
      <WorkflowDefinitionWorkbench
        v-if="currentVersion"
        :key="currentVersion.id"
        v-model:definition="design"
        :version="currentVersion"
        :options="options"
        :service="workflowDefinitionVersionService"
        :permissions="designPermissions"
        @refreshed="refreshed"
      />
      <Alert
        v-else
        type="info"
        show-icon
        message="请选择流程定义，并创建或选择一个草稿版本开始设计。"
      />
    </Spin>

    <!-- 新增表单以显式字段定义实现，不接受归属、运行状态或引擎内部标识。 -->
    <Modal
      :open="createOpen"
      title="新增流程定义"
      :footer="null"
      :mask-closable="false"
      :width="640"
      @cancel="closeCreate"
    >
      <Alert
        v-if="error"
        class="mb-4"
        :message="error"
        type="error"
        show-icon
      />
      <Form
        :model="form"
        name="workflowDefinitionCreate"
        data-form-id="workflowDefinitionCreate"
        data-form-name="新增流程定义"
        layout="horizontal"
        @finish="create"
      >
        <Form.Item
          label="流程名称"
          name="name"
          :rules="[{ required: true, message: '请输入流程名称。' }]"
        >
          <Input v-model:value="form.name" />
        </Form.Item>
        <Form.Item
          label="流程标识"
          name="processKey"
          :rules="[{ required: true, message: '请输入流程标识。' }]"
        >
          <Input v-model:value="form.processKey" />
        </Form.Item>
        <Form.Item
          label="业务对象"
          name="businessType"
          :rules="[{ required: true, message: '请选择业务对象。' }]"
        >
          <Select
            v-model:value="form.businessType"
            :options="definitionBusinessOptions"
          />
        </Form.Item>
        <Space>
          <Button type="primary" html-type="submit" :loading="busy">
            保存
          </Button>
          <Button :disabled="busy" @click="closeCreate">取消</Button>
        </Space>
      </Form>
    </Modal>
  </div>
</template>
