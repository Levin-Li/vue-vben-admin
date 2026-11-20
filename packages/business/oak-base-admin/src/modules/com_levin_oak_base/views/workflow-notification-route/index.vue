<script setup lang="ts">
import type {
  CrudFormElementDeclaration,
  CrudFormElementView,
} from '@levin/admin-framework/framework-commons/shared/crud-form-elements';
import type {
  CrudPageDisplayFieldConfig,
  CrudPageDisplayGroupConfig,
} from '@levin/admin-framework/framework-commons/shared/types';
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type { WorkflowDefinitionRecord } from '../../api/workflow-definition-service';
import type { ManagedWorkflowVersion } from '../../api/workflow-definition-version-service';
import type {
  NotificationChannel,
  WorkflowNotificationRouteInput,
  WorkflowNotificationRouteRecord,
} from '../../api/workflow-notification-route-service';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import {
  getApiErrorMessage,
  notifyApiErrorOnce,
} from '@levin/admin-framework/framework-commons/app/api';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { getCurrentTenantSiteInfo } from '@levin/admin-framework/framework-commons/app/tenant-site-admin-ui-base-setting';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { DEFAULT_CONTENT_MODAL_BODY_STYLE } from '@levin/admin-framework/framework-commons/shared/config-helpers';
import { useCrudDataAttrAccess } from '@levin/admin-framework/framework-commons/shared/crud-data-attr-access';
import { canMutateCrudRecord } from '@levin/admin-framework/framework-commons/shared/crud-editable-access';
import { externalCrudFormDisplayKey } from '@levin/admin-framework/framework-commons/shared/crud-form-elements';
import { filterCrudLocalSelectOption } from '@levin/admin-framework/framework-commons/shared/crud-local-search';
import {
  buildOrganizationScriptContext,
  buildTenantScriptContext,
  isDisplayGroupVisible,
  isRoleVisibilitySatisfied,
  resolveDisplayStates,
  resolveDisplaySubmitKeys,
} from '@levin/admin-framework/framework-commons/shared/crud-page-display';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { evaluateJavaScriptExpression } from '@levin/admin-framework/framework-commons/shared/javascript-expression';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import {
  collectUserRoleIdentityValues,
  isPlatformUser,
} from '@levin/admin-framework/framework-commons/shared/user-identity';
import {
  Alert,
  Button,
  Collapse,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
} from 'ant-design-vue';

import { tenantService } from '../../api/tenant-service';
import { workflowDefinitionService } from '../../api/workflow-definition-service';
import { workflowDefinitionVersionService } from '../../api/workflow-definition-version-service';
import { workflowNotificationRouteService } from '../../api/workflow-notification-route-service';
import { moduleFetchEnumOptions, tenantOptionsLoader } from '../api-module';
import SupportScopeSelector from '../support-scope-selector.vue';
import {
  createWorkflowNotificationRouteCrudConfig,
  normalizeNotificationChannels,
  robotWebhookChannels,
  validRobotConfigRef,
  workflowNotificationEvents,
} from './config';

// 路由维护只使用实际业务资源权限，不暴露通知事件或私有投递实体CRUD。
const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(
    buildApiMethodPermissions(workflowNotificationRouteService, method),
  );
const selectedScope = ref<UserOrgSelectorRecord>();
const user = useUserStore();
const accessStore = useAccessStore();
const platformUser = computed(() => isPlatformUser(user.userInfo));
const formScopeRecord = ref<UserOrgSelectorRecord>();
const tenantOptions = ref<{ label: string; value: string }[]>([]);
const readOnly = ref(false);
const scopeGeneration = ref(0);
const initialQuery = ref<Record<string, unknown>>({});
const error = ref('');
let queryState: Record<string, unknown> = {};
const crudPage = ref<{
  getExternalFormDisplayField?: (
    view: CrudFormElementView,
    formId: string,
    key: string,
  ) => CrudPageDisplayFieldConfig | undefined;
  getExternalFormDisplayGroup?: (
    view: CrudFormElementView,
    key: string,
  ) => CrudPageDisplayGroupConfig | undefined;
  registerExternalFormElements?: (
    elements: CrudFormElementDeclaration[],
  ) => void;
  reload: () => Promise<unknown>;
}>();
const routeFormFields = [
  ['tenantId', '归属租户'],
  ['orgId', '归属组织'],
  ['eventName', '发生事件'],
  ['channel', '通知方式'],
  ['processKey', '适用流程定义'],
  ['targetConfig', '机器人通知群'],
  ['workflowDefinitionVersionId', '适用版本'],
  ['nodeKey', '适用节点'],
  ['forceOverride', '强制覆盖'],
  ['matchCondition', '附加条件'],
  ['priority', '优先级'],
  ['enable', '是否启用'],
  ['remark', '备注'],
] as const;
const routeFormNames = {
  create: '新增',
  edit: '编辑',
  detail: '详情',
} as const;
const externalFormElements: CrudFormElementDeclaration[] = (
  ['create', 'edit', 'detail'] as const
).flatMap((view) =>
  routeFormFields.map(([key, label]) => ({
    view,
    key,
    label,
    fieldKeys: [key],
    isolateDisplay: true,
    formId: `workflow-notification-route-${view}`,
    formName: `工作流通知渠道${routeFormNames[view]}`,
  })),
);
watch(
  crudPage,
  (page) => page?.registerExternalFormElements?.(externalFormElements),
  { immediate: true },
);
const reloadList = () => crudPage.value?.reload();
const canEditRecord = (record: object) =>
  canMutateCrudRecord(
    [{ key: 'editable', label: '可编辑' }],
    record as Record<string, unknown>,
    user.userInfo,
  );
