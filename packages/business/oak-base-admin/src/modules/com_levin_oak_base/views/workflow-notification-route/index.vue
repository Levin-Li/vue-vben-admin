<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type { SupportScope } from '../../api/support-workbench-types';
import type {
  NotificationChannel,
  WorkflowNotificationEventName,
  WorkflowNotificationRouteInput,
  WorkflowNotificationRouteRecord,
} from '../../api/workflow-notification-route-service';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  Table,
} from 'ant-design-vue';

import { workflowNotificationRouteService } from '../../api/workflow-notification-route-service';
import { moduleFetchEnumOptions } from '../api-module';
import SupportScopeSelector from '../support-scope-selector.vue';
import {
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
const scope = ref<SupportScope>();
const rows = ref<WorkflowNotificationRouteRecord[]>([]);
const pageIndex = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const filterChannel = ref<NotificationChannel>();
const filterEvent = ref<WorkflowNotificationEventName>();
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
const conditionText = ref('{}');
const isRobot = computed(() => robotWebhookChannels.includes(draft.channel));
const canSave = computed(() => allowed(current.value ? 'update' : 'create'));
const channelLabel = (value: string) =>
  channels.value.find((item) => item.value === value)?.label || '渠道不可用';
const eventLabel = (value: string) =>
  workflowNotificationEvents.find((item) => item.value === value)?.label ||
  '事件不可用';
const columns = [
  { title: '流程标识', dataIndex: 'processKey' },
  { title: '节点标识', dataIndex: 'nodeKey' },
  { title: '事件', key: 'event' },
  { title: '渠道', key: 'channel' },
  { title: '优先级', dataIndex: 'priority' },
  { title: '是否启用', key: 'enable' },
  { title: '操作', key: 'actions' },
];
let listVersion = 0;
let detailVersion = 0;
async function load(page = pageIndex.value) {
  const version = ++listVersion;
  rows.value = [];
  error.value = '';
  if (!allowed('list')) return;
  loading.value = true;
  try {
    const result = await workflowNotificationRouteService.list({
      ...scope.value,
      eventName: filterEvent.value,
      channel: filterChannel.value,
      pageIndex: page,
      pageSize: 20,
    });
    if (version !== listVersion) return;
    rows.value = result.items;
    pageIndex.value = page;
    total.value = result.totals;
  } catch {
    if (version === listVersion) error.value = '工作流通知路由不可访问';
  } finally {
    if (version === listVersion) loading.value = false;
  }
}
function changeScope(record?: UserOrgSelectorRecord) {
  scope.value =
    record?.kind === 'org' && record.tenantId
      ? { tenantId: record.tenantId, orgId: record.id }
      : undefined;
  detailVersion += 1;
  opened.value = false;
  current.value = undefined;
  removing.value = undefined;
  void load(1);
}
async function open(record?: WorkflowNotificationRouteRecord) {
  const version = ++detailVersion;
  if (record ? !allowed('retrieve') || !allowed('update') : !allowed('create'))
    return;
  try {
    const result = record
      ? await workflowNotificationRouteService.retrieve({
          ...scope.value,
          id: record.id,
        })
      : undefined;
    if (version !== detailVersion) return;
    current.value = result;
    Object.assign(
      draft,
      {
        tenantId: scope.value?.tenantId,
        orgId: scope.value?.orgId,
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
    opened.value = true;
  } catch {
    message.error('路由详情不可访问或已失效');
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
  if (isRobot.value && !validRobotConfigRef(configRef.value, draft.tenantId)) {
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
    await load();
  } catch {
    message.error('路由保存失败，请刷新核对权限、范围和版本');
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (!removing.value || !allowed('remove') || busy.value) return;
  busy.value = true;
  try {
    await workflowNotificationRouteService.remove({
      ...scope.value,
      id: removing.value.id,
    });
    removing.value = undefined;
    await load();
  } catch {
    message.error('删除失败，请刷新核对权限和范围');
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  try {
    channels.value = normalizeNotificationChannels(
      await moduleFetchEnumOptions(
        'com.levin.oak.base.entities.WorkflowNotificationRoute$Channel',
      ),
    );
  } catch {
    error.value = '通知渠道选项加载失败';
  }
  await load(1);
});
</script>
<template>
  <Page title="工作流通知路由">
    <div class="bg-card grid gap-4 rounded-lg p-4">
      <SupportScopeSelector
        placeholder="选择流程通知适用组织"
        @change="changeScope"
      />
      <Alert
        type="info"
        message="站内与邮箱使用引擎确定的精确接收人；群机器人只配置对应作用域逻辑引用，部署秘密由服务器解析。"
      />
      <Alert v-if="error" :message="error" type="error" />
      <div class="flex flex-wrap gap-2">
        <Select
          v-model:value="filterChannel"
          class="w-48"
          :options="channels"
          allow-clear
          placeholder="通知渠道"
          @change="load(1)"
        />
        <Select
          v-model:value="filterEvent"
          class="w-48"
          :options="workflowNotificationEvents"
          allow-clear
          placeholder="流程事件"
          @change="load(1)"
        />
        <Button v-if="allowed('create')" type="primary" @click="open()">
          新增通知路由
        </Button>
        <Button v-if="allowed('list')" @click="load()">刷新</Button>
      </div>
      <Table
        row-key="id"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="{ current: pageIndex, pageSize: 20, total }"
        @change="load($event.current)"
      >
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'event'">{{
            eventLabel(record.eventName)
          }}</span>
          <span v-if="column.key === 'channel'">{{
            channelLabel(record.channel)
          }}</span>
          <span v-if="column.key === 'enable'">{{
            record.enable ? '已启用' : '已停用'
          }}</span>
          <template v-if="column.key === 'actions'">
            <Button
              v-if="
                record.editable !== false &&
                allowed('update') &&
                allowed('retrieve')
              "
              type="link"
              @click="open(record as WorkflowNotificationRouteRecord)"
            >
              编辑
            </Button>
            <Button
              v-if="record.editable !== false && allowed('remove')"
              type="link"
              @click="removing = record as WorkflowNotificationRouteRecord"
            >
              删除
            </Button>
          </template>
        </template>
      </Table>
      <Modal
        v-model:open="opened"
        title="工作流通知路由配置"
        :confirm-loading="busy"
        @ok="save"
      >
        <Form layout="vertical">
          <Form.Item label="流程标识">
            <Input
              v-model:value="draft.processKey"
              :maxlength="128"
              placeholder="留空表示当前范围默认路由"
            />
          </Form.Item>
          <Form.Item label="定义版本标识">
            <Input
              v-model:value="draft.workflowDefinitionVersionId"
              :maxlength="64"
              placeholder="可空，仅匹配指定的定义版本"
            />
          </Form.Item>
          <Form.Item label="节点标识">
            <Input
              v-model:value="draft.nodeKey"
              :maxlength="128"
              placeholder="可空，仅匹配指定BPMN节点"
            />
          </Form.Item>
          <Form.Item label="事件" required>
            <Select
              v-model:value="draft.eventName"
              :options="workflowNotificationEvents"
            />
          </Form.Item>
          <Form.Item label="通知渠道" required>
            <Select
              v-model:value="draft.channel"
              :options="channels"
              @change="changeChannel"
            />
          </Form.Item>
          <Form.Item v-if="isRobot" label="逻辑配置引用" required>
            <Input
              v-model:value="configRef"
              :maxlength="128"
              :placeholder="
                draft.tenantId
                  ? 'tenant:租户标识:已部署目标名称'
                  : 'platform:已部署目标名称'
              "
            />
            <p class="text-muted-foreground text-xs">
              只填写配置标识，不填写Webhook URL、token或加签秘密。
            </p>
          </Form.Item>
          <Alert
            v-else
            type="info"
            message="接收人来自当前流程事件；不提供任意邮箱、角色或群目标输入。"
          />
          <Alert
            v-if="isRobot && !draft.tenantId"
            type="info"
            message="平台机器人路由不匹配租户工作流；租户流程须选择实际租户所属组织和同作用域目标。"
          />
          <Form.Item label="优先级" required>
            <InputNumber
              v-model:value="draft.priority"
              :precision="0"
              :min="-2147483648"
              :max="2147483647"
            />
          </Form.Item>
          <Form.Item label="同作用域强制覆盖">
            <Switch v-model:checked="draft.forceOverride" />
          </Form.Item>
          <Form.Item label="是否启用">
            <Switch v-model:checked="draft.enable" />
          </Form.Item>
          <Form.Item label="精确匹配条件">
            <Input.TextArea
              v-model:value="conditionText"
              :maxlength="8192"
              :rows="4"
              placeholder="仅JSON对象，值为精确值或值数组；不执行表达式"
            />
          </Form.Item>
          <Form.Item label="通知模板">
            <Input value="服务端固定安全模板（不可编辑）" disabled />
          </Form.Item>
          <Form.Item label="备注">
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
  </Page>
</template>
