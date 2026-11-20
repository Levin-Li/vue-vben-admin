<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type { WorkflowDefinitionRecord } from '../../api/workflow-definition-service';
import type { ManagedWorkflowVersion } from '../../api/workflow-definition-version-service';
import type {
  NotificationChannel,
  WorkflowNotificationRouteInput,
  WorkflowNotificationRouteRecord,
} from '../../api/workflow-notification-route-service';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import {
  getApiErrorMessage,
  notifyApiErrorOnce,
} from '@levin/admin-framework/framework-commons/app/api';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { DEFAULT_CONTENT_MODAL_BODY_STYLE } from '@levin/admin-framework/framework-commons/shared/config-helpers';
import { useCrudDataAttrAccess } from '@levin/admin-framework/framework-commons/shared/crud-data-attr-access';
import { canMutateCrudRecord } from '@levin/admin-framework/framework-commons/shared/crud-editable-access';
import { filterCrudLocalSelectOption } from '@levin/admin-framework/framework-commons/shared/crud-local-search';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
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
const crudPage = ref<{ reload: () => Promise<unknown> }>();
const reloadList = () => crudPage.value?.reload();
const canEditRecord = (record: WorkflowNotificationRouteRecord) =>
  canMutateCrudRecord(
    [{ key: 'editable', label: '可编辑' }],
    record,
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
      successMessage: false,
      reloadAfterAction: false,
    },
    {
      label: '编辑',
      displayKey: 'notification:update',
      handler: async (record: WorkflowNotificationRouteRecord) => open(record),
      visible: (record: WorkflowNotificationRouteRecord) =>
        canEditRecord(record) && allowed('update') && allowed('retrieve'),
      successMessage: false,
      reloadAfterAction: false,
    },
    {
      label: '删除',
      displayKey: 'notification:remove',
      danger: true,
      handler: async (record: WorkflowNotificationRouteRecord) => {
        if (canEditRecord(record) && allowed('remove')) removing.value = record;
      },
      visible: (record: WorkflowNotificationRouteRecord) =>
        canEditRecord(record) && allowed('remove'),
      successMessage: false,
      reloadAfterAction: false,
    },
  ],
}));
const quickPolicyConfig = computed(() => ({
  ...crudConfig.value,
  dataAttrTargets: {
    ...crudConfig.value.dataAttrTargets,
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
  (operation) => operation === 'update' && allowed('update'),
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
const configRef = ref('');
const definitions = ref<WorkflowDefinitionRecord[]>([]);
const versions = ref<ManagedWorkflowVersion[]>([]);
const nodeOptions = ref<{ label: string; value: string }[]>([]);
const definitionsLoading = ref(false);
const versionsLoading = ref(false);
const definitionError = ref('');
const canBrowseDefinitions = computed(() =>
  hasPermission(buildApiMethodPermissions(workflowDefinitionService, 'list')),
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
const robotTargetName = computed({
  get: () => {
    const prefix = formTenantId.value
      ? `tenant:${formTenantId.value}:`
      : 'platform:';
    return configRef.value.startsWith(prefix)
      ? configRef.value.slice(prefix.length)
      : '';
  },
  set: (name: string) => {
    const prefix = formTenantId.value
      ? `tenant:${formTenantId.value}:`
      : 'platform:';
    configRef.value = name.trim() ? `${prefix}${name.trim()}` : '';
  },
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
  nodeOptions.value = [];
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
  nodeOptions.value = [];
  if (!draft.workflowDefinitionVersionId || !canReadVersion.value) return;
  const versionId = draft.workflowDefinitionVersionId;
  try {
    const version = await workflowDefinitionVersionService.retrieve({
      id: versionId,
    });
    if (versionId !== draft.workflowDefinitionVersionId) return;
    const graph = version.lowflowDefinition as
      | undefined
      | { nodes?: Array<{ id: string; name: string; type?: string }> };
    nodeOptions.value = (graph?.nodes ?? [])
      .filter((node) => node.type === 'userTask' && node.id)
      .map((node) => ({ label: node.name || node.id, value: node.id }));
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
function changeFormTenant(value?: string) {
  if (current.value || !platformUser.value || value === draft.tenantId) return;
  draft.tenantId = value;
  draft.orgId = undefined;
  formScopeRecord.value = undefined;
  changeChannel();
}
function changeFormOrganization(records: UserOrgSelectorRecord[]) {
  if (current.value) return;
  const org = records[0];
  if (
    org &&
    (org.kind !== 'org' || (org.tenantId || undefined) !== formTenantId.value)
  )
    return;
  formScopeRecord.value = org;
  draft.orgId = org?.id;
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
      result,
    );
    const storedRef = result?.targetConfig?.configRef;
    configRef.value =
      typeof storedRef === 'string' &&
      validRobotConfigRef(storedRef, result?.tenantId)
        ? storedRef
        : '';
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
    void loadDefinitionOptions();
  } catch (error_) {
    notifyApiErrorOnce(error_);
  }
}
function changeChannel() {
  configRef.value = '';
  draft.targetConfig = {};
}
// 匹配条件只保存有限的精确值JSON，不执行浏览器表达式或脚本。
function readCondition(): WorkflowNotificationRouteInput['matchCondition'] {
  if (conditionText.value.length > 8192) throw new Error('匹配条件过长');
  const value = JSON.parse(conditionText.value || '{}') as unknown;
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
    !validRobotConfigRef(configRef.value, formTenantId.value)
  ) {
    message.error(
      '请填写管理员提供的同范围机器人目标名称（如 approval-alerts）',
    );
    return;
  }
  let matchCondition;
  try {
    matchCondition = readCondition();
  } catch (error_) {
    message.error(error_ instanceof Error ? error_.message : '匹配条件无效');
    return;
  }
  busy.value = true;
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
    targetConfig: isRobot.value ? { configRef: configRef.value } : {},
  };
  try {
    await (current.value
      ? workflowNotificationRouteService.update({
          ...data,
          id: current.value.id,
          optimisticLock: current.value.optimisticLock,
        })
      : workflowNotificationRouteService.create(data));
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
      <template #table-cell-enable="{ record }">
        <Switch
          v-if="
            typeof record.enable === 'boolean' &&
            Number.isInteger(record.optimisticLock) &&
            canEditRecord(record) &&
            allowed('update') &&
            quickAccess.allowed('update', 'input', 'enable')
          "
          :checked="record.enable"
          :loading="enableBusy.has(record.id)"
          checked-children="启用"
          un-checked-children="禁用"
          @change="
            updateEnabled(
              record as WorkflowNotificationRouteRecord,
              Boolean($event),
            )
          "
        />
        <span v-else>{{
          record.enable === true
            ? '启用'
            : record.enable === false
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
        <!-- 归属仅在新增时可选；查看与编辑均回显服务端读取的原归属。 -->
        <Form.Item v-if="platformUser" label="归属租户" name="tenantId">
          <span v-if="current" data-testid="route-tenant">{{
            current.tenantName || current.tenantId || '平台'
          }}</span>
          <Select
            v-else
            data-testid="route-form-tenant"
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
                changeFormTenant(value == null ? undefined : String(value))
            "
          />
        </Form.Item>
        <Form.Item label="归属组织" name="orgId">
          <span v-if="current" data-testid="route-org">{{
            current.orgName || current.orgId || '未限定组织'
          }}</span>
          <UserOrgSelector
            v-else
            :key="formTenantId"
            :disabled="platformUser && !formTenantId"
            :model-value="formScopeRecord"
            :load-org-tree="loadFormOrgTree"
            :selectable-types="['org']"
            value-mode="record"
            placeholder="未选择时不限定组织"
            @update:selected-records="changeFormOrganization"
          />
        </Form.Item>
        <Form.Item label="发生事件" name="eventName" required>
          <Select
            v-model:value="draft.eventName"
            :options="workflowNotificationEvents"
          />
        </Form.Item>
        <Form.Item label="通知方式" name="channel" required>
          <Select
            v-model:value="draft.channel"
            :options="channels"
            @change="changeChannel"
          />
        </Form.Item>
        <Form.Item
          label="适用流程定义"
          name="processKey"
          class="col-span-full"
          help="精确匹配所选流程；不选时匹配当前范围内的所有流程。"
        >
          <Select
            data-testid="route-process"
            :value="draft.processKey || undefined"
            :options="definitionOptions"
            :loading="definitionsLoading"
            :disabled="!canBrowseDefinitions || definitionsLoading"
            :filter-option="filterCrudLocalSelectOption"
            allow-clear
            show-search
            placeholder="所有流程定义（默认）"
            @update:value="
              changeProcess(typeof $event === 'string' ? $event : undefined)
            "
          />
        </Form.Item>
        <Alert
          v-if="!canBrowseDefinitions || definitionError"
          class="col-span-full"
          type="info"
          :message="
            definitionError ||
            '当前账号没有流程定义查看权限，可保留默认的所有流程；如需指定流程，请联系管理员授予查看权限。'
          "
        />
        <Form.Item
          v-if="isRobot"
          label="机器人目标名称"
          class="col-span-full"
          required
        >
          <Input
            v-model:value="robotTargetName"
            :maxlength="64"
            placeholder="管理员提供的目标名称，例如 approval-alerts"
          />
        </Form.Item>
        <Alert
          v-if="isRobot && !formTenantId"
          class="col-span-full"
          type="info"
          message="平台机器人路由不匹配租户工作流；租户流程须选择实际租户所属组织和同作用域目标。"
        />
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
              <Form.Item label="适用版本" name="workflowDefinitionVersionId">
                <Select
                  data-testid="route-version"
                  :value="draft.workflowDefinitionVersionId || undefined"
                  :options="versionOptions"
                  :loading="versionsLoading"
                  :disabled="
                    !draft.processKey || !canBrowseVersions || versionsLoading
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
              <Form.Item label="适用节点" name="nodeKey">
                <Select
                  data-testid="route-node"
                  :value="draft.nodeKey || undefined"
                  :options="selectableNodes"
                  :disabled="
                    !draft.workflowDefinitionVersionId || !canReadVersion
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
              <Form.Item
                label="强制覆盖"
                name="forceOverride"
                help="替代较低匹配层级的路由"
              >
                <Switch v-model:checked="draft.forceOverride" />
              </Form.Item>
              <Form.Item
                label="附加条件（精确相等）"
                name="matchCondition"
                class="col-span-full"
                help="留空匹配全部；只按字段值精确相等匹配，数组表示任一值。不支持大于、包含或脚本。"
              >
                <JsonEditorField
                  v-model="conditionValue"
                  :disabled="readOnly"
                  title="精确匹配条件"
                />
              </Form.Item>
              <Form.Item
                label="优先级"
                name="priority"
                help="数值越小越先；默认 100 通常无需修改。"
              >
                <InputNumber
                  v-model:value="draft.priority"
                  :precision="0"
                  :min="-2147483648"
                  :max="2147483647"
                />
              </Form.Item>
            </div>
          </Collapse.Panel>
        </Collapse>
        <Form.Item label="是否启用" name="enable">
          <Switch v-model:checked="draft.enable" />
        </Form.Item>
        <Form.Item label="备注" name="remark" class="col-span-full">
          <Input.TextArea v-model:value="draft.remark" :maxlength="512" />
        </Form.Item>
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
