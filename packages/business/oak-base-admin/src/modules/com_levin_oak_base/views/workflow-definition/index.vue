<script setup lang="ts">
import type {
  WorkflowBusinessObject,
  WorkflowBusinessType,
  WorkflowDefinitionVersion,
  WorkflowDesignerOptions,
  WorkflowStateBinding,
  WorkflowStateGraph,
  WorkflowStateOption,
  WorkflowTaskGraph,
  WorkflowTreeVersion,
} from '@levin/bpm-designer';

import type { WorkflowDefinitionRecord } from '../../api/workflow-definition-service';
import type { ManagedWorkflowVersion } from '../../api/workflow-definition-version-service';

import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import {
  createTaskGraph,
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
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getSessionWorkflowCatalog } from '../../api/session-directories';
import { loadWorkflowCandidates } from '../../api/workflow-candidate-service';
import { workflowDefinitionService } from '../../api/workflow-definition-service';
import { workflowDefinitionVersionService } from '../../api/workflow-definition-version-service';
import { workflowManagementService } from '../../api/workflow-management-service';
import NoticeContentViewer from '../my-messages/notice-content-viewer.vue';
import { createWorkflowDefinitionCrudConfig, lifecycleLabels } from './config';

// 稳定定义与版本分别选择，已发布版本只读；切换时保护尚未保存的设计。
const definitions = ref<WorkflowDefinitionRecord[]>([]);
const versions = ref<WorkflowDefinitionVersion[]>([]);
const publishedVersions = ref<WorkflowDefinitionVersion[]>([]);
const currentDefinitionId = ref<string>();
const currentVersion = ref<ManagedWorkflowVersion>();
const selectedRecord = ref<WorkflowDefinitionRecord>();
const crudPage = ref<InstanceType<typeof CrudPage>>();
const versionSummaries = ref<Record<string, ManagedWorkflowVersion[] | null>>(
  {},
);
let listRequest = 0;
const design = ref<
  WorkflowStateGraph | WorkflowTaskGraph | WorkflowTreeVersion
>(createTreeDefinition());
const businessTypes = ref<WorkflowBusinessType[]>([]);
const businessObjects = ref<WorkflowBusinessObject[]>([]);
// 业务目录与已发布版本独立加载，避免版本失败被误报为对象未接入。
const directoryLoading = ref(true);
const directoryError = ref('');
watch(directoryError, (value) => {
  if (value) message.error(value);
});
let directoryRequest = 0;
const candidates = ref<Pick<WorkflowDesignerOptions, 'groups' | 'users'>>({
  users: [],
  groups: [],
});
const loading = ref(false);
const busy = ref(false);
const error = ref('');
watch(error, (value) => {
  if (value) message.error(value);
});
const candidateKeyword = ref('');
let candidateRequest = 0;
// 编辑候选按查询词在当前页面复用，空结果和并发请求同样属于有效缓存。
const candidateLoads = new Map<
  string,
  ReturnType<typeof loadWorkflowCandidates>
>();
let publishedVersionsLoad: Promise<void> | undefined;
let selectionRequest = 0;
const createOpen = ref(false);
const designOpen = ref(false);
const { hasPermission } = useRbacAccess();
const router = useRouter();
const canViewInstances = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowManagementService, 'instances'),
  ),
);
function viewInstances(record: Pick<WorkflowDefinitionRecord, 'id'>) {
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
  businessEntityKey: '',
  stateField: '',
  stateMapping: [] as WorkflowStateOption[],
});
const blankForm = () => ({
  name: '',
  businessType: '',
  businessEntityKey: '',
  stateField: '',
  stateMapping: [] as WorkflowStateOption[],
});
const selectedDefinition = computed(() => selectedRecord.value);
// 查询明确区分实体键与第三版能力类型，内部 state-bound 标记不进入用户界面。
const legacyBusinessOptions = computed(() => [
  ...new Map(
    businessTypes.value
      .filter((item) => item.businessType !== 'state-bound')
      .map((item) => [
        item.businessType,
        { label: item.title, value: item.businessType },
      ]),
  ).values(),
]);
const definitionBusinessOptions = computed(() => [
  ...businessObjects.value.map((item) => ({
    label: item.title,
    value: `entity:${item.entityKey}`,
  })),
  ...legacyBusinessOptions.value.map((item) => ({
    label: `${item.label}（第三版）`,
    value: `legacy:${item.value}`,
  })),
]);
// 公共表格单元格使用动态插槽，显式收窄其 record 边界而不读取未裁剪的原列表。
function definitionCellRecord(
  slot: unknown,
): Partial<WorkflowDefinitionRecord> {
  if (!slot || typeof slot !== 'object' || !('record' in slot)) return {};
  const row = slot.record;
  if (!row || typeof row !== 'object') return {};
  const values = row as Record<string, unknown>;
  const text = (key: string) =>
    typeof values[key] === 'string' ? values[key] : undefined;
  return {
    id: text('id'),
    businessEntityKey: text('businessEntityKey'),
    businessType: text('businessType'),
    stateField: text('stateField'),
    tenantId: text('tenantId'),
    tenantName: text('tenantName'),
  };
}