// 范围来自查询模型；重置后不沿用选择器旧记录的组织。
function currentScope(state: Record<string, unknown>):
  | undefined
  | {
      orgId?: string;
      tenantId: string;
    } {
  const { orgId } = state;
  const tenantId =
    platformUser.value && typeof state.tenantId === 'string'
      ? state.tenantId.trim()
      : '';
  const record = selectedScope.value;
  if (orgId) {
    if (
      !record ||
      record.id !== orgId ||
      !record.tenantId ||
      (tenantId && tenantId !== record.tenantId)
    )
      throw new Error('业务范围已变化，请重新选择组织');
    return { tenantId: record.tenantId, orgId: record.id };
  }
  return tenantId ? { tenantId } : undefined;
}
// 公共组件动态插槽在声明文件中与表单插槽合并；宿主校验实际查询插槽合同。
function searchScopeState(slot: unknown): Record<string, unknown> {
  if (!slot || typeof slot !== 'object' || !('searchState' in slot))
    throw new Error('业务范围查询插槽未提供查询模型');
  const state = slot.searchState;
  if (!state || typeof state !== 'object' || Array.isArray(state))
    throw new Error('业务范围查询模型无效');
  return state as Record<string, unknown>;
}
// 动态表格单元格插槽的运行时参数包含记录；公共组件声明将其合并到表单插槽类型。
function tableCellRecord(slot: unknown): WorkflowNotificationRouteRecord {
  return (slot as { record: WorkflowNotificationRouteRecord }).record;
}
function scopeSelection(state: Record<string, unknown>) {
  queryState = state;
  const record = selectedScope.value;
  return state.orgId === record?.id &&
    (!state.tenantId || state.tenantId === record?.tenantId)
    ? record
    : undefined;
}
const crudConfig = computed(() => ({
  ...createWorkflowNotificationRouteCrudConfig({
    apiService: { list: listRoutes },
    initialQuery: initialQuery.value,
    loadChannels,
  }),
  rowActions: [
    {
      label: '查看',
      displayKey: 'notification:retrieve',
      handler: async (record: WorkflowNotificationRouteRecord) =>
        open(record, true),
      visible: () => allowed('retrieve'),
      successMessage: false as const,
      reloadAfterAction: false,
    },
    {
      label: '编辑',
      displayKey: 'notification:update',
      handler: async (record: WorkflowNotificationRouteRecord) => open(record),
      visible: (record: Record<string, unknown>) =>
        canEditRecord(record) && allowed('update') && allowed('retrieve'),
      successMessage: false as const,
      reloadAfterAction: false,
    },
    {
      label: '删除',
      displayKey: 'notification:remove',
      danger: true,
      handler: async (record: WorkflowNotificationRouteRecord) => {
        if (canEditRecord(record) && allowed('remove')) removing.value = record;
      },
      visible: (record: Record<string, unknown>) =>
        canEditRecord(record) && allowed('remove'),
      successMessage: false as const,
      reloadAfterAction: false,
    },
  ],
}));
const quickPolicyConfig = computed(() => ({
  ...crudConfig.value,
  dataAttrTargets: {
    ...crudConfig.value.dataAttrTargets,
    create: {
      method: 'POST' as const,
      path: `${crudConfig.value.apiModuleBase}/WorkflowNotificationRoute/create`,
    },
    retrieve: {
      method: 'GET' as const,
      path: `${crudConfig.value.apiModuleBase}/WorkflowNotificationRoute/retrieve`,
    },
    update: {
      method: 'PUT' as const,
      path: `${crudConfig.value.apiModuleBase}/WorkflowNotificationRoute/update`,
    },
  },
}));
const quickAccess = useCrudDataAttrAccess(
  () => quickPolicyConfig.value,
  () => `${crudConfig.value.apiBase}/list`,
  () => JSON.stringify([user.userInfo, accessStore.accessCodes]),
  (operation) =>
    ['create', 'retrieve', 'update'].includes(operation) && allowed(operation),
);
const enableBusy = ref(new Set<string>());
async function updateEnabled(
  record: WorkflowNotificationRouteRecord,
  enable: boolean,
) {
  if (
    !allowed('update') ||
    !canEditRecord(record) ||
    !quickAccess.allowed('update', 'input', 'enable') ||
    enableBusy.value.has(record.id) ||
    !Number.isInteger(record.optimisticLock)
  )
    return;
  enableBusy.value = new Set(enableBusy.value).add(record.id);
  const checkpoint = quickAccess.checkpoint();
  const scope = scopeGeneration.value;
  try {
    await quickAccess.ensure('update');
    quickAccess.assertCheckpoint(checkpoint);
    if (
      !allowed('update') ||
      scope !== scopeGeneration.value ||
      !canEditRecord(record) ||
      !quickAccess.allowed('update', 'input', 'enable')
    )
      return;
    const payload = {
      ...routeRecordScope(record),
      id: record.id,
      optimisticLock: record.optimisticLock,
      enable,
    };
    quickAccess.assertInput('update', payload);
    quickAccess.assertCheckpoint(checkpoint);
    await workflowNotificationRouteService.update(payload);
    if (scope === scopeGeneration.value) await reloadList();
  } catch (error_) {
    if (scope === scopeGeneration.value) notifyApiErrorOnce(error_);
  } finally {
    const next = new Set(enableBusy.value);
    next.delete(record.id);
    enableBusy.value = next;
  }
}
const channels = ref<{ label: string; value: NotificationChannel }[]>([]);
const current = ref<WorkflowNotificationRouteRecord>();
const opened = ref(false);
const busy = ref(false);
const removing = ref<WorkflowNotificationRouteRecord>();
const draft = reactive<WorkflowNotificationRouteInput>({
  eventName: 'TaskCreated',
  channel: 'Station',
  priority: 100,
  forceOverride: false,
  enable: true,
  targetConfig: {},
});
let formPolicyCheckpoint = 0;
const formView = computed<CrudFormElementView>(() => {
  if (readOnly.value) return 'detail';
  return current.value ? 'edit' : 'create';
});
function formSetting(key: string) {
  const view = formView.value;
  return crudPage.value?.getExternalFormDisplayField?.(
    view,
    `workflow-notification-route-${view}`,
    key,
  );
}
function formFieldAllowed(key: string) {
  if (key === 'tenantId' && !platformUser.value) return false;
  if (current.value && !quickAccess.allowed('retrieve', 'output', key))
    return false;
  return (
    readOnly.value ||
    quickAccess.allowed(current.value ? 'update' : 'create', 'input', key)
  );
}
// 与公共 CRUD 使用相同的角色、组、依赖和表达式规则；权限不满足始终排除。
const formDisplay = computed(() => {
  const view = formView.value;
  const formId = `workflow-notification-route-${view}`;
  const roles = collectUserRoleIdentityValues(
    (user.userInfo || {}) as Record<string, unknown>,
  );
  const context = {
    form: draft,
    user: user.userInfo || {},
    org: buildOrganizationScriptContext(
      user.userInfo as Record<string, any> | undefined,
    ),
    tenant: buildTenantScriptContext(
      getCurrentTenantSiteInfo() as Record<string, any> | undefined,
      user.userInfo as Record<string, any> | undefined,
    ),
  };
  const evaluate = (expression?: string) => {
    if (!expression?.trim()) return true;
    try {
      return Boolean(evaluateJavaScriptExpression(expression, context));
    } catch {
      return false;
    }
  };
  const items: CrudPageDisplayFieldConfig[] = [];
  const excluded = new Set<string>();
  const expressionResults: Record<string, boolean> = {};
  for (const [key] of routeFormFields) {
    const id = externalCrudFormDisplayKey(formId, key);
    const item = { key: id, ...formSetting(key) };
    const group =
      item.layoutGroup && item.layoutGroupExcluded !== true
        ? crudPage.value?.getExternalFormDisplayGroup?.(view, item.layoutGroup)
        : undefined;
    if (
      !formFieldAllowed(key) ||
      !isRoleVisibilitySatisfied(item.visibleRoleCodes, roles) ||
      !isDisplayGroupVisible(
        group,
        evaluate(group?.visibility?.expression),
        roles,
      )
    )
      excluded.add(id);
    expressionResults[id] = evaluate(item.visibility?.expression);
    items.push(item);
  }
  // 其他表单或无权字段不属于当前候选，依赖它们时必须保持隐藏。
  const known = new Set(items.map((item) => item.key));
  for (const item of items) {
    for (const key of [
      ...(item.visibility?.dependsOn?.fieldKeys || []),
      ...(item.visibility?.exclusiveWith?.fieldKeys || []),
    ]) {
      if (!known.has(key)) excluded.add(key);
    }
  }
  return {
    states: resolveDisplayStates(items, expressionResults, excluded),
    submit: resolveDisplaySubmitKeys(items, expressionResults, excluded),
  };
});
function formFieldVisible(key: string) {
  return (
    formDisplay.value.states[
      externalCrudFormDisplayKey(
        `workflow-notification-route-${formView.value}`,
        key,
      )
    ] === 'VISIBLE'
  );
}
function formFieldSubmittable(key: string) {
  return formDisplay.value.submit.has(
    externalCrudFormDisplayKey(
      `workflow-notification-route-${formView.value}`,
      key,
    ),
  );
}
function formFieldLabel(key: string, fallback: string) {
  return formSetting(key)?.label || fallback;
}
const advancedFormKeys = new Set([
  'forceOverride',
  'matchCondition',
  'nodeKey',
  'priority',
  'workflowDefinitionVersionId',
]);
// 基础和高级区域独立排序；仅显示当前区域中有可见字段的配置分组。
function formRegionLayout(region: 'advanced' | 'basic') {
  const fields = routeFormFields
    .map(([key], index) => ({ key, index, setting: formSetting(key) }))
    .filter(({ key }) => advancedFormKeys.has(key) === (region === 'advanced'))
    .filter(
      ({ key }) =>
        formFieldVisible(key) &&
        (key !== 'tenantId' || platformUser.value) &&
        (key !== 'targetConfig' || isRobot.value),
    );
  const groups = new Map<
    string,
    {
      fields: typeof fields;
      index: number;
      key: string;
      order: number;
      title: string;
    }
  >();
  for (const field of fields) {
    const groupKey = field.setting?.layoutGroupExcluded
      ? ''
      : field.setting?.layoutGroup || '';
    const config = groupKey
      ? crudPage.value?.getExternalFormDisplayGroup?.(formView.value, groupKey)
      : undefined;
    const group = groups.get(groupKey) || {
      key: groupKey,
      title: config?.title || groupKey,
      order: config?.order ?? field.index,
      index: field.index,
      fields: [],
    };
    group.fields.push(field);
    groups.set(groupKey, group);
  }
  const ordered = [...groups.values()].toSorted(
    (a, b) => a.order - b.order || a.index - b.index,
  );
  const entries: { key: string; kind: 'field' | 'group'; title?: string }[] =
    [];
  ordered.forEach((group) => {
    if (group.key)
      entries.push({ kind: 'group', key: group.key, title: group.title });
    group.fields
      .toSorted(
        (a, b) =>
          (a.setting?.order ?? a.index) - (b.setting?.order ?? b.index) ||
          a.index - b.index,
      )
      .forEach((field) => {
        entries.push({ kind: 'field', key: field.key });
      });
  });
  return entries;
}
function formFieldDisabled(key: string) {
  return readOnly.value || formSetting(key)?.disabled === true;
}
const configRef = ref('');
const robotGroupId = ref('');
const robotGroups = ref<{ label: string; value: string }[]>([]);
const robotGroupsLoading = ref(false);
const robotGroupsError = ref('');
const definitions = ref<WorkflowDefinitionRecord[]>([]);
const versions = ref<ManagedWorkflowVersion[]>([]);
type RouteGraphNode = {
  id: string;
  name: string;
  notifications?: Array<{ event?: string }>;
  type?: string;
};
const nodeGraph = ref<{ nodes?: RouteGraphNode[]; schemaVersion?: number }>();
// 路由节点必须能产生当前事件：schema4 不发送任务事件，生命周期需节点已配置通知。
const nodeOptions = computed(() => {
  const graph = nodeGraph.value;
  const lifecycle =
    draft.eventName === 'NodeEntered' || draft.eventName === 'NodeCompleted';
  return (graph?.nodes ?? [])
    .filter((node) => {
      if (!node.id || ![4, 5].includes(Number(graph?.schemaVersion)))
        return false;
      if (lifecycle)
        return (
          Array.isArray(node.notifications) &&
          node.notifications.some((item) => item?.event === draft.eventName)
        );
      return graph?.schemaVersion === 5 && node.type === 'userTask';
    })
    .map((node) => ({ label: node.name || node.id, value: node.id }));
});
const definitionsLoading = ref(false);
const versionsLoading = ref(false);
const definitionError = ref('');
const canBrowseDefinitions = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowDefinitionService, 'list')),
);
// 租户下拉与路由维护是独立权限；没有目录权限时不发起辅助请求。
const canBrowseTenants = computed(() =>
  hasPermission(buildApiMethodPermissions(tenantService, 'list')),
);
const canBrowseVersions = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowDefinitionVersionService, 'list'),
  ),
);
const canReadVersion = computed(() =>
  hasPermission(
    buildApiMethodPermissions(workflowDefinitionVersionService, 'retrieve'),
  ),
);
const definitionOptions = computed(() => {
  const options = definitions.value.map((item) => ({
    label: item.name,
    value: item.processKey,
  }));
  if (
    draft.processKey &&
    !options.some((item) => item.value === draft.processKey)
  )
    options.unshift({
      label: '当前已指定流程（无查看权限或已停用）',
      value: draft.processKey,
    });
  return options;
});
const versionStatusLabels: Record<ManagedWorkflowVersion['lifecycle'], string> =
  {
    Draft: '草稿',
    Testing: '检查中',
    Published: '已发布',
    Retiring: '退役中',
    Retired: '已退役',
    Archived: '已归档',
  };
