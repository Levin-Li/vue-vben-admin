<script setup lang="ts">
import type {
  WorkflowBusinessType,
  WorkflowDefinitionVersion,
  WorkflowDesignerOptions,
  WorkflowTreeVersion,
} from '@levin/bpm-designer';

import type { WorkflowDefinitionRecord } from '../../api/workflow-definition-service';
import type { ManagedWorkflowVersion } from '../../api/workflow-definition-version-service';

import { computed, onMounted, reactive, ref, toRaw } from 'vue';
import { useRouter } from 'vue-router';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  createTreeDefinition,
  getLatestWorkflowBusinessType,
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
  Table,
  Tag,
} from 'ant-design-vue';

import { loadWorkflowCandidates } from '../../api/workflow-candidate-service';
import { workflowDefinitionService } from '../../api/workflow-definition-service';
import { workflowDefinitionVersionService } from '../../api/workflow-definition-version-service';
import { workflowManagementService } from '../../api/workflow-management-service';
import { workflowRuntimeService } from '../../api/workflow-runtime-service';
import NoticeContentViewer from '../my-messages/notice-content-viewer.vue';
import { lifecycleLabels, pageMeta } from './config';

// 稳定定义与版本分别选择，已发布版本只读；切换时保护尚未保存的设计。
const definitions = ref<WorkflowDefinitionRecord[]>([]);
const versions = ref<WorkflowDefinitionVersion[]>([]);
const publishedVersions = ref<WorkflowDefinitionVersion[]>([]);
const currentDefinitionId = ref<string>();
const currentVersion = ref<ManagedWorkflowVersion>();
const selectedRecord = ref<WorkflowDefinitionRecord>();
const query = reactive({
  name: '',
  businessType: undefined as string | undefined,
});
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
});
const versionSummaries = ref<Record<string, ManagedWorkflowVersion[]>>({});
let listRequest = 0;
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
const router = useRouter();
const canViewInstances = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowManagementService, 'instances'),
  ),
);
function viewInstances(record: WorkflowDefinitionRecord) {
  if (canViewInstances.value)
    void router.push({
      path: '/clob/V1/WorkflowInstance',
      query: { definitionId: record.id },
    });
}
const canCreate = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowDefinitionService, 'create')),
);
const canOpenDesign = computed(
  () =>
    hasPermission(
      buildApiMethodPermissions(workflowDefinitionVersionService, 'list'),
    ) &&
    hasPermission(
      buildApiMethodPermissions(workflowDefinitionVersionService, 'retrieve'),
    ),
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
  businessType: '',
});
const blankForm = () => ({
  name: '',
  businessType: '',
});
const selectedDefinition = computed(() => selectedRecord.value);
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
  businessTypes: selectedDefinition.value
    ? businessTypes.value.filter(
        (item) => item.businessType === selectedDefinition.value?.businessType,
      )
    : businessTypes.value,
  // 用途来自已发布版本正文；当前用途不可作为自身前置，避免设计者选择必定成环的依赖。
  purposeOptions: publishedVersions.value.flatMap((version) => {
    const definition = version.lowflowDefinition;
    if (
      definition?.schemaVersion !== 3 ||
      !definition?.purposeKey ||
      definition.purposeKey === design.value.purposeKey ||
      definition.businessBinding?.businessType !==
        selectedDefinition.value?.businessType
    )
      return [];
    return [
      {
        label: definition.name,
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

// 分页加载版本元数据，不能用固定 200 条把旧版历史或前置用途静默截断。
async function loadVersions(query_: {
  lifecycle?: string;
  workflowDefinitionId?: string;
}) {
  const items: ManagedWorkflowVersion[] = [];
  for (let pageIndex = 1; ; pageIndex++) {
    const page = await workflowDefinitionVersionService.list({
      ...query_,
      pageIndex,
      pageSize: 50,
    });
    items.push(...page.items);
    if (
      page.items.length < 50 ||
      (page.totals !== undefined && items.length >= page.totals)
    )
      return items;
  }
}

async function loadDefinitions() {
  const request = ++listRequest;
  loading.value = true;
  error.value = '';
  try {
    const list = await workflowDefinitionService.list({
      pageIndex: pagination.current,
      pageSize: pagination.pageSize,
      containsName: query.name.trim() || undefined,
      businessType: query.businessType,
    });
    if (request !== listRequest) return;
    definitions.value = list.items;
    pagination.total = list.totals ?? list.items.length;
    // 仅为当前页加载版本状态，工作台打开时仍通过详情恢复完整设计与模拟证明。
    const summaries = await Promise.all(
      list.items.map(
        async (item) =>
          [
            item.id,
            await loadVersions({ workflowDefinitionId: item.id }),
          ] as const,
      ),
    );
    if (request === listRequest)
      versionSummaries.value = Object.fromEntries(summaries);
  } catch (error_) {
    if (request === listRequest) showError(error_);
  } finally {
    if (request === listRequest) loading.value = false;
  }
}

async function loadDirectory() {
  try {
    const [directory, published] = await Promise.all([
      workflowRuntimeService.catalog(),
      loadVersions({ lifecycle: 'Published' }),
    ]);
    businessTypes.value = directory;
    publishedVersions.value = published;
  } catch (error_) {
    showError(error_);
  }
}

function search() {
  pagination.current = 1;
  void loadDefinitions();
}

function changePage(page: { current?: number; pageSize?: number }) {
  pagination.current = page.current ?? 1;
  pagination.pageSize = page.pageSize ?? 10;
  void loadDefinitions();
}

function versionSummary(id: string) {
  const list = versionSummaries.value[id];
  if (!list) return '加载中';
  if (list.length === 0) return '尚无草稿';
  const latest = list.toSorted(
    (a, b) => (b.versionNo ?? 0) - (a.versionNo ?? 0),
  )[0]!;
  const published = list.find((item) => item.lifecycle === 'Published');
  return `最新：版本 ${latest.versionNo} · ${lifecycleLabels[latest.lifecycle]}${published && published.id !== latest.id ? `；已发布：版本 ${published.versionNo}` : ''}`;
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

async function selectDefinition(
  id: unknown,
  record?: WorkflowDefinitionRecord,
) {
  if (typeof id !== 'string' || !canOpenDesign.value) return;
  if (!(await confirmDiscard())) return;
  const current = ++selectionRequest;
  loading.value = true;
  error.value = '';
  try {
    const items = await loadVersions({ workflowDefinitionId: id });
    const latest = items.toSorted(
      (a, b) => (b.versionNo ?? 0) - (a.versionNo ?? 0),
    )[0];
    // 完整详情恢复模拟证明，不能把缺少报告的列表摘要直接传给发布面板。
    const detail = latest
      ? await workflowDefinitionVersionService.retrieve({ id: latest.id })
      : undefined;
    if (current !== selectionRequest) return;
    currentDefinitionId.value = id;
    selectedRecord.value =
      record ?? definitions.value.find((item) => item.id === id);
    versions.value = items;
    currentVersion.value = undefined;
    if (detail) applyVersion(detail);
  } catch (error_) {
    if (current === selectionRequest) showError(error_);
  } finally {
    if (current === selectionRequest) loading.value = false;
  }
}

function applyVersion(version: ManagedWorkflowVersion) {
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
    // 新版本延续已发布用途；首次设计以稳定定义键作为内部用途，不要求业务人员填写。
    const published = publishedVersions.value.find(
      (item) => item.workflowDefinitionId === selectedDefinition.value?.id,
    );
    design.value.purposeKey =
      published?.lowflowDefinition?.purposeKey ??
      selectedDefinition.value?.processKey ??
      '';

    // 仅未持久化设计的新草稿默认最新方案；历史正文由上方原样恢复，不静默换版。
    const preferred = getLatestWorkflowBusinessType(
      businessTypes.value,
      selectedDefinition.value?.businessType ?? '',
    );
    if (preferred)
      design.value.businessBinding = {
        businessType: preferred.businessType,
        contractVersion: preferred.contractVersion,
        identityField: preferred.defaultBinding?.identityField ?? '',
        titleField: preferred.defaultBinding?.titleField ?? '',
        ...(preferred.defaultBinding?.applicantField
          ? { applicantField: preferred.defaultBinding.applicantField }
          : {}),
        ...(preferred.defaultBinding?.summaryField
          ? { summaryField: preferred.defaultBinding.summaryField }
          : {}),
      };
  }
}

async function selectVersion(id: unknown) {
  if (typeof id !== 'string' || !canOpenDesign.value) return;
  if (!(await confirmDiscard())) return;
  if (!versions.value.some((item) => item.id === id)) return;
  const current = ++selectionRequest;
  loading.value = true;
  error.value = '';
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

function refreshed(version: ManagedWorkflowVersion) {
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
  if (currentDefinitionId.value) {
    const list = versionSummaries.value[currentDefinitionId.value] ?? [];
    versionSummaries.value[currentDefinitionId.value] = list.map((item) =>
      item.id === version.id ? version : item,
    );
  }
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
  error.value = '';
  try {
    // 新草稿复制当前选中的持久化设计；已确认放弃的本地修改及部署、模拟证明不能带入。
    const savedDefinition = currentVersion.value?.lowflowDefinition;
    const id = await workflowDefinitionVersionService.create({
      workflowDefinitionId: selectedDefinition.value.id,
      versionNo:
        Math.max(0, ...versions.value.map((item) => item.versionNo ?? 0)) + 1,
      ...(savedDefinition
        ? { lowflowDefinition: structuredClone(toRaw(savedDefinition)) }
        : {}),
    });
    versions.value = await loadVersions({
      workflowDefinitionId: selectedDefinition.value.id,
    });
    versionSummaries.value[selectedDefinition.value.id] = versions.value;
    applyVersion(await workflowDefinitionVersionService.retrieve({ id }));
  } catch (error_) {
    showError(error_);
  } finally {
    busy.value = false;
  }
}

async function create() {
  if (
    !canCreate.value ||
    !canCreateVersion.value ||
    busy.value ||
    !(await confirmDiscard())
  )
    return;
  busy.value = true;
  error.value = '';
  try {
    // 内部稳定键由系统生成，业务设计者只填写名称并选择业务对象。
    const suffix =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const id = await workflowDefinitionService.create({
      ...form,
      processKey: `workflow-${suffix}`,
    });
    createOpen.value = false;
    // 稳定定义已提交即保留恢复入口；首个草稿失败时不重复创建同名定义。
    selectedRecord.value = {
      id,
      name: form.name,
      businessType: form.businessType,
      processKey: `workflow-${suffix}`,
    };
    Object.assign(form, blankForm());
    currentDefinitionId.value = id;
    currentVersion.value = undefined;
    versions.value = [];
    await loadDefinitions();
    let firstVersionId: string | undefined;
    try {
      const versionId = await workflowDefinitionVersionService.create({
        workflowDefinitionId: id,
        versionNo: 1,
      });
      firstVersionId = versionId;
      versions.value = [
        {
          id: versionId,
          workflowDefinitionId: id,
          versionNo: 1,
          lifecycle: 'Draft',
        },
      ];
      versionSummaries.value[id] = versions.value;
      applyVersion(
        await workflowDefinitionVersionService.retrieve({ id: versionId }),
      );
      message.success('流程已创建，可以开始设计。');
    } catch (error_) {
      showError(
        new Error(
          `${firstVersionId ? '草稿版本已创建，但打开失败。请重新选择版本 1 重试。' : '流程定义已创建，首个草稿创建失败。请点击“新建草稿版本”重试。'}${error_ instanceof Error ? error_.message : ''}`,
        ),
      );
    }
  } catch (error_) {
    showError(error_);
  } finally {
    busy.value = false;
  }
}

const lifecycleActions = [
  {
    method: 'retire',
    event: '开始下线',
    label: '开始下线',
    description: '下线后停止新发起，已有实例继续运行。',
  },
  {
    method: 'restore',
    event: '恢复上线',
    label: '恢复上线',
    description: '恢复后允许发起该版本。',
  },
  {
    method: 'finishRetire',
    event: '完成下线',
    label: '完成下线',
    description: '服务端确认无运行实例后完成下线。',
  },
  {
    method: 'archive',
    event: '归档',
    label: '归档',
    description: '归档后保留历史版本用于运行记录追溯。',
  },
] as const;
const availableLifecycleActions = computed(() =>
  lifecycleActions.filter(
    (action) =>
      currentVersion.value?.supportEventsByCurrentStatus?.includes(
        action.event,
      ) &&
      hasPermission(
        buildApiMethodPermissions(
          workflowDefinitionVersionService,
          action.method,
        ),
      ),
  ),
);
function runLifecycle(action: (typeof lifecycleActions)[number]) {
  const version = currentVersion.value;
  if (
    !version ||
    busy.value ||
    !availableLifecycleActions.value.includes(action)
  )
    return;
  Modal.confirm({
    title: `${action.label}版本 ${version.versionNo ?? ''}？`,
    content: action.description,
    async onOk() {
      busy.value = true;
      try {
        refreshed(
          await workflowDefinitionVersionService[action.method]({
            id: version.id,
            optimisticLock: version.optimisticLock,
          }),
        );
        publishedVersions.value = await loadVersions({
          lifecycle: 'Published',
        });
        message.success(`${action.label}成功。`);
      } catch (error_) {
        showError(error_);
        throw error_;
      } finally {
        busy.value = false;
      }
    },
  });
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
  void loadDirectory();
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
      <Space wrap class="mb-4">
        <Input
          v-model:value="query.name"
          aria-label="流程名称查询"
          placeholder="按流程名称查询"
          allow-clear
          @press-enter="search"
        />
        <Select
          v-model:value="query.businessType"
          aria-label="业务对象查询"
          placeholder="全部业务对象"
          allow-clear
          class="w-52"
          :options="definitionBusinessOptions"
        />
        <Button type="primary" :loading="loading" @click="search">查询</Button>
        <Button :loading="loading" @click="loadDefinitions">刷新</Button>
        <Button
          v-if="canCreate && canCreateVersion"
          type="primary"
          @click="createOpen = true"
        >
          新建流程
        </Button>
      </Space>
      <Table
        :data-source="definitions"
        row-key="id"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 850 }"
        @change="changePage"
      >
        <Table.Column title="流程名称" data-index="name" key="name" />
        <Table.Column title="业务对象" key="businessType">
          <template #default="{ record }">
            {{
              definitionBusinessOptions.find(
                (item) => item.value === record.businessType,
              )?.label ?? record.businessType
            }}
          </template>
        </Table.Column>
        <Table.Column title="归属" key="scope">
          <template #default="{ record }">
            <Tag>
              {{
                record.tenantId
                  ? `租户：${record.tenantName || record.tenantId}`
                  : '全局'
              }}
            </Tag>
          </template>
        </Table.Column>
        <Table.Column title="版本状态" key="version">
          <template #default="{ record }">
            {{ versionSummary(record.id) }}
          </template>
        </Table.Column>
        <Table.Column title="操作" key="action" fixed="right" :width="220">
          <template #default="{ record }">
            <Button
              v-if="canOpenDesign"
              type="link"
              :disabled="busy"
              @click="selectDefinition(record.id, record)"
            >
              打开设计
            </Button>
            <Button
              v-if="canViewInstances"
              type="link"
              @click="viewInstances(record)"
            >
              运行实例
            </Button>
          </template>
        </Table.Column>
      </Table>
    </Card>
    <Card
      v-if="selectedDefinition"
      :title="`${selectedDefinition.name} · 设计工作台`"
    >
      <Space wrap>
        <Select
          :value="currentVersion?.id"
          :disabled="loading || busy"
          aria-label="选择流程版本"
          placeholder="选择版本"
          class="w-52"
          :options="
            versions.map((item) => ({
              label: `版本 ${item.versionNo} · ${lifecycleLabels[item.lifecycle]}`,
              value: item.id,
            }))
          "
          @change="selectVersion"
        />
        <Button v-if="canCreateVersion" :loading="busy" @click="createVersion">
          新建草稿版本
        </Button>
        <Button
          v-for="action in availableLifecycleActions"
          :key="action.method"
          :disabled="busy"
          @click="runLifecycle(action)"
        >
          {{ action.label }}
        </Button>
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
      <p class="text-muted-foreground mt-3 text-sm" role="note">
        发起前请确认流程已发布、业务记录满足启动条件，且发起人和审批人均具备该记录的业务访问权限。实例的租户和组织跟随业务记录，选择审批人不会自动授予数据权限。
      </p>
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
      >
        <template #notification-preview="{ content }">
          <NoticeContentViewer :content="content" content-type="Markdown" />
        </template>
      </WorkflowDefinitionWorkbench>
      <Alert
        v-else
        type="info"
        show-icon
        :message="
          selectedDefinition
            ? '当前流程尚无版本，请点击“新建草稿版本”开始设计。'
            : '请从流程列表打开设计，或新建流程开始设计。'
        "
      />
    </Spin>

    <!-- 归属由服务端授权范围决定，表单不允许伪造租户。 -->
    <Modal
      :open="createOpen"
      title="新建流程"
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
      <Alert
        class="mb-4"
        type="info"
        show-icon
        message="平台设计默认归属全局；实际归属由服务端根据当前主体权限确定。"
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
            创建并开始设计
          </Button>
          <Button :disabled="busy" @click="closeCreate">取消</Button>
        </Space>
      </Form>
    </Modal>
  </div>
</template>