// 行操作只接受裁剪后仍具备必要 DTO 字段的记录，不借原始列表绕过字段策略。
function isDefinitionRecord(
  row: Record<string, unknown>,
): row is Record<string, unknown> & WorkflowDefinitionRecord {
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.businessType === 'string' &&
    typeof row.processKey === 'string'
  );
}
function openDefinitionRow(row: Record<string, unknown>) {
  if (isDefinitionRecord(row)) void selectDefinition(row.id, row);
}
function viewDefinitionInstances(row: Record<string, unknown>) {
  if (typeof row.id === 'string') viewInstances({ id: row.id });
}

function businessObjectPresentation(record: Partial<WorkflowDefinitionRecord>) {
  if (record.businessEntityKey) {
    const entity = businessObjects.value.find(
      (item) => item.entityKey === record.businessEntityKey,
    );
    const field = entity?.fields.find((item) => item.key === record.stateField);
    const detail = [
      entity?.className || record.businessEntityKey,
      field ? `${field.title}（${field.key}）` : record.stateField,
    ]
      .filter(Boolean)
      .join(' · ');
    return { label: entity?.title || '业务对象目录暂不可用', detail };
  }
  const legacy = legacyBusinessOptions.value.find(
    (item) => item.value === record.businessType,
  );
  return {
    label: legacy?.label || '业务对象目录暂不可用',
    detail: legacy
      ? `${legacy.label}（第三版）`
      : '未找到当前可访问的业务对象描述',
  };
}
function businessObjectQuery(value: unknown) {
  if (typeof value !== 'string') return {};
  if (value?.startsWith('entity:'))
    return { businessEntityKey: value.slice('entity:'.length) };
  if (value?.startsWith('legacy:'))
    return { businessType: value.slice('legacy:'.length) };
  return {};
}
const options = computed<WorkflowDesignerOptions>(() => ({
  ...candidates.value,
  stateBusinessObjects: businessObjects.value,
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
      definition.purposeKey ===
        (design.value.schemaVersion === 3
          ? design.value.purposeKey
          : undefined) ||
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

// 新流程从真实部署对象目录绑定，已占用字段全局禁用，服务端再次裁决并发冲突。
const selectedBusinessObject = computed(() =>
  businessObjects.value.find(
    (item) => item.entityKey === form.businessEntityKey,
  ),
);
const selectedStateField = computed(() =>
  selectedBusinessObject.value?.fields.find(
    (field) => field.key === form.stateField,
  ),
);
const bindObjectOptions = computed(() =>
  businessObjects.value.map((item) => ({
    label: `${item.title} · ${item.className || item.entityKey}${item.selectable ? '' : `（不可绑定：${item.unavailableReason || '当前对象不满足流程绑定条件'}）`}`,
    value: item.entityKey,
    disabled: !item.selectable,
  })),
);
const bindFieldOptions = computed(
  () =>
    selectedBusinessObject.value?.fields
      .filter((field) => field.stateFieldAllowed)
      .map((field) => ({
        label: `${field.title}（${field.key}）${field.bound || field.boundDefinitionId ? ` · 已绑定 ${field.boundDefinitionName || '其它流程'}` : ''}`,
        value: field.key,
        disabled: !!field.bound || !!field.boundDefinitionId,
      })) ?? [],
);
watch(
  () => form.businessEntityKey,
  () => {
    form.stateField = '';
    form.stateMapping = [];
  },
);
watch(
  () => form.stateField,
  () => {
    form.stateMapping = structuredClone(
      toRaw(selectedStateField.value?.options ?? []),
    );
  },
);
function bindingOf(
  record: WorkflowDefinitionRecord,
): undefined | WorkflowStateBinding {
  if (record.genericBusinessContract?.bindingSnapshot)
    return record.genericBusinessContract.bindingSnapshot;
  if (record.bindingSnapshot) return record.bindingSnapshot;
  if (!record.businessEntityKey || !record.stateField) return undefined;
  const field = businessObjects.value
    .find((item) => item.entityKey === record.businessEntityKey)
    ?.fields.find((item) => item.key === record.stateField);
  const mapping =
    typeof record.stateMapping === 'string'
      ? (JSON.parse(record.stateMapping) as WorkflowStateOption[])
      : (record.stateMapping ?? []);
  let stateType = record.stateType;
  if (!stateType) {
    if (
      field?.type === 'integer' ||
      mapping.some((item) => typeof item.value === 'number')
    )
      stateType = 'integer';
    else if (field?.type === 'enum') stateType = 'enum';
    else stateType = 'string';
  }
  return {
    businessEntityKey: record.businessEntityKey,
    stateField: record.stateField,
    stateType,
    stateMapping: mapping,
  };
}
function addStateMapping() {
  form.stateMapping.push({
    value: selectedStateField.value?.type === 'integer' ? 0 : '',
    label: '',
  });
}
const bindingError = computed(() => {
  if (!form.businessEntityKey || !form.stateField)
    return '请选择业务对象和状态字段。';
  if (form.stateMapping.length === 0) return '请定义至少一个状态值和名称。';
  const seen = new Set<string>();
  for (const item of form.stateMapping) {
    const key = `${typeof item.value}:${item.value}`;
    if (!item.label.trim() || item.value === '' || seen.has(key))
      return '状态值和名称必填，状态值不能重复。';
    if (
      selectedStateField.value?.type === 'integer' &&
      !Number.isSafeInteger(item.value)
    )
      return '整数字段的状态值必须是整数。';
    seen.add(key);
  }
  return '';
});

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

async function loadCandidates(refresh = false) {
  const current = ++candidateRequest;
  const keyword = candidateKeyword.value.trim();
  let pending = candidateLoads.get(keyword);
  if (!pending || refresh) {
    pending = loadWorkflowCandidates(keyword);
    candidateLoads.set(keyword, pending);
  }
  try {
    const result = await pending;
    if (current === candidateRequest) candidates.value = result;
  } catch (error_) {
    // 失败不缓存为成功空值，用户下次打开或主动刷新时可以恢复。
    if (candidateLoads.get(keyword) === pending) candidateLoads.delete(keyword);
    if (current === candidateRequest) showError(error_);
  }
}

// 已发布正文只用于设计器的前置用途选项，列表无需提前加载。
function loadPublishedVersionOptions() {
  publishedVersionsLoad ??= loadVersions({ lifecycle: 'Published' })
    .then((published) => {
      publishedVersions.value = published;
    })
    .catch((error_) => {
      publishedVersionsLoad = undefined;
      showError(error_);
    });
  return publishedVersionsLoad;
}

// 只有面板打开才准备编辑目录；关闭重开不重复获取已加载的选项。
watch(designOpen, (open) => {
  if (!open) return;
  void loadCandidates();
  void loadPublishedVersionOptions();
});

// 分页加载版本元数据，不能用固定 200 条把旧版历史或前置用途静默截断。
async function loadVersions(query_: {
  lifecycle?: string;
  workflowDefinitionId?: string;
}) {
  if (
    !hasPermission(
      buildApiMethodPermissions(workflowDefinitionVersionService, 'list'),
    )
  )
    return [];
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

// 公共 CRUD 管理查询、分页与响应隔离；摘要也仅接受最新查询的结果。
const crudConfig = computed(() =>
  createWorkflowDefinitionCrudConfig({
    apiService: { list: listDefinitions },
    businessOptions: definitionBusinessOptions.value,
  }),
);
async function loadDefinitions() {
  await crudPage.value?.reload();
}
async function listDefinitions(params: Record<string, unknown> = {}) {
  const request = ++listRequest;
  const list = await workflowDefinitionService.list({
    pageIndex: typeof params.pageIndex === 'number' ? params.pageIndex : 1,
    pageSize: typeof params.pageSize === 'number' ? params.pageSize : 10,
    containsName:
      typeof params.containsName === 'string'
        ? params.containsName.trim() || undefined
        : undefined,
    ...businessObjectQuery(params.businessObject),
  });
  if (request !== listRequest) return list;
  definitions.value = list.items;
  versionSummaries.value = {};
  // 摘要失败不清空已经成功加载的定义；打开设计仍独立读取完整版本详情。
  const summaries = await Promise.all(
    list.items.map(async (item) => {
      try {
        return [
          item.id,
          await loadVersions({ workflowDefinitionId: item.id }),
        ] as const;
      } catch (error_) {
        if (request === listRequest) showError(error_);
        return [item.id, null] as const;
      }
    }),
  );
  if (request === listRequest)
    versionSummaries.value = Object.fromEntries(summaries);
  return list;
}

async function loadDirectory() {
  const request = ++directoryRequest;
  directoryLoading.value = true;
  directoryError.value = '';
  businessTypes.value = [];
  businessObjects.value = [];
  await Promise.all([
    workflowDefinitionService
      .businessObjects()
      .then(
        (directory) => {
          if (request === directoryRequest) businessObjects.value = directory;
        },
        () => {
          if (request === directoryRequest)
            directoryError.value = '业务对象加载失败，请重试。';
        },
      )
      .finally(() => {
        if (request === directoryRequest) directoryLoading.value = false;
      }),
    // 固定第三版仍使用原受控能力目录，不能让其失败阻止新对象目录使用。
    getSessionWorkflowCatalog().then(
      (directory) => {
        if (request === directoryRequest) businessTypes.value = directory;
      },
      () => {},
    ),
  ]);
}

function versionSummary(id?: string) {
  if (!id) return '—';
  const list = versionSummaries.value[id];
  if (list === null) return '版本加载失败';
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
  if (currentDefinitionId.value === id && selectedRecord.value) {
    designOpen.value = true;
    return;
  }
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
    designOpen.value = true;
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
    version.lowflowDefinition.schemaVersion !== 4 &&
    version.lowflowDefinition.schemaVersion !== 5 &&
    (version.lowflowDefinition.schemaVersion !== 3 ||
      !version.lowflowDefinition.flowTree)
  )
    throw new Error('此版本不是受支持的流程设计格式。');

  currentVersion.value = version;
  const binding = selectedDefinition.value
    ? bindingOf(selectedDefinition.value)
    : undefined;
  if (!version.lowflowDefinition && binding) {
    design.value = createTaskGraph(
      binding,
      selectedDefinition.value?.processKey,
      selectedDefinition.value?.name,
    );
    return;
  }
  design.value = version.lowflowDefinition
    ? structuredClone(toRaw(version.lowflowDefinition))
    : createTreeDefinition(
        selectedDefinition.value?.processKey,
        selectedDefinition.value?.name,
      );
  if (!version.lowflowDefinition && design.value.schemaVersion === 3) {
    // 新版本延续已发布用途；首次设计以稳定定义键作为内部用途，不要求业务人员填写。
    const published = publishedVersions.value.find(
      (item) => item.workflowDefinitionId === selectedDefinition.value?.id,
    );
    design.value.purposeKey =
      (published?.lowflowDefinition?.schemaVersion === 3
        ? published.lowflowDefinition.purposeKey
        : undefined) ??
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
    version.lowflowDefinition.schemaVersion !== 4 &&
    version.lowflowDefinition.schemaVersion !== 5 &&
    (version.lowflowDefinition.schemaVersion !== 3 ||
      !version.lowflowDefinition.flowTree)
  ) {
    showError(new Error('服务端返回的设计格式无效。'));
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

async function createVersion(newTaskGraph = false) {
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
    const binding = bindingOf(selectedDefinition.value);
    const savedDefinition =
      (newTaskGraph && binding
        ? createTaskGraph(
            binding,
            selectedDefinition.value.processKey,
            selectedDefinition.value.name,
          )
        : currentVersion.value?.lowflowDefinition) ??
      (binding
        ? createTaskGraph(
            binding,
            selectedDefinition.value.processKey,
            selectedDefinition.value.name,
          )
        : undefined);
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
    if (bindingError.value) throw new Error(bindingError.value);
    // 绑定与全局字段占用由服务端原子保存，成功后才创建版本并进入状态图。
    const suffix =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const created = await workflowDefinitionService.createBound({
      name: form.name,
      businessEntityKey: form.businessEntityKey,
      stateField: form.stateField,
      stateMapping: form.stateMapping,
      processKey: `workflow-${suffix}`,
    });
    const id = created.id;
    if (selectedStateField.value)
      Object.assign(selectedStateField.value, {
        bound: true,
        boundDefinitionId: id,
        boundDefinitionName: created.name,
      });
    const binding = bindingOf(created);
    if (!id || !binding) throw new Error('服务端未返回已保存的业务状态绑定。');
    createOpen.value = false;
    // 稳定定义已提交即保留恢复入口；首个草稿失败时不重复创建同名定义。
    selectedRecord.value = created;
    designOpen.value = true;
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
        lowflowDefinition: createTaskGraph(
          binding,
          created.processKey,
          created.name,
        ),
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
  void loadDirectory();
});
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <!-- 宿主承担定义选择和草稿创建，节点与配置编辑由公开设计组件负责。 -->
    <!-- 目录状态独立于流程列表和版本加载，空目录才说明后端接入入口。 -->
    <Alert
      v-if="directoryLoading"
      type="info"
      show-icon
      message="正在加载可选业务对象…"
    />
    <Alert
      v-else-if="
        !directoryError &&
        businessObjects.length === 0 &&
        businessTypes.length === 0
      "
      type="info"
      show-icon
      message="当前没有可用业务对象"
      description="业务目录未返回可用对象，请检查目录加载结果及当前账号权限。"
    />
    <CrudPage ref="crudPage" :config="crudConfig">
      <!-- 绑定业务对象和状态字段由专用创建表单处理，不开放普通编辑和删除。 -->
      <template #toolbar-extra="{ isListOperationVisible }">
        <Button v-if="directoryError" size="small" @click="loadDirectory">
          重试加载业务对象
        </Button>
        <Button
          v-if="
            canCreate &&
            canCreateVersion &&
            isListOperationVisible('workflow:create')
          "
          type="primary"
          @click="createOpen = true"
        >
          新建流程
        </Button>
      </template>
      <template #table-cell-businessType="cell">
        <span
          :title="businessObjectPresentation(definitionCellRecord(cell)).detail"
        >
          {{ businessObjectPresentation(definitionCellRecord(cell)).label }}
        </span>
      </template>
      <template #table-cell-tenantName="cell">
        <Tag>
          {{
            definitionCellRecord(cell).tenantId
              ? `租户：${definitionCellRecord(cell).tenantName || definitionCellRecord(cell).tenantId}`
              : '全局'
          }}
        </Tag>
      </template>
      <template #table-cell-processKey="cell">
        {{ versionSummary(definitionCellRecord(cell).id) }}
      </template>
      <template #row-actions="{ record }">
        <Button
          v-if="canOpenDesign && isDefinitionRecord(record)"
          type="link"
          :disabled="busy"
          @click="openDefinitionRow(record)"
        >
          打开设计
        </Button>
        <Button
          v-if="canViewInstances"
          type="link"
          @click="viewDefinitionInstances(record)"
        >
          运行实例
        </Button>
      </template>
    </CrudPage>
    <Modal
      :open="designOpen"
      :title="`${selectedDefinition?.name ?? '流程'} · 流程设计`"
      :footer="null"
      width="calc(100vw - 32px)"
      :style="{ top: '16px', maxWidth: 'none', paddingBottom: 0 }"
      :body-style="{ height: 'calc(100dvh - 104px)', overflow: 'auto' }"
      :mask-closable="false"
      :destroy-on-close="false"
      :closable="!busy"
      :keyboard="!busy"
      @cancel="designOpen = false"
    >
      <Alert
        v-if="error"
        type="error"
        show-icon
        :message="error"
        class="mb-3"
      />
      <Card v-if="selectedDefinition" :bordered="false">
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
          <Button
            v-if="canCreateVersion"
            :loading="busy"
            @click="createVersion()"
          >
            新建草稿版本
          </Button>
          <Popconfirm
            v-if="
              canCreateVersion &&
              bindingOf(selectedDefinition) &&
              currentVersion?.lowflowDefinition?.schemaVersion !== 5
            "
            title="使用相同业务绑定创建空白任务流程版本？原版本保持不变。"
            @confirm="createVersion(true)"
          >
            <Button :disabled="busy">新建任务流程版本</Button>
          </Popconfirm>
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
            @press-enter="loadCandidates(true)"
          />
          <Button @click="loadCandidates(true)">刷新人员候选</Button>
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
    </Modal>

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
        id="workflowDefinitionCreate"
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
          name="businessEntityKey"
          :rules="[{ required: true, message: '请选择业务对象。' }]"
        >
          <Select
            v-model:value="form.businessEntityKey"
            :options="bindObjectOptions"
            :loading="directoryLoading"
            :disabled="directoryLoading || !!directoryError"
            show-search
            option-filter-prop="label"
            placeholder="选择可绑定的业务实体"
          />
          <p
            v-if="selectedBusinessObject?.description"
            class="text-muted-foreground mt-1 text-sm"
          >
            {{ selectedBusinessObject.description }}
          </p>
        </Form.Item>
        <Form.Item
          label="状态字段"
          name="stateField"
          :rules="[{ required: true, message: '请选择尚未绑定的状态字段。' }]"
        >
          <Select
            v-model:value="form.stateField"
            :options="bindFieldOptions"
            :disabled="!selectedBusinessObject"
            placeholder="同一业务字段全局只能绑定一个流程"
          />
          <p
            v-if="selectedStateField"
            class="text-muted-foreground mt-1 text-sm"
          >
            {{ selectedStateField.description }} · 类型：{{
              selectedStateField.type
            }}
            · {{ selectedStateField.nullable ? '可空' : '不可空' }}
          </p>
        </Form.Item>
        <Form.Item v-if="selectedStateField" label="状态值与名称">
          <p class="text-muted-foreground mb-2 text-sm">
            {{
              selectedStateField.manualMappingRequired
                ? '请定义该字段的全部状态值及显示名称，保存后图中只能使用这些状态。'
                : '使用业务字段已有的枚举、字典或固定选项。'
            }}
          </p>
          <div
            v-for="(item, index) in form.stateMapping"
            :key="index"
            class="mb-2 flex gap-2"
          >
            <InputNumber
              v-if="selectedStateField.type === 'integer'"
              v-model:value="item.value as number"
              :precision="0"
              :disabled="!selectedStateField.manualMappingRequired"
              aria-label="整数状态值"
              class="w-full"
            />
            <Input
              v-else
              v-model:value="item.value as string"
              :disabled="!selectedStateField.manualMappingRequired"
              aria-label="状态值"
              placeholder="状态值"
            />
            <Input
              v-model:value="item.label"
              :disabled="!selectedStateField.manualMappingRequired"
              aria-label="状态名称"
              placeholder="显示名称"
            />
            <Button
              v-if="selectedStateField.manualMappingRequired"
              danger
              @click="form.stateMapping.splice(index, 1)"
            >
              移除
            </Button>
          </div>
          <Button
            v-if="selectedStateField.manualMappingRequired"
            @click="addStateMapping"
          >
            添加状态
          </Button>
        </Form.Item>
        <Space>
          <Button
            type="primary"
            html-type="submit"
            :loading="busy"
            :disabled="directoryLoading || !!directoryError || !!bindingError"
          >
            创建并开始设计
          </Button>
          <Button :disabled="busy" @click="closeCreate">取消</Button>
        </Space>
      </Form>
    </Modal>
  </div>
</template>
