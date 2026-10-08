<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type {
  MailboxConfig,
  MailboxRecord,
  SupportScope,
} from '../../api/support-workbench-types';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Alert,
  Button,
  Form,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { supportMailboxRuleService } from '../../api/support-mailbox-rule-service';
import { ticketQueueService } from '../../api/ticket-queue-service';
import { userService } from '../../api/user-service';
import { moduleFetchEnumOptions, moduleFetchOptions } from '../api-module';
import {
  buildMailboxSourceQuery,
  buildSupportUserQuery,
  usableMailboxSource,
} from '../support-options';
import SupportScopeSelector from '../support-scope-selector.vue';

// 保存只提交受控配置对象；启停使用独立命令与读取时的版本。
const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(supportMailboxRuleService, method));
const scope = ref<SupportScope>();
const rows = ref<MailboxRecord[]>([]);
const currentRecord = ref<MailboxRecord>();
const pageIndex = ref(1);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const editing = ref(false);
const draft = reactive<MailboxConfig>({
  email: '',
  inboundChannel: '',
  queueId: '',
  defaultPriority: '',
});
const channels = ref<{ label: string; value: string }[]>([]);
const priorities = ref<{ label: string; value: string }[]>([]);
const queues = ref<{ label: string; value: string }[]>([]);
const users = ref<{ label: string; value: string }[]>([]);
const sources = ref<{ label: string; value: string }[]>([]);
const canSave = computed(
  () =>
    allowed(currentRecord.value ? 'update' : 'create') && Boolean(scope.value),
);
const columns = [
  { title: '邮箱地址', dataIndex: 'email' },
  { title: '入站通道', key: 'inboundChannel' },
  { title: '受理队列', dataIndex: 'queueId' },
  { title: '启用状态', key: 'enabled' },
  { title: '操作', key: 'actions' },
];
let version = 0;
async function load(page = pageIndex.value) {
  const current = ++version;
  rows.value = [];
  error.value = '';
  if (!scope.value || !allowed('list')) return;
  loading.value = true;
  try {
    const result = await supportMailboxRuleService.list({
      ...scope.value,
      pageIndex: page,
      pageSize: 20,
    });
    if (current !== version) return;
    rows.value = result.items;
    total.value = result.totals;
    pageIndex.value = page;
  } catch {
    if (current === version) error.value = '受理邮箱加载失败';
  } finally {
    if (current === version) loading.value = false;
  }
}
function changeScope(record?: UserOrgSelectorRecord) {
  scope.value =
    record?.kind === 'org' && record.tenantId
      ? { tenantId: record.tenantId, orgId: record.id }
      : undefined;
  editing.value = false;
  currentRecord.value = undefined;
  queues.value = [];
  users.value = [];
  sources.value = [];
  total.value = 0;
  void load(1);
}
async function open(record?: MailboxRecord) {
  if (!scope.value) return;
  const selected = JSON.stringify(scope.value);
  try {
    const result = record
      ? await supportMailboxRuleService.retrieve({
          ...scope.value,
          id: record.id,
        })
      : undefined;
    if (JSON.stringify(scope.value) !== selected) return;
    currentRecord.value = result;
    Object.assign(
      draft,
      {
        email: '',
        inboundChannel: '',
        queueId: '',
        defaultPriority: '',
        mailDomainId: undefined,
        emailRelayRouteId: undefined,
        defaultAssigneeId: undefined,
        defaultOrgId: undefined,
        outboundConfigRef: undefined,
      },
      currentRecord.value,
    );
    editing.value = true;
  } catch {
    message.error('规则详情不可访问');
  }
}
async function searchQueues(code = '') {
  if (!scope.value) return;
  const selected = JSON.stringify(scope.value);
  try {
    const result = await ticketQueueService.list({
      ...scope.value,
      pageIndex: 1,
      pageSize: 100,
      ...(code ? { code } : {}),
    });
    if (JSON.stringify(scope.value) !== selected) return;
    queues.value = result.items
      .filter((item) => item.enabled)
      .map((item) => ({
        value: item.id,
        label: `${item.name} (${item.code})`,
      }));
  } catch {
    message.error('受理队列不可访问');
  }
}
async function searchUsers(containsName = '') {
  if (!scope.value) return;
  const selected = JSON.stringify(scope.value);
  try {
    const result = (await userService.list(
      buildSupportUserQuery(scope.value, containsName),
    )) as { items: { id: string; name?: string; realName?: string }[] };
    if (JSON.stringify(scope.value) !== selected) return;
    users.value = (result.items || []).map(
      (item: { id: string; name?: string; realName?: string }) => ({
        value: item.id,
        label: item.realName || item.name || item.id,
      }),
    );
  } catch {
    message.error('处理人不可访问');
  }
}
async function searchSources(search = '') {
  if (!scope.value || !draft.inboundChannel) return;
  const channel = draft.inboundChannel;
  const local = channel === 'LocalSmtp';
  const selected = JSON.stringify(scope.value);
  try {
    const result = await moduleFetchOptions(
      local ? '/Domain/list' : '/EmailRelayRoute/list',
      'name',
      'id',
      buildMailboxSourceQuery(scope.value, local, search),
    );
    if (JSON.stringify(scope.value) !== selected) return;
    if (draft.inboundChannel !== channel) return;
    sources.value = result
      .filter((item) => usableMailboxSource(item, local, scope.value?.tenantId))
      .map((item) => ({
        label: item.label,
        value: String(item.value),
      }));
  } catch {
    message.error('邮件来源不可访问');
  }
}
function changeChannel() {
  draft.mailDomainId = undefined;
  draft.emailRelayRouteId = undefined;
  sources.value = [];
}
async function save() {
  if (!scope.value || !canSave.value || saving.value) return;
  if (
    !draft.email.trim() ||
    !draft.queueId ||
    !draft.inboundChannel ||
    !draft.defaultPriority ||
    (draft.inboundChannel === 'LocalSmtp'
      ? !draft.mailDomainId
      : !draft.emailRelayRouteId)
  ) {
    message.error('请填写邮箱地址并选择通道、入站来源、队列和优先级');
    return;
  }
  saving.value = true;
  const config: MailboxConfig = {
    email: draft.email,
    inboundChannel: draft.inboundChannel,
    queueId: draft.queueId,
    defaultPriority: draft.defaultPriority,
    mailDomainId:
      draft.inboundChannel === 'LocalSmtp' ? draft.mailDomainId : undefined,
    emailRelayRouteId:
      draft.inboundChannel === 'ForwardEmail'
        ? draft.emailRelayRouteId
        : undefined,
    defaultAssigneeId: draft.defaultAssigneeId || undefined,
    defaultOrgId: scope.value.orgId,
    outboundConfigRef: draft.outboundConfigRef || undefined,
  };
  try {
    await (currentRecord.value
      ? supportMailboxRuleService.update({
          ...scope.value,
          id: currentRecord.value.id,
          optimisticLock: currentRecord.value.optimisticLock,
          config,
        })
      : supportMailboxRuleService.create({ ...scope.value, config }));
    editing.value = false;
    await load();
  } catch {
    message.error('保存失败，请核对邮箱来源、队列和版本');
  } finally {
    saving.value = false;
  }
}
async function switchEnabled(record: MailboxRecord) {
  if (!scope.value) return;
  const method = record.enabled ? 'disable' : 'enable';
  if (!allowed(method)) return;
  try {
    await supportMailboxRuleService[method]({
      ...scope.value,
      id: record.id,
      optimisticLock: record.optimisticLock,
    });
    await load();
  } catch {
    message.error('启停失败，请刷新并核对受理配置');
  }
}
onMounted(async () => {
  try {
    const [channelOptions, priorityOptions] = await Promise.all([
      moduleFetchEnumOptions(
        'com.levin.oak.base.entities.Inbox$InboundChannel',
      ),
      moduleFetchEnumOptions('com.levin.oak.base.entities.Ticket$Priority'),
    ]);
    channels.value = channelOptions.map((item) => ({
      label: item.label,
      value: String(item.value),
    }));
    priorities.value = priorityOptions.map((item) => ({
      label: item.label,
      value: String(item.value),
    }));
  } catch {
    error.value = '配置选项加载失败，请刷新';
  }
});
</script>
<template>
  <Page title="支持邮箱受理规则">
    <div class="bg-card grid gap-4 rounded-lg p-4">
      <SupportScopeSelector @change="changeScope" />
      <Alert v-if="!scope" type="info" message="请选择授权受理组织" />
      <Alert v-if="error" type="error" :message="error" />
      <div class="flex gap-2">
        <Button
          v-if="allowed('create')"
          :disabled="!scope"
          type="primary"
          @click="open()"
        >
          创建受理邮箱
        </Button>
        <Button v-if="allowed('list')" :disabled="!scope" @click="load()">
          刷新
        </Button>
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
          <span v-if="column.key === 'inboundChannel'">{{
            channels.find((item) => item.value === record.inboundChannel)
              ?.label || '通道不可用'
          }}</span>
          <Tag v-if="column.key === 'enabled'">
            {{ record.enabled ? '已启用' : '已停用' }}
          </Tag>
          <template v-if="column.key === 'actions'">
            <Button
              v-if="!record.enabled && allowed('retrieve') && allowed('update')"
              type="link"
              @click="open(record as MailboxRecord)"
            >
              修改
            </Button>
            <Button
              v-if="allowed(record.enabled ? 'disable' : 'enable')"
              type="link"
              @click="switchEnabled(record as MailboxRecord)"
            >
              {{ record.enabled ? '停用' : '启用' }}
            </Button>
          </template>
        </template>
      </Table>
      <Modal
        v-model:open="editing"
        title="支持邮箱配置"
        :confirm-loading="saving"
        @ok="save"
      >
        <Form layout="vertical">
          <Form.Item label="支持邮箱地址" required>
            <Input
              v-model:value="draft.email"
              :maxlength="256"
              placeholder="support@example.com"
            />
          </Form.Item>
          <Form.Item label="入站通道" required>
            <Select
              v-model:value="draft.inboundChannel"
              :options="channels"
              @change="changeChannel"
            />
          </Form.Item>
          <Form.Item
            :label="
              draft.inboundChannel === 'LocalSmtp' ? '收件域名' : '中转路由'
            "
            required
          >
            <Select
              v-if="draft.inboundChannel === 'LocalSmtp'"
              v-model:value="draft.mailDomainId"
              show-search
              :filter-option="false"
              :options="sources"
              @search="searchSources"
              @focus="searchSources()"
            />
            <Select
              v-else
              v-model:value="draft.emailRelayRouteId"
              show-search
              :filter-option="false"
              :options="sources"
              @search="searchSources"
              @focus="searchSources()"
            />
          </Form.Item>
          <Form.Item label="受理队列" required>
            <Select
              v-model:value="draft.queueId"
              show-search
              :filter-option="false"
              :options="queues"
              placeholder="按队列编码查询"
              @search="searchQueues"
              @focus="searchQueues()"
            />
          </Form.Item>
          <Form.Item label="默认处理人">
            <Select
              v-model:value="draft.defaultAssigneeId"
              allow-clear
              show-search
              :filter-option="false"
              :options="users"
              @search="searchUsers"
              @focus="searchUsers()"
            />
          </Form.Item>
          <Form.Item label="默认优先级" required>
            <Select
              v-model:value="draft.defaultPriority"
              :options="priorities"
            />
          </Form.Item>
          <Form.Item label="受控外发配置引用">
            <Input
              v-model:value="draft.outboundConfigRef"
              :maxlength="128"
              placeholder="同租户已授权配置标识，可留空"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  </Page>
</template>
