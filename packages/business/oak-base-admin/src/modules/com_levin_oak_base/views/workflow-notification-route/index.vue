<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type {
  NotificationChannel,
  WorkflowNotificationRouteInput,
  WorkflowNotificationRouteRecord,
} from '../../api/workflow-notification-route-service';

import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import {
  getApiErrorMessage,
  notifyApiErrorOnce,
} from '@levin/admin-framework/framework-commons/app/api';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { DEFAULT_CONTENT_MODAL_BODY_STYLE } from '@levin/admin-framework/framework-commons/shared/config-helpers';
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
const platformUser = computed(() => isPlatformUser(user.userInfo));
const formScopeRecord = ref<UserOrgSelectorRecord>();
const tenantOptions = ref<{ label: string; value: string }[]>([]);
const readOnly = ref(false);
const scopeGeneration = ref(0);
const initialQuery = ref<Record<string, unknown>>({});
const error = ref('');
let queryState: Record<string, unknown> = {};
let reloadList: (() => Promise<unknown> | unknown) | undefined;
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
const crudConfig = computed(() =>
  createWorkflowNotificationRouteCrudConfig({
    apiService: { list: listRoutes },
    initialQuery: initialQuery.value,
    loadChannels,
  }),
);
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
    current.value?.editable !== false &&
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
    if ((params.channel && !channel) || (params.eventName && !eventName))
      throw new Error('通知渠道或流程事件已失效，请重新选择');
    const result = await workflowNotificationRouteService.list({
      ...currentScope(params),
      eventName,
      channel,
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
        (!viewOnly && (record.editable === false || !allowed('update')))
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
    if (version !== detailVersion || (!viewOnly && result?.editable === false))
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
    message.error('机器人目标必须与当前路由作用域的逻辑配置引用一致');
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
    removing.value.editable === false ||
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
    <CrudPage :key="scopeGeneration" :config="crudConfig">
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
      <template #toolbar-extra="{ loadList, isListOperationVisible }">
        <Button
          v-if="
            allowed('create') && isListOperationVisible('notification:create')
          "
          type="primary"
          @click="
            reloadList = loadList;
            open();
          "
        >
          新增通知路由
        </Button>
      </template>
      <template #row-actions="{ record, reload }">
        <Button
          v-if="allowed('retrieve')"
          size="small"
          type="link"
          @click="open(record as WorkflowNotificationRouteRecord, true)"
        >
          查看
        </Button>
        <Button
          v-if="
            record.editable !== false &&
            allowed('update') &&
            allowed('retrieve')
          "
          size="small"
          type="link"
          @click="
            reloadList = reload;
            open(record as WorkflowNotificationRouteRecord);
          "
        >
          编辑
        </Button>
        <Button
          v-if="record.editable !== false && allowed('remove')"
          size="small"
          type="link"
          @click="
            reloadList = reload;
            removing = record as WorkflowNotificationRouteRecord;
          "
        >
          删除
        </Button>
      </template>
      <template #emptyText>
        <Empty
          description="当前范围暂无通知路由；可点击“新增通知路由”配置工作流事件通知"
        />
      </template>
    </CrudPage>
    <Modal
      v-model:open="opened"
      :title="readOnly ? '工作流通知路由详情' : '工作流通知路由配置'"
      :footer="readOnly ? null : undefined"
      width="960px"
      :body-style="DEFAULT_CONTENT_MODAL_BODY_STYLE"
      :confirm-loading="busy"
      :mask-closable="false"
      @ok="save"
    >
      <Form
        id="workflow-notification-route-edit"
        data-form-id="workflow-notification-route-edit"
        data-form-name="工作流通知路由配置"
        name="workflowNotificationRouteEdit"
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
        <Alert
          class="col-span-full mb-4"
          type="info"
          message="基本配置：选择事件和渠道即可。留空的高级匹配字段表示当前业务范围内的默认路由。"
        />
        <!-- 归属仅在新增时可选；查看与编辑均回显服务端读取的原归属。 -->
        <Form.Item v-if="platformUser" label="归属租户">
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
        <Form.Item label="归属组织">
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
        <Form.Item label="事件" name="eventName" required>
          <Select
            v-model:value="draft.eventName"
            :options="workflowNotificationEvents"
          />
        </Form.Item>
        <Form.Item label="通知渠道" name="channel" required>
          <Select
            v-model:value="draft.channel"
            :options="channels"
            @change="changeChannel"
          />
        </Form.Item>
        <Form.Item
          v-if="isRobot"
          label="逻辑配置引用"
          name="configRef"
          class="col-span-full"
          required
        >
          <Input
            v-model:value="configRef"
            :maxlength="128"
            :placeholder="
              formTenantId
                ? 'tenant:租户标识:已部署目标名称'
                : 'platform:已部署目标名称'
            "
          />
          <p class="text-muted-foreground text-xs">
            先在服务端部署机器人目标，再填写 platform:目标名称 或
            tenant:当前租户标识:目标名称。不要填写 Webhook URL、token 或密钥。
          </p>
        </Form.Item>
        <Alert
          v-else
          class="col-span-full"
          type="info"
          message="接收人来自当前流程事件；不提供任意邮箱、角色或群目标输入。"
        />
        <Alert
          v-if="isRobot && !formTenantId"
          class="col-span-full"
          type="info"
          message="平台机器人路由不匹配租户工作流；租户流程须选择实际租户所属组织和同作用域目标。"
        />
        <Collapse v-model:active-key="advancedKeys" class="col-span-full mb-4">
          <Collapse.Panel key="advanced" header="高级匹配与覆盖（可选）">
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
                留空表示不限定流程、版本或节点。优先级只影响同类匹配规则的排序；强制覆盖会替代较低匹配层级的路由。
              </p>
              <Form.Item label="流程标识" name="processKey">
                <Input
                  v-model:value="draft.processKey"
                  :maxlength="128"
                  placeholder="留空匹配当前范围内所有流程"
                />
              </Form.Item>
              <Form.Item
                label="定义版本标识"
                name="workflowDefinitionVersionId"
              >
                <Input
                  v-model:value="draft.workflowDefinitionVersionId"
                  :maxlength="64"
                  placeholder="留空匹配所有版本"
                />
              </Form.Item>
              <Form.Item label="节点标识" name="nodeKey">
                <Input
                  v-model:value="draft.nodeKey"
                  :maxlength="128"
                  placeholder="留空匹配所有节点"
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
                label="匹配条件"
                name="matchCondition"
                class="col-span-full"
                help="仅 JSON 精确值，不执行表达式"
              >
                <JsonEditorField
                  v-model="conditionValue"
                  :disabled="readOnly"
                  title="精确匹配条件"
                />
              </Form.Item>
            </div>
          </Collapse.Panel>
        </Collapse>
        <p class="text-muted-foreground col-span-full text-xs">
          通知内容使用服务端固定安全模板。
        </p>
        <Form.Item label="优先级" name="priority" required>
          <InputNumber
            v-model:value="draft.priority"
            :precision="0"
            :min="-2147483648"
            :max="2147483647"
          />
        </Form.Item>
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
      title="删除通知路由"
      :confirm-loading="busy"
      @cancel="removing = undefined"
      @ok="remove"
    >
      <p>确认删除此路由配置？已产生的事件与投递记录保留。</p>
    </Modal>
  </div>
</template>