const versionOptions = computed(() => {
  const options = versions.value.map((item) => ({
    label: `版本 ${item.versionNo ?? '未知'} · ${versionStatusLabels[item.lifecycle] || item.lifecycle}`,
    value: item.id,
  }));
  if (
    draft.workflowDefinitionVersionId &&
    !options.some((item) => item.value === draft.workflowDefinitionVersionId)
  )
    options.unshift({
      label: '当前已指定版本（无查看权限或已停用）',
      value: draft.workflowDefinitionVersionId,
    });
  return options;
});
const selectableNodes = computed(() => {
  const options = [...nodeOptions.value];
  if (draft.nodeKey && !options.some((item) => item.value === draft.nodeKey))
    options.unshift({
      label: '当前已指定节点（无查看权限或已停用）',
      value: draft.nodeKey,
    });
  return options;
});

// 新增的租户与组织独立于查询控件；切换归属时清空不再适用的组织和目标配置。
const formTenantId = computed(() => {
  if (draft.tenantId) return draft.tenantId;
  if (
    !platformUser.value &&
    user.userInfo?.tenantId !== null &&
    user.userInfo?.tenantId !== undefined
  )
    return String(user.userInfo.tenantId);
  return undefined;
});
let definitionRequest = 0;
let versionRequest = 0;
async function loadDefinitionOptions() {
  const request = ++definitionRequest;
  definitions.value = [];
  definitionError.value = '';
  if (!canBrowseDefinitions.value) return;
  definitionsLoading.value = true;
  try {
    const found: WorkflowDefinitionRecord[] = [];
    for (let pageIndex = 1; pageIndex <= 20; pageIndex++) {
      const page = await workflowDefinitionService.list({
        pageIndex,
        pageSize: 100,
      });
      if (request !== definitionRequest) return;
      found.push(...page.items);
      if (
        page.items.length < 100 ||
        (page.totals !== undefined && found.length >= page.totals)
      )
        break;
      if (pageIndex === 20)
        throw new Error('流程定义数量超过可加载范围，请缩小管理范围');
    }
    definitions.value = found;
    if (draft.processKey) await loadVersionOptions();
  } catch (error_) {
    if (request === definitionRequest)
      definitionError.value = getApiErrorMessage(error_);
  } finally {
    if (request === definitionRequest) definitionsLoading.value = false;
  }
}
async function loadVersionOptions() {
  const request = ++versionRequest;
  versions.value = [];
  nodeGraph.value = undefined;
  const definition = definitions.value.find(
    (item) => item.processKey === draft.processKey,
  );
  if (!definition || !canBrowseVersions.value) return;
  versionsLoading.value = true;
  try {
    const found: ManagedWorkflowVersion[] = [];
    for (let pageIndex = 1; pageIndex <= 20; pageIndex++) {
      const page = await workflowDefinitionVersionService.list({
        workflowDefinitionId: definition.id,
        pageIndex,
        pageSize: 100,
      });
      if (request !== versionRequest) return;
      found.push(...page.items);
      if (
        page.items.length < 100 ||
        (page.totals !== undefined && found.length >= page.totals)
      )
        break;
      if (pageIndex === 20) throw new Error('流程版本数量超过可加载范围');
    }
    versions.value = found;
    if (draft.workflowDefinitionVersionId) await loadNodeOptions();
  } catch (error_) {
    if (request === versionRequest) notifyApiErrorOnce(error_);
  } finally {
    if (request === versionRequest) versionsLoading.value = false;
  }
}
async function loadNodeOptions() {
  nodeGraph.value = undefined;
  if (!draft.workflowDefinitionVersionId || !canReadVersion.value) return;
  const versionId = draft.workflowDefinitionVersionId;
  try {
    const version = await workflowDefinitionVersionService.retrieve({
      id: versionId,
    });
    if (versionId !== draft.workflowDefinitionVersionId) return;
    nodeGraph.value = version.lowflowDefinition as typeof nodeGraph.value;
  } catch (error_) {
    notifyApiErrorOnce(error_);
  }
}
function changeProcess(value?: string) {
  draft.processKey = value || '';
  draft.workflowDefinitionVersionId = '';
  draft.nodeKey = '';
  void loadVersionOptions();
}
function changeVersion(value?: string) {
  draft.workflowDefinitionVersionId = value || '';
  draft.nodeKey = '';
  void loadNodeOptions();
}
function changeEvent() {
  // 不把旧事件的节点静默复用于新事件；保留已保存历史仅用于打开时回显。
  draft.nodeKey = '';
  appliedFormDefaults.add('nodeKey');
}
const formTenantOptions = computed(() => {
  if (
    !formTenantId.value ||
    tenantOptions.value.some((item) => item.value === formTenantId.value)
  )
    return tenantOptions.value;
  return [
    {
      value: formTenantId.value,
      label: formScopeRecord.value?.tenantName || formTenantId.value,
    },
    ...tenantOptions.value,
  ];
});
let tenantOptionsVersion = 0;
async function loadTenantOptions(keyword = '') {
  const version = ++tenantOptionsVersion;
  if (!canBrowseTenants.value) {
    tenantOptions.value = [];
    return;
  }
  try {
    const options = await tenantOptionsLoader(keyword);
    if (version === tenantOptionsVersion)
      tenantOptions.value = options.map(({ label, value }) => ({
        label,
        value: String(value),
      }));
  } catch (error_) {
    if (version === tenantOptionsVersion) notifyApiErrorOnce(error_);
  }
}
let tenantDefaultTouched = false;
function changeFormTenant(value?: string, automatic = false) {
  if (!automatic) tenantDefaultTouched = true;
  if (current.value || !platformUser.value || value === draft.tenantId) return;
  defaultOrgRequest++;
  draft.tenantId = value;
  draft.orgId = undefined;
  formScopeRecord.value = undefined;
  changeChannel();
}
function changeFormOrganization(records: UserOrgSelectorRecord[]) {
  if (current.value) return;
  defaultOrgRequest++;
  const org = records[0];
  if (
    org &&
    (org.kind !== 'org' || (org.tenantId || undefined) !== formTenantId.value)
  )
    return;
  formScopeRecord.value = org;
  draft.orgId = org?.id;
  robotGroupId.value = '';
}
function loadFormOrgTree() {
  const tenantId = formTenantId.value;
  return tenantId
    ? rbacService.fetchAuthorizedOrgTreeByTenant(tenantId)
    : rbacService.fetchAuthorizedOrgTree({ assembleTree: true });
}
const conditionText = ref('{}');
const conditionValue = computed({
  get: () => JSON.parse(conditionText.value || '{}') as unknown,
  set: (value: unknown) => {
    conditionText.value = JSON.stringify(value) ?? 'null';
  },
});
const advancedKeys = ref<string[]>([]);
const isRobot = computed(() => robotWebhookChannels.includes(draft.channel));
// 仅在新增的同一次表单生命周期应用一次默认值，避免重新显示时覆盖用户输入。
const appliedFormDefaults = new Set<string>();
watch(
  () => ({
    opened: opened.value,
    editing: Boolean(current.value),
    channels: channels.value,
    tenants: tenantOptions.value,
    definitions: definitions.value,
    versions: versions.value,
    nodes: nodeOptions.value,
    groups: robotGroups.value,
    fields: routeFormFields.map(([key]) => ({
      key,
      allowed: formFieldAllowed(key),
      visible: formFieldVisible(key),
      configured: formSetting(key)?.defaultValue,
    })),
  }),
  ({ opened: isOpen, editing, fields }) => {
    if (!isOpen || editing || readOnly.value) return;
    for (const { key, allowed: permitted, visible, configured } of fields) {
      if (
        !permitted ||
        appliedFormDefaults.has(key) ||
        !configured ||
        !Object.hasOwn(configured, 'value')
      )
        continue;
      if (configured.applyWhen === 'initialize-or-first-visible' && !visible)
        continue;
      const value = configured.value;
      if (
        key === 'eventName' &&
        typeof value === 'string' &&
        workflowNotificationEvents.some((item) => item.value === value)
      ) {
        draft.eventName = value as WorkflowNotificationRouteInput['eventName'];
      } else if (key === 'channel' && typeof value === 'string') {
        if (channels.value.length === 0) continue;
        if (channels.value.some((item) => item.value === value))
          draft.channel = value as NotificationChannel;
      } else if (key === 'priority') {
        // 展示设置文本控件返回字符串，只接受有符号十进制整数及合法范围。
        let parsed = Number.NaN;
        if (typeof value === 'number') parsed = value;
        else if (typeof value === 'string' && /^-?\d+$/.test(value.trim()))
          parsed = Number(value.trim());
        if (
          !Number.isInteger(parsed) ||
          parsed < -2_147_483_648 ||
          parsed > 2_147_483_647
        )
          continue;
        draft.priority = parsed;
      } else if (key === 'enable' || key === 'forceOverride') {
        if (
          value !== true &&
          value !== false &&
          value !== 'true' &&
          value !== 'false'
        )
          continue;
        draft[key] = value === true || value === 'true';
      } else if (key === 'remark' && typeof value === 'string') {
        draft.remark = value;
      } else if (
        key === 'tenantId' &&
        platformUser.value &&
        typeof value === 'string'
      ) {
        // 只允许使用当前账号有权选择的租户；已有范围不覆盖。
        if (
          tenantDefaultTouched ||
          draft.tenantId ||
          !tenantOptions.value.some((item) => item.value === value)
        )
          continue;
        changeFormTenant(value, true);
      } else if (key === 'processKey' && typeof value === 'string') {
        // 默认流程必须存在于当前主体可查询的目录中。
        if (
          draft.processKey ||
          !definitions.value.some((item) => item.processKey === value)
        )
          continue;
        changeProcess(value);
      } else if (
        key === 'workflowDefinitionVersionId' &&
        typeof value === 'string'
      ) {
        // 版本仅可来自所选流程的授权版本目录。
        if (
          draft.workflowDefinitionVersionId ||
          !versions.value.some((item) => item.id === value)
        )
          continue;
        changeVersion(value);
      } else if (key === 'nodeKey' && typeof value === 'string') {
        if (
          draft.nodeKey ||
          !nodeOptions.value.some((item) => item.value === value)
        )
          continue;
        draft.nodeKey = value;
      } else if (
        key === 'targetConfig' &&
        isRobot.value &&
        value &&
        (typeof value === 'string' ||
          (typeof value === 'object' && !Array.isArray(value)))
      ) {
        // 机器人目标必须匹配当前范围和渠道的候选。
        const groupId =
          typeof value === 'string'
            ? value
            : (value as Record<string, unknown>).groupId;
        if (
          robotGroupId.value ||
          typeof groupId !== 'string' ||
          !robotGroups.value.some((item) => item.value === groupId)
        )
          continue;
        robotGroupId.value = groupId;
        configRef.value = '';
      } else if (
        key === 'matchCondition' &&
        value &&
        (typeof value === 'string' ||
          (typeof value === 'object' && !Array.isArray(value)))
      ) {
        // 默认匹配条件与保存时使用同一严格校验。
        try {
          const json =
            typeof value === 'string' ? value : JSON.stringify(value);
          readCondition(json);
          conditionText.value = json;
        } catch {
          continue;
        }
      } else {
        // 范围、流程级联及通知群默认值必须先由受权候选解析，不能直接写入。
        continue;
      }
      appliedFormDefaults.add(key);
    }
  },
  { flush: 'post' },
);
let defaultOrgRequest = 0;
// 组织默认值必须经当前租户的授权组织树核验，并防止迟到响应覆盖用户选择。
watch(
  () =>
    [
      opened.value,
      current.value,
      formTenantId.value,
      draft.orgId,
      formFieldAllowed('orgId'),
      formFieldVisible('orgId'),
      formSetting('orgId')?.defaultValue,
    ] as const,
  async ([isOpen, editing, tenantId, orgId, allowed, visible, configured]) => {
    const request = ++defaultOrgRequest;
    if (
      !isOpen ||
      editing ||
      readOnly.value ||
      !tenantId ||
      orgId ||
      !allowed ||
      !configured ||
      typeof configured.value !== 'string' ||
      (configured.applyWhen === 'initialize-or-first-visible' && !visible) ||
      appliedFormDefaults.has('orgId')
    )
      return;
    try {
      const tree = await rbacService.fetchAuthorizedOrgTreeByTenant(tenantId);
      if (
        request !== defaultOrgRequest ||
        !opened.value ||
        formTenantId.value !== tenantId ||
        draft.orgId
      )
        return;
      const find = (
        nodes: Record<string, any>[],
      ): Record<string, any> | undefined => {
        for (const node of nodes) {
          if (
            String(node.id || '') === configured.value &&
            String(node.tenantId || '') === tenantId
          )
            return node;
          const child = find(Array.isArray(node.children) ? node.children : []);
          if (child) return child;
        }
      };
      const org = find(Array.isArray(tree) ? tree : []);
      if (!org) return;
      changeFormOrganization([
        {
          id: String(org.id),
          name: String(org.name || org.id),
          kind: 'org',
          tenantId,
          raw: org,
        },
      ]);
      appliedFormDefaults.add('orgId');
    } catch (error_) {
      if (request === defaultOrgRequest) notifyApiErrorOnce(error_);
    }
  },
  { flush: 'post' },
);
let robotGroupRequest = 0;
// 候选仅在打开机器人表单后加载，范围和渠道变化会使迟到响应失效。
watch(
  () => [opened.value, draft.channel, formTenantId.value, draft.orgId] as const,
  async ([visible, channel, tenantId, orgId]) => {
    const request = ++robotGroupRequest;
    robotGroups.value = [];
    robotGroupsError.value = '';
    if (!visible || !robotWebhookChannels.includes(channel)) return;
    robotGroupsLoading.value = true;
    try {
      const groups =
        await workflowNotificationRouteService.robotGroupCandidates({
          channel,
          tenantId,
          orgId,
        });
      if (request === robotGroupRequest)
        robotGroups.value = groups.map((group) => ({
          label: group.name,
          value: group.id,
        }));
    } catch (error_) {
      if (request === robotGroupRequest)
        robotGroupsError.value = getApiErrorMessage(error_) || '通知群加载失败';
    } finally {
      if (request === robotGroupRequest) robotGroupsLoading.value = false;
    }
  },
);
const canSave = computed(
  () =>
    !readOnly.value &&
    (!current.value || canEditRecord(current.value)) &&
    allowed(current.value ? 'update' : 'create'),
);
let listVersion = 0;
let detailVersion = 0;
// 公共CRUD传入查询快照及真实分页；仅传输当前接口声明的参数。
async function listRoutes(params: Record<string, unknown> = {}) {
  const version = ++listVersion;
  error.value = '';
  if (!allowed('list')) return { items: [], totals: 0 };
  try {
    const queryChannels = params.channel
      ? await loadChannels()
      : channels.value;
    const channel = queryChannels.find(
      (item) => item.value === params.channel,
    )?.value;
    const eventName = workflowNotificationEvents.find(
      (item) => item.value === params.eventName,
    )?.value;
    let enable: boolean | undefined;
    if (params.enable === true || params.enable === 'true') {
      enable = true;
    } else if (params.enable === false || params.enable === 'false') {
      enable = false;
    }
    if ((params.channel && !channel) || (params.eventName && !eventName))
      throw new Error('通知渠道或流程事件已失效，请重新选择');
    if (
      params.enable !== null &&
      params.enable !== undefined &&
      params.enable !== '' &&
      enable === undefined
    )
      throw new Error('启用状态无效，请重新选择');
    const result = await workflowNotificationRouteService.list({
      ...currentScope(params),
      eventName,
      channel,
      ...(enable === undefined ? {} : { enable }),
      pageIndex: Number(params.pageIndex) || 1,
      pageSize: Number(params.pageSize) || 20,
    });
    return version === listVersion ? result : { items: [], totals: 0 };
  } catch (error_) {
    if (version === listVersion) {
      error.value = getApiErrorMessage(error_);
      notifyApiErrorOnce(error_);
    }
    throw error_;
  }
}
// 切换组织使旧列表实例失效，同时保留其它查询条件；详情和删除确认立即关闭。
function changeScope(
  record: undefined | UserOrgSelectorRecord,
  state: Record<string, unknown>,
) {
  if (
    record &&
    (record.kind !== 'org' ||
      !record.tenantId ||
      (state.tenantId && state.tenantId !== record.tenantId))
  )
    return;
  selectedScope.value = record;
  initialQuery.value = { ...state, orgId: record?.id };
  queryState = initialQuery.value;
  detailVersion += 1;
  opened.value = false;
  current.value = undefined;
  removing.value = undefined;
  listVersion += 1;
  error.value = '';
  scopeGeneration.value += 1;
}
// 行操作从返回记录获取范围，避免查询控件尚未提交时改变目标。
function routeRecordScope(record: WorkflowNotificationRouteRecord) {
  return {
    ...(record.tenantId ? { tenantId: record.tenantId } : {}),
    ...(record.orgId ? { orgId: record.orgId } : {}),
  };
}
async function open(
  record?: WorkflowNotificationRouteRecord,
  viewOnly = false,
) {
  const version = ++detailVersion;
  if (
    record
      ? !allowed('retrieve') ||
        (!viewOnly && (!canEditRecord(record) || !allowed('update')))
      : !allowed('create')
  )
    return;
  try {
    appliedFormDefaults.clear();
    tenantDefaultTouched = false;
    // 在打开表单前加载实际接口的字段策略；身份或授权变更时不能沿用旧策略。
    const policyVersion = quickAccess.checkpoint();
    await Promise.all(
      record
        ? [
            quickAccess.ensure('retrieve'),
            ...(viewOnly ? [] : [quickAccess.ensure('update')]),
          ]
        : [quickAccess.ensure('create')],
    );
    quickAccess.assertCheckpoint(policyVersion);
    const result = record
      ? await workflowNotificationRouteService.retrieve({
          ...routeRecordScope(record),
          id: record.id,
        })
      : undefined;
    if (
      version !== detailVersion ||
      (!viewOnly && result && !canEditRecord(result))
    )
      return;
    current.value = result;
    readOnly.value = viewOnly;
    formPolicyCheckpoint = policyVersion;
    const visibleResult = result
      ? quickAccess.pruneOutput('retrieve', result)
      : undefined;
    const scope = result ?? currentScope(queryState);
    formScopeRecord.value =
      !result && scope?.orgId === selectedScope.value?.id
        ? selectedScope.value
        : undefined;
    Object.assign(
      draft,
      {
        tenantId: scope?.tenantId,
        orgId: scope?.orgId,
        processKey: '',
        workflowDefinitionVersionId: '',
        nodeKey: '',
        eventName: 'TaskCreated',
        channel: 'Station',
        priority: 100,
        forceOverride: false,
        enable: true,
        targetConfig: {},
        remark: '',
      },
      visibleResult,
    );
    const storedRef = result?.targetConfig?.configRef;
    configRef.value =
      typeof storedRef === 'string' &&
      validRobotConfigRef(storedRef, result?.tenantId)
        ? storedRef
        : '';
    robotGroupId.value = result?.targetConfig?.groupId || '';
    conditionText.value = JSON.stringify(result?.matchCondition || {}, null, 2);
    advancedKeys.value =
      result &&
      (result.processKey ||
        result.workflowDefinitionVersionId ||
        result.nodeKey ||
        result.priority !== 100 ||
        result.forceOverride ||
        Object.keys(result.matchCondition || {}).length > 0)
        ? ['advanced']
        : [];
    opened.value = true;
    if (!result && platformUser.value && formSetting('tenantId')?.defaultValue)
      void loadTenantOptions();
    void loadDefinitionOptions();
  } catch (error_) {
    notifyApiErrorOnce(error_);
  }
}
function changeChannel() {
  configRef.value = '';
  robotGroupId.value = '';
  draft.targetConfig = {};
}
// 匹配条件只保存有限的精确值JSON，不执行浏览器表达式或脚本。
function readCondition(
  text = conditionText.value,
): WorkflowNotificationRouteInput['matchCondition'] {
  if (text.length > 8192) throw new Error('匹配条件过长');
  const value = JSON.parse(text || '{}') as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('匹配条件必须是对象');
  const entries = Object.entries(value);
  if (entries.length > 50) throw new Error('匹配条件过多');
  const scalar = (item: unknown) =>
    ['boolean', 'number', 'string'].includes(typeof item);
  if (
    entries.some(
      ([key, item]) =>
        ['__proto__', 'constructor', 'prototype'].includes(key) ||
        !/^[\w.-]{1,128}$/.test(key) ||
        !(
          scalar(item) ||
          (Array.isArray(item) &&
            item.length <= 100 &&
            item.every((entry) => scalar(entry)))
        ),
    )
  )
    throw new Error('匹配条件只允许安全字段和精确值或值数组');
  return value as WorkflowNotificationRouteInput['matchCondition'];
}
async function save() {
  if (!canSave.value || busy.value) return;
  if (
    !channels.value.some((item) => item.value === draft.channel) ||
    !workflowNotificationEvents.some(
      (item) => item.value === draft.eventName,
    ) ||
    !Number.isInteger(draft.priority)
  ) {
    message.error('请选择有效渠道、事件和整数优先级');
    return;
  }
  if (
    isRobot.value &&
    formFieldVisible('targetConfig') &&
    !robotGroups.value.some((item) => item.value === robotGroupId.value) &&
    !validRobotConfigRef(configRef.value, formTenantId.value)
  ) {
    message.error('请选择当前范围内可用的机器人通知群');
    return;
  }
  let matchCondition;
  try {
    matchCondition = formFieldSubmittable('matchCondition')
      ? readCondition()
      : undefined;
  } catch (error_) {
    message.error(error_ instanceof Error ? error_.message : '匹配条件无效');
    return;
  }
  busy.value = true;
  const targetConfig: WorkflowNotificationRouteInput['targetConfig'] = {};
  if (isRobot.value && robotGroupId.value)
    targetConfig.groupId = robotGroupId.value;
  else if (isRobot.value) targetConfig.configRef = configRef.value;
  const data: WorkflowNotificationRouteInput = {
    tenantId: draft.tenantId,
    orgId: draft.orgId,
    processKey: draft.processKey || '',
    workflowDefinitionVersionId: draft.workflowDefinitionVersionId || '',
    nodeKey: draft.nodeKey || '',
    eventName: draft.eventName,
    channel: draft.channel,
    priority: draft.priority,
    forceOverride: draft.forceOverride,
    enable: draft.enable,
    remark: draft.remark || '',
    matchCondition,
    targetConfig,
  };
  try {
    // 仅提交仍有字段权限且未被表单展示配置隐藏的值，提交前重验授权快照。
    const operation = current.value ? 'update' : 'create';
    await quickAccess.ensure(operation);
    quickAccess.assertCheckpoint(formPolicyCheckpoint);
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([key]) => formFieldSubmittable(key)),
    );
    // 定位范围不能因字段隐藏或无权而静默删除，否则请求可能落入更宽范围。
    const scope = current.value
      ? routeRecordScope(current.value)
      : {
          ...(data.tenantId ? { tenantId: data.tenantId } : {}),
          ...(data.orgId ? { orgId: data.orgId } : {}),
        };
    for (const key of Object.keys(scope)) {
      const setting = formSetting(key);
      if (setting?.hidden && !setting.submitWhenHidden)
        throw new Error('业务范围字段已设为不提交，请先调整展示设置');
    }
    quickAccess.assertInput(operation, scope);
    for (const [key, label] of routeFormFields) {
      if (!formFieldSubmittable(key) || !formSetting(key)?.required) continue;
      const value = filtered[key];
      const empty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' &&
          !Array.isArray(value) &&
          Object.keys(value).length === 0);
      if (empty) throw new Error(`请填写${formFieldLabel(key, label)}`);
    }
    const payload = quickAccess.pruneInput(operation, {
      ...filtered,
      ...scope,
    }) as WorkflowNotificationRouteInput;
    for (const [key, value] of Object.entries(scope)) {
      if (({ ...payload } as Record<string, unknown>)[key] !== value)
        throw new Error('业务范围权限不可用，请重新确认');
    }
    quickAccess.assertValueAssignment(
      operation,
      { ...payload },
      { ...current.value },
    );
    quickAccess.assertInput(operation, payload);
    quickAccess.assertCheckpoint(formPolicyCheckpoint);
    await (current.value
      ? workflowNotificationRouteService.update({
          ...payload,
          id: current.value.id,
          optimisticLock: current.value.optimisticLock,
        })
      : workflowNotificationRouteService.create(payload));
    opened.value = false;
    await reloadList?.();
  } catch (error_) {
    notifyApiErrorOnce(error_);
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (
    !removing.value ||
    !canEditRecord(removing.value) ||
    !allowed('remove') ||
    busy.value
  )
    return;
  busy.value = true;
  try {
    await workflowNotificationRouteService.remove({
      ...routeRecordScope(removing.value),
      id: removing.value.id,
    });
    removing.value = undefined;
    await reloadList?.();
  } catch (error_) {
    notifyApiErrorOnce(error_);
  } finally {
    busy.value = false;
  }
}
// 查询和编辑共用同一份服务端枚举选项，失败时不补造渠道。
let channelsPromise: Promise<typeof channels.value> | undefined;
function loadChannels() {
  channelsPromise ??= moduleFetchEnumOptions(
    'com.levin.oak.base.entities.WorkflowNotificationRoute$Channel',
  )
    .then((options) => {
      channels.value = normalizeNotificationChannels(options);
      return channels.value;
    })
    .catch((error_) => {
      channelsPromise = undefined;
      error.value = getApiErrorMessage(error_);
      notifyApiErrorOnce(error_);
      throw error_;
    });
  return channelsPromise;
}
onMounted(() => {
  void loadChannels().catch(() => {});
});
</script>
<template>
  <div class="flex min-w-0 flex-col gap-2">
    <CrudPage :key="scopeGeneration" ref="crudPage" :config="crudConfig">
      <template #search-field-orgId="slot">
        <UserOrgSelector
          v-if="
            platformUser &&
            typeof searchScopeState(slot).tenantId === 'string' &&
            searchScopeState(slot).tenantId
          "
          :key="String(searchScopeState(slot).tenantId)"
          :model-value="scopeSelection(searchScopeState(slot))"
          :load-org-tree="
            () =>
              rbacService.fetchAuthorizedOrgTreeByTenant(
                String(searchScopeState(slot).tenantId),
              )
          "
          :selectable-types="['org']"
          value-mode="record"
          placeholder="选择授权组织"
          @update:selected-records="
            changeScope($event[0], searchScopeState(slot))
          "
        />
        <SupportScopeSelector
          v-else
          :model-value="scopeSelection(searchScopeState(slot))"
          placeholder="全部授权范围"
          @change="changeScope($event, searchScopeState(slot))"
        />
      </template>
      <template #toolbar-extra="{ isListOperationVisible }">
        <Button
          v-if="
            allowed('create') && isListOperationVisible('notification:create')
          "
          type="primary"
          @click="open()"
        >
          新增通知渠道
        </Button>
      </template>
      <template #table-cell-enable="slot">
        <Switch
          v-if="
            typeof tableCellRecord(slot).enable === 'boolean' &&
            Number.isInteger(tableCellRecord(slot).optimisticLock) &&
            canEditRecord(tableCellRecord(slot)) &&
            allowed('update') &&
            quickAccess.allowed('update', 'input', 'enable')
          "
          :checked="tableCellRecord(slot).enable"
          :loading="enableBusy.has(tableCellRecord(slot).id)"
          checked-children="启用"
          un-checked-children="禁用"
          @change="updateEnabled(tableCellRecord(slot), Boolean($event))"
        />
        <span v-else>{{
          tableCellRecord(slot).enable === true
            ? '启用'
            : tableCellRecord(slot).enable === false
              ? '禁用'
              : '—'
        }}</span>
      </template>
      <template #emptyText>
        <Empty
          description="当前范围暂无通知渠道；可点击“新增通知渠道”设置流程事件通知"
        />
      </template>
    </CrudPage>
    <Modal
      v-model:open="opened"
      :title="readOnly ? '通知渠道详情' : '通知渠道配置'"
      :footer="readOnly ? null : undefined"
      width="960px"
      :body-style="DEFAULT_CONTENT_MODAL_BODY_STYLE"
      :confirm-loading="busy"
      :mask-closable="false"
      @ok="save"
    >
      <Form
        :model="draft"
        :id="`workflow-notification-route-${readOnly ? 'detail' : current ? 'edit' : 'create'}`"
        :data-form-id="`workflow-notification-route-${readOnly ? 'detail' : current ? 'edit' : 'create'}`"
        :data-form-name="`工作流通知渠道${readOnly ? '详情' : current ? '编辑' : '新增'}`"
        :name="`workflowNotificationRoute${readOnly ? 'Detail' : current ? 'Edit' : 'Create'}`"
        layout="horizontal"
        :disabled="readOnly"
        class="grid gap-x-4"
        style="
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(100%, 400px), 1fr)
          );
        "
        :label-col="{ style: { width: '128px' } }"
        :wrapper-col="{ flex: 1 }"
      >
        <div
          class="col-span-full grid gap-x-4"
          style="
            grid-template-columns: repeat(
              auto-fit,
              minmax(min(100%, 400px), 1fr)
            );
          "
        >
          <template
            v-for="entry in formRegionLayout('basic')"
            :key="`${entry.kind}:${entry.key}`"
          >
            <div
              v-if="entry.kind === 'group'"
              class="col-span-full border-b py-2 font-medium"
            >
              {{ entry.title }}
            </div>
            <!-- 归属仅在新增时可选；查看与编辑均回显服务端读取的原归属。 -->
            <div v-if="entry.kind === 'field' && entry.key === 'tenantId'">
              <Form.Item
                v-if="platformUser && formFieldVisible('tenantId')"
                :label="formFieldLabel('tenantId', '归属租户')"
                :required="formSetting('tenantId')?.required === true"
                name="tenantId"
              >
                <span v-if="current" data-testid="route-tenant">{{
                  current.tenantName || current.tenantId || '平台'
                }}</span>
                <Select
                  v-else
                  data-testid="route-form-tenant"
                  :disabled="formFieldDisabled('tenantId') || !canBrowseTenants"
                  :value="draft.tenantId"
                  :options="formTenantOptions"
                  :filter-option="false"
                  allow-clear
                  show-search
                  placeholder="未选择时归属平台"
                  @focus="loadTenantOptions()"
                  @search="loadTenantOptions"
                  @update:value="
                    (value) =>
                      changeFormTenant(
                        value == null ? undefined : String(value),
                      )
                  "
                />
                <p
                  v-if="!current && !canBrowseTenants"
                  class="text-muted-foreground text-xs"
                >
                  当前账号无租户查询权限，可保留平台范围；如需选择租户请联系管理员。
                </p>
              </Form.Item>
            </div>
            <div v-if="entry.kind === 'field' && entry.key === 'orgId'">
              <Form.Item
                v-if="formFieldVisible('orgId')"
                :label="formFieldLabel('orgId', '归属组织')"
                :required="formSetting('orgId')?.required === true"
                name="orgId"
              >
                <span v-if="current" data-testid="route-org">{{
                  current.orgName || current.orgId || '未限定组织'
                }}</span>
                <UserOrgSelector
                  v-else
                  :key="formTenantId"
                  :disabled="
                    formFieldDisabled('orgId') ||
                    (platformUser && !formTenantId)
                  "
                  :model-value="formScopeRecord"
                  :load-org-tree="loadFormOrgTree"
                  :selectable-types="['org']"
                  value-mode="record"
                  placeholder="未选择时不限定组织"
                  @update:selected-records="changeFormOrganization"
                />
              </Form.Item>
            </div>
            <div v-if="entry.kind === 'field' && entry.key === 'eventName'">
              <Form.Item
                v-if="formFieldVisible('eventName')"
                :label="formFieldLabel('eventName', '发生事件')"
                name="eventName"
                required
              >
                <Select
                  v-model:value="draft.eventName"
                  :disabled="formFieldDisabled('eventName')"
                  :options="workflowNotificationEvents"
                  @change="changeEvent"
                />
              </Form.Item>
            </div>
            <div v-if="entry.kind === 'field' && entry.key === 'channel'">
              <Form.Item
                v-if="formFieldVisible('channel')"
                :label="formFieldLabel('channel', '通知方式')"
                name="channel"
                required
              >
                <Select
                  v-model:value="draft.channel"
                  :disabled="formFieldDisabled('channel')"
                  :options="channels"
                  @change="changeChannel"
                />
              </Form.Item>
            </div>
            <div
              v-if="entry.kind === 'field' && entry.key === 'processKey'"
              class="col-span-full"
            >
              <Form.Item
                v-if="formFieldVisible('processKey')"
                :label="formFieldLabel('processKey', '适用流程定义')"
                :required="formSetting('processKey')?.required === true"
                name="processKey"
                help="精确匹配所选流程；不选时匹配当前范围内的所有流程。"
              >
                <Select
                  data-testid="route-process"
                  :value="draft.processKey || undefined"
                  :options="definitionOptions"
                  :loading="definitionsLoading"
                  :disabled="
                    formFieldDisabled('processKey') ||
                    !canBrowseDefinitions ||
                    definitionsLoading
                  "
                  :filter-option="filterCrudLocalSelectOption"
                  allow-clear
                  show-search
                  placeholder="所有流程定义（默认）"
                  @update:value="
                    changeProcess(
                      typeof $event === 'string' ? $event : undefined,
                    )
                  "
                />
              </Form.Item>
            </div>
            <Alert
              v-if="
                entry.kind === 'field' &&
                entry.key === 'processKey' &&
                formFieldVisible('processKey') &&
                (!canBrowseDefinitions || definitionError)
              "
              class="col-span-full"
              type="info"
              :message="
                definitionError ||
                '当前账号没有流程定义查看权限，可保留默认的所有流程；如需指定流程，请联系管理员授予查看权限。'
              "
            />
            <div
              v-if="entry.kind === 'field' && entry.key === 'targetConfig'"
              class="col-span-full"
            >
              <Form.Item
                v-if="isRobot && formFieldVisible('targetConfig')"
                :label="formFieldLabel('targetConfig', '机器人通知群')"
                required
              >
                <Select
                  :value="robotGroupId || undefined"
                  :disabled="formFieldDisabled('targetConfig')"
                  :options="robotGroups"
                  :loading="robotGroupsLoading"
                  :filter-option="filterCrudLocalSelectOption"
                  show-search
                  allow-clear
                  placeholder="请选择已配置的机器人通知群"
                  @update:value="
                    robotGroupId = typeof $event === 'string' ? $event : ''
                  "
                  @change="configRef = ''"
                />
                <p
                  v-if="robotGroupsError"
                  class="text-muted-foreground text-xs"
                >
                  {{ robotGroupsError }}
                </p>
                <p
                  v-else-if="!robotGroupsLoading && robotGroups.length === 0"
                  class="text-muted-foreground text-xs"
                >
                  当前范围没有可用通知群，请先配置机器人通知群。
                </p>
                <p v-if="configRef" class="text-muted-foreground text-xs">
                  当前使用原有机器人目标；选择通知群后将改用所选通知群。
                </p>
              </Form.Item>
            </div>
            <Alert
              v-if="
                entry.kind === 'field' &&
                entry.key === 'targetConfig' &&
                isRobot &&
                formFieldVisible('targetConfig') &&
                !formTenantId
              "
              class="col-span-full"
              type="info"
              message="平台机器人路由不匹配租户工作流；租户流程须选择实际租户所属组织和同作用域目标。"
            />

            <div v-if="entry.kind === 'field' && entry.key === 'enable'">
              <Form.Item
                v-if="formFieldVisible('enable')"
                :label="formFieldLabel('enable', '是否启用')"
                :required="formSetting('enable')?.required === true"
                name="enable"
              >
                <Switch
                  v-model:checked="draft.enable"
                  :disabled="formFieldDisabled('enable')"
                />
              </Form.Item>
            </div>
            <div
              v-if="entry.kind === 'field' && entry.key === 'remark'"
              class="col-span-full"
            >
              <Form.Item
                v-if="formFieldVisible('remark')"
                :label="formFieldLabel('remark', '备注')"
                :required="formSetting('remark')?.required === true"
                name="remark"
              >
                <Input.TextArea
                  v-model:value="draft.remark"
                  :disabled="formFieldDisabled('remark')"
                  :maxlength="512"
                />
              </Form.Item>
            </div>
          </template>
        </div>
        <Collapse v-model:active-key="advancedKeys" class="col-span-full mb-4">
          <Collapse.Panel key="advanced" header="更多匹配设置（可选）">
            <div
              class="grid gap-x-4"
              style="
                grid-template-columns: repeat(
                  auto-fit,
                  minmax(min(100%, 400px), 1fr)
                );
              "
            >
              <p class="text-muted-foreground col-span-full text-xs">
                版本和节点都按所选值精确匹配，留空表示全部。优先级数值越小越先；覆盖会替代较低匹配层级的通知渠道。
              </p>
              <template
                v-for="entry in formRegionLayout('advanced')"
                :key="`${entry.kind}:${entry.key}`"
              >
                <div
                  v-if="entry.kind === 'group'"
                  class="col-span-full border-b py-2 font-medium"
                >
                  {{ entry.title }}
                </div>

                <div
                  v-if="
                    entry.kind === 'field' &&
                    entry.key === 'workflowDefinitionVersionId'
                  "
                >
                  <Form.Item
                    v-if="formFieldVisible('workflowDefinitionVersionId')"
                    :label="
                      formFieldLabel('workflowDefinitionVersionId', '适用版本')
                    "
                    :required="
                      formSetting('workflowDefinitionVersionId')?.required ===
                      true
                    "
                    name="workflowDefinitionVersionId"
                  >
                    <Select
                      data-testid="route-version"
                      :value="draft.workflowDefinitionVersionId || undefined"
                      :options="versionOptions"
                      :loading="versionsLoading"
                      :disabled="
                        formFieldDisabled('workflowDefinitionVersionId') ||
                        !draft.processKey ||
                        !canBrowseVersions ||
                        versionsLoading
                      "
                      :filter-option="filterCrudLocalSelectOption"
                      allow-clear
                      show-search
                      placeholder="全部版本（默认）"
                      @update:value="
                        changeVersion(
                          typeof $event === 'string' ? $event : undefined,
                        )
                      "
                    />
                  </Form.Item>
                </div>
                <div v-if="entry.kind === 'field' && entry.key === 'nodeKey'">
                  <Form.Item
                    v-if="formFieldVisible('nodeKey')"
                    :label="formFieldLabel('nodeKey', '适用节点')"
                    :required="formSetting('nodeKey')?.required === true"
                    name="nodeKey"
                  >
                    <Select
                      data-testid="route-node"
                      :value="draft.nodeKey || undefined"
                      :options="selectableNodes"
                      :disabled="
                        formFieldDisabled('nodeKey') ||
                        !draft.workflowDefinitionVersionId ||
                        !canReadVersion
                      "
                      :filter-option="filterCrudLocalSelectOption"
                      allow-clear
                      show-search
                      placeholder="全部节点（默认）"
                      @update:value="
                        draft.nodeKey = typeof $event === 'string' ? $event : ''
                      "
                    />
                  </Form.Item>
                </div>
                <div
                  v-if="entry.kind === 'field' && entry.key === 'forceOverride'"
                >
                  <Form.Item
                    v-if="formFieldVisible('forceOverride')"
                    :label="formFieldLabel('forceOverride', '强制覆盖')"
                    :required="formSetting('forceOverride')?.required === true"
                    name="forceOverride"
                    help="替代较低匹配层级的路由"
                  >
                    <Switch
                      v-model:checked="draft.forceOverride"
                      :disabled="formFieldDisabled('forceOverride')"
                    />
                  </Form.Item>
                </div>
                <div
                  v-if="
                    entry.kind === 'field' && entry.key === 'matchCondition'
                  "
                  class="col-span-full"
                >
                  <Form.Item
                    v-if="formFieldVisible('matchCondition')"
                    :label="
                      formFieldLabel('matchCondition', '附加条件（精确相等）')
                    "
                    :required="formSetting('matchCondition')?.required === true"
                    name="matchCondition"
                    help="留空匹配全部；只按字段值精确相等匹配，数组表示任一值。不支持大于、包含或脚本。"
                  >
                    <JsonEditorField
                      v-model="conditionValue"
                      :disabled="formFieldDisabled('matchCondition')"
                      title="精确匹配条件"
                    />
                  </Form.Item>
                </div>
                <div v-if="entry.kind === 'field' && entry.key === 'priority'">
                  <Form.Item
                    v-if="formFieldVisible('priority')"
                    :label="formFieldLabel('priority', '优先级')"
                    :required="formSetting('priority')?.required === true"
                    name="priority"
                    help="数值越小越先；默认 100 通常无需修改。"
                  >
                    <InputNumber
                      v-model:value="draft.priority"
                      :disabled="formFieldDisabled('priority')"
                      :precision="0"
                      :min="-2147483648"
                      :max="2147483647"
                    />
                  </Form.Item>
                </div>
              </template>
            </div>
          </Collapse.Panel>
        </Collapse>
      </Form>
    </Modal>
    <Modal
      :open="Boolean(removing)"
      title="删除通知渠道"
      :confirm-loading="busy"
      @cancel="removing = undefined"
      @ok="remove"
    >
      <p>确认删除此通知渠道配置？已产生的事件与投递记录保留。</p>
    </Modal>
  </div>
</template>
