<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type {
  MailboxConfig,
  MailboxRecord,
  SupportScope,
} from '../../api/support-workbench-types';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { Button, Form, Input, message, Modal, Select } from 'ant-design-vue';

import { supportMailboxSettingService } from '../../api/support-mailbox-setting-service';
import { ticketQueueService } from '../../api/ticket-queue-service';
import { userService } from '../../api/user-service';
import { helpDocumentUrl } from '../../help-center';
import { moduleFetchEnumOptions, moduleFetchOptions } from '../api-module';
import {
  buildMailboxSourceQuery,
  buildSupportUserQuery,
  usableMailboxSource,
} from '../support-options';
import SupportScopeSelector from '../support-scope-selector.vue';
import { createSupportMailboxSettingCrudConfig } from './config';

// 保存只提交受控配置对象；启停使用独立命令与读取时的版本。
const { hasPermission } = useRbacAccess();
const router = useRouter();
const allowed = (method: string) =>
  hasPermission(
    buildApiMethodPermissions(supportMailboxSettingService, method),
  );
const selectedScopeRecord = ref<UserOrgSelectorRecord>();
const scope = ref<SupportScope>();
const selectedFormScopeRecord = ref<UserOrgSelectorRecord>();
const formScope = computed<SupportScope | undefined>(() => {
  const record = selectedFormScopeRecord.value;
  return record?.kind === 'org' && record.tenantId
    ? { tenantId: record.tenantId, orgId: record.id }
    : undefined;
});
let formScopeGeneration = 0;
const scopeGeneration = ref(0);
const crudPage = ref<{ reload: () => Promise<void> }>();
const currentRecord = ref<MailboxRecord>();
const saving = ref(false);
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
const canSave = computed(() =>
  allowed(currentRecord.value ? 'update' : 'create'),
);
// 列表查询范围与创建表单归属分别维护，避免把筛选操作当作创建前提。
const pageConfig = computed(() => ({
  ...createSupportMailboxSettingCrudConfig({
    list: listRules,
    channelLabel: (value) =>
      channels.value.find((item) => item.value === value)?.label ||
      '通道不可用',
  }),
  defaultQuery: { pageIndex: 1, pageSize: 20, orgId: scope.value?.orgId },
}));
let listVersion = 0;
async function listRules(params: Record<string, unknown> = {}) {
  const current = ++listVersion;
  if (!scope.value || !allowed('list')) return { items: [], totals: 0 };
  const selected = JSON.stringify(scope.value);
  const result = await supportMailboxSettingService.list({
    ...scope.value,
    pageIndex: Math.max(1, Number(params.pageIndex) || 1),
    pageSize: Math.min(100, Math.max(1, Number(params.pageSize) || 20)),
    ...(typeof params.enabled === 'boolean' ? { enabled: params.enabled } : {}),
  });
  return current === listVersion && JSON.stringify(scope.value) === selected
    ? result
    : { items: [], totals: 0 };
}
async function reloadList() {
  await crudPage.value?.reload();
}
function changeScope(record?: UserOrgSelectorRecord) {
  selectedScopeRecord.value = record;
  scope.value =
    record?.kind === 'org' && record.tenantId
      ? { tenantId: record.tenantId, orgId: record.id }
      : undefined;
  editing.value = false;
  currentRecord.value = undefined;
  selectedFormScopeRecord.value = undefined;
  formScopeGeneration += 1;
  queues.value = [];
  users.value = [];
  sources.value = [];
  listVersion += 1;
  scopeGeneration.value += 1;
}
function changeFormScope(record?: UserOrgSelectorRecord) {
  if (currentRecord.value) return;
  if (
    record?.id === selectedFormScopeRecord.value?.id &&
    record?.tenantId === selectedFormScopeRecord.value?.tenantId
  )
    return;
  selectedFormScopeRecord.value = record;
  formScopeGeneration += 1;
  draft.email = '';
  draft.queueId = '';
  draft.defaultAssigneeId = undefined;
  draft.mailDomainId = undefined;
  draft.emailRelayRouteId = undefined;
  draft.outboundConfigRef = undefined;
  queues.value = [];
  users.value = [];
  sources.value = [];
}
async function open(record?: MailboxRecord) {
  const selected = JSON.stringify(scope.value);
  try {
    let result: MailboxRecord | undefined;
    if (record) {
      const selectedScope = scope.value;
      if (!selectedScope) return;
      result = await supportMailboxSettingService.retrieve({
        ...selectedScope,
        id: record.id,
      });
    }
    if (JSON.stringify(scope.value) !== selected) return;
    currentRecord.value = result;
    selectedFormScopeRecord.value = selectedScopeRecord.value;
    formScopeGeneration += 1;
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
    message.error('客服邮箱设置不可访问');
  }
}
async function searchQueues(code = '') {
  const selected = formScope.value;
  if (!selected) return;
  const generation = formScopeGeneration;
  try {
    const result = await ticketQueueService.list({
      ...selected,
      pageIndex: 1,
      pageSize: 100,
      ...(code ? { code } : {}),
    });
    if (generation !== formScopeGeneration) return;
    queues.value = result.items
      .filter((item) => item.enabled)
      .map((item) => ({
        value: item.id,
        label: `${item.name} (${item.code})`,
      }));
  } catch {
    if (generation === formScopeGeneration) message.error('工单队列不可访问');
  }
}
async function searchUsers(containsName = '') {
  const selected = formScope.value;
  if (!selected) return;
  const generation = formScopeGeneration;
  try {
    const result = (await userService.list(
      buildSupportUserQuery(selected, containsName),
    )) as { items: { id: string; name?: string; realName?: string }[] };
    if (generation !== formScopeGeneration) return;
    users.value = (result.items || []).map(
      (item: { id: string; name?: string; realName?: string }) => ({
        value: item.id,
        label: item.realName || item.name || item.id,
      }),
    );
  } catch {
    if (generation === formScopeGeneration) message.error('处理人不可访问');
  }
}
async function searchSources(search = '') {
  const selected = formScope.value;
  if (!selected || !draft.inboundChannel) return;
  const channel = draft.inboundChannel;
  const local = channel === 'LocalSmtp';
  const generation = formScopeGeneration;
  try {
    const result = await moduleFetchOptions(
      local ? '/Domain/list' : '/EmailRelayRoute/list',
      'name',
      'id',
      buildMailboxSourceQuery(selected, local, search),
    );
    if (generation !== formScopeGeneration) return;
    if (draft.inboundChannel !== channel) return;
    sources.value = result
      .filter((item) => usableMailboxSource(item, local, selected.tenantId))
      .map((item) => ({
        label: item.label,
        value: String(item.value),
      }));
  } catch {
    if (generation === formScopeGeneration) message.error('邮件来源不可访问');
  }
}
function changeChannel() {
  draft.mailDomainId = undefined;
  draft.emailRelayRouteId = undefined;
  sources.value = [];
}
async function save() {
  if (!canSave.value || saving.value) return;
  const selected = formScope.value;
  const generation = formScopeGeneration;
  if (!selected) {
    message.error('请选择负责处理邮件的组织');
    return;
  }
  if (
    !draft.email.trim() ||
    !draft.queueId ||
    !draft.inboundChannel ||
    !draft.defaultPriority ||
    (draft.inboundChannel === 'LocalSmtp'
      ? !draft.mailDomainId
      : !draft.emailRelayRouteId)
  ) {
    message.error(
      '请填写客服邮箱地址，并选择收件方式、收件来源、工单队列和优先级',
    );
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
    defaultOrgId: selected.orgId,
    outboundConfigRef: draft.outboundConfigRef || undefined,
  };
  try {
    await (currentRecord.value
      ? supportMailboxSettingService.update({
          ...selected,
          id: currentRecord.value.id,
          optimisticLock: currentRecord.value.optimisticLock,
          config,
        })
      : supportMailboxSettingService.create({ ...selected, config }));
    if (generation !== formScopeGeneration) return;
    editing.value = false;
    if (
      !currentRecord.value &&
      selectedFormScopeRecord.value?.id !== scope.value?.orgId
    ) {
      changeScope(selectedFormScopeRecord.value);
    } else {
      await reloadList();
    }
  } catch {
    if (generation === formScopeGeneration)
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
    await supportMailboxSettingService[method]({
      ...scope.value,
      id: record.id,
      optimisticLock: record.optimisticLock,
    });
    await reloadList();
  } catch {
    message.error('启停失败，请刷新并核对客服邮箱设置');
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
    message.error('配置选项加载失败，请刷新');
  }
});
</script>
<template>
  <CrudPage :key="scopeGeneration" ref="crudPage" :config="pageConfig">
    <template #search-field-orgId>
      <SupportScopeSelector
        :model-value="selectedScopeRecord"
        @change="changeScope"
      />
    </template>
    <template #toolbar-extra="{ isListOperationVisible }">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="allowed('create') && isListOperationVisible('mailbox:create')"
          type="primary"
          @click="open()"
        >
          新增客服邮箱
        </Button>
        <Button @click="router.push(helpDocumentUrl('mail-ticket-guide'))">
          帮助
        </Button>
      </div>
    </template>
    <template #row-actions="{ record }">
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
  </CrudPage>
  <Modal
    v-model:open="editing"
    :title="currentRecord ? '编辑客服邮箱' : '新增客服邮箱'"
    :width="960"
    :confirm-loading="saving"
    @ok="save"
  >
    <Form
      id="support-mailbox-setting-config"
      name="supportMailboxSettingConfig"
      data-form-id="support-mailbox-setting-config"
      data-form-name="支持邮箱配置"
      layout="vertical"
      class="grid grid-cols-1 gap-x-4 md:grid-cols-2"
    >
      <Form.Item v-if="!currentRecord" label="处理组织" required>
        <SupportScopeSelector
          :model-value="selectedFormScopeRecord"
          @change="changeFormScope"
        />
      </Form.Item>
      <Form.Item label="客服邮箱地址" required>
        <Input
          v-model:value="draft.email"
          :disabled="!formScope"
          :maxlength="256"
          placeholder="support@example.com"
        />
      </Form.Item>
      <Form.Item label="收件方式" required>
        <Select
          v-model:value="draft.inboundChannel"
          :disabled="!formScope"
          :options="channels"
          @change="changeChannel"
        />
      </Form.Item>
      <Form.Item
        :label="draft.inboundChannel === 'LocalSmtp' ? '收件域名' : '中转路由'"
        required
      >
        <Select
          v-if="draft.inboundChannel === 'LocalSmtp'"
          v-model:value="draft.mailDomainId"
          :disabled="!formScope"
          show-search
          :filter-option="false"
          :options="sources"
          @search="searchSources"
          @focus="searchSources()"
        />
        <Select
          v-else
          v-model:value="draft.emailRelayRouteId"
          :disabled="!formScope"
          show-search
          :filter-option="false"
          :options="sources"
          @search="searchSources"
          @focus="searchSources()"
        />
      </Form.Item>
      <Form.Item label="工单队列" required>
        <Select
          v-model:value="draft.queueId"
          :disabled="!formScope"
          show-search
          :filter-option="false"
          :options="queues"
          placeholder="搜索工单队列"
          @search="searchQueues"
          @focus="searchQueues()"
        />
      </Form.Item>
      <Form.Item label="默认处理人">
        <Select
          v-model:value="draft.defaultAssigneeId"
          :disabled="!formScope"
          allow-clear
          show-search
          :filter-option="false"
          :options="users"
          @search="searchUsers"
          @focus="searchUsers()"
        />
      </Form.Item>
      <Form.Item label="默认优先级" required>
        <Select v-model:value="draft.defaultPriority" :options="priorities" />
      </Form.Item>
      <Form.Item label="回复邮件设置" class="md:col-span-2">
        <Input
          v-model:value="draft.outboundConfigRef"
          :disabled="!formScope"
          :maxlength="128"
          placeholder="填写已授权的发信配置标识，可留空"
        />
      </Form.Item>
    </Form>
  </Modal>
</template>
