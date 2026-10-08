<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type {
  QueueInput,
  QueueRecord,
  SupportScope,
} from '../../api/support-workbench-types';

import { computed, reactive, ref } from 'vue';

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
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { roleService } from '../../api/role-service';
import { ticketQueueService } from '../../api/ticket-queue-service';
import { userService } from '../../api/user-service';
import SupportScopeSelector from '../support-scope-selector.vue';
import {
  buildQueueHandlerRoleQuery,
  buildQueueHandlerUserQuery,
  isQueueHandlerRoleOption,
} from './handler-options';

// 每个操作绑定对应方法权限；所选组织始终经服务端复核。
const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(ticketQueueService, method));
const scope = ref<SupportScope>();
const rows = ref<QueueRecord[]>([]);
const pageIndex = ref(1);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const editing = ref(false);
const draft = reactive<QueueInput>({
  tenantId: '',
  orgId: '',
  code: '',
  name: '',
  enabled: false,
  handlerUserIds: [],
  handlerRoleCodes: [],
});
const userOptions = ref<{ label: string; value: string }[]>([]);
const roleOptions = ref<{ label: string; value: string }[]>([]);
const columns = [
  { title: '队列编码', dataIndex: 'code' },
  { title: '队列名称', dataIndex: 'name' },
  { title: '是否受理', key: 'enabled' },
  { title: '操作', key: 'actions' },
];
const canSave = computed(() => allowed('save') && Boolean(scope.value));
let version = 0;
async function load(page = pageIndex.value) {
  const current = ++version;
  rows.value = [];
  error.value = '';
  if (!scope.value || !allowed('list')) return;
  loading.value = true;
  try {
    const result = await ticketQueueService.list({
      ...scope.value,
      pageIndex: page,
      pageSize: 20,
    });
    if (current !== version) return;
    rows.value = result.items;
    total.value = result.totals;
    pageIndex.value = page;
  } catch {
    if (current === version) error.value = '队列加载失败，请重试';
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
  userOptions.value = [];
  roleOptions.value = [];
  total.value = 0;
  void load(1);
}
async function open(record?: QueueRecord) {
  if (!scope.value || !canSave.value) return;
  const selected = JSON.stringify(scope.value);
  try {
    const source =
      record && allowed('retrieve')
        ? await ticketQueueService.retrieve({ ...scope.value, id: record.id })
        : undefined;
    if (JSON.stringify(scope.value) !== selected) return;
    Object.assign(
      draft,
      {
        ...scope.value,
        id: undefined,
        optimisticLock: undefined,
        code: '',
        name: '',
        enabled: false,
        handlerUserIds: [],
        handlerRoleCodes: [],
      },
      source,
    );
    editing.value = true;
  } catch {
    message.error('队列详情不可访问');
  }
}
// 下拉查询只在当前范围加载有效主体，不使用自由输入伪造角色或用户。
async function searchUsers(value = '') {
  if (!scope.value) return;
  const selected = JSON.stringify(scope.value);
  try {
    const result = (await userService.list(
      buildQueueHandlerUserQuery(scope.value, value),
    )) as { items: { id: string; name?: string; realName?: string }[] };
    if (JSON.stringify(scope.value) !== selected) return;
    userOptions.value = (result.items || []).map(
      (item: { id: string; name?: string; realName?: string }) => ({
        value: item.id,
        label: item.realName || item.name || item.id,
      }),
    );
  } catch {
    message.error('处理人选项不可访问');
  }
}
async function searchRoles(value = '') {
  if (!scope.value) return;
  const selected = JSON.stringify(scope.value);
  try {
    const result = (await roleService.list(
      buildQueueHandlerRoleQuery(scope.value, value),
    )) as {
      items: { code: string; name?: string; tenantId?: null | string }[];
    };
    if (JSON.stringify(scope.value) !== selected) return;
    roleOptions.value = (result.items || [])
      .filter((item) => isQueueHandlerRoleOption(item, scope.value?.tenantId))
      .map((item: { code: string; name?: string }) => ({
        value: item.code,
        label: item.name || item.code,
      }));
  } catch {
    message.error('角色选项不可访问');
  }
}
async function save() {
  if (!scope.value || !canSave.value || saving.value) return;
  if (!draft.code.trim() || !draft.name.trim()) {
    message.error('请填写队列编码和名称');
    return;
  }
  saving.value = true;
  try {
    await ticketQueueService.save({ ...draft, ...scope.value });
    editing.value = false;
    await load();
  } catch {
    message.error('保存失败，请核对范围、处理人和版本后重试');
  } finally {
    saving.value = false;
  }
}
async function switchEnabled(record: QueueRecord) {
  if (!scope.value || !allowed('setEnabled')) return;
  try {
    await ticketQueueService.setEnabled({
      ...scope.value,
      id: record.id,
      optimisticLock: record.optimisticLock,
      enabled: !record.enabled,
    });
    await load();
  } catch {
    message.error('队列启停失败，请刷新后重试');
  }
}
</script>
<template>
  <Page title="工单受理队列">
    <div class="bg-card grid gap-4 rounded-lg p-4">
      <SupportScopeSelector @change="changeScope" />
      <Alert v-if="!scope" type="info" message="请选择授权受理组织" />
      <Alert v-if="error" type="error" :message="error" />
      <div class="flex gap-2">
        <Button v-if="canSave" type="primary" @click="open()">新建队列</Button>
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
          <template v-if="column.key === 'enabled'">
            <Tag>{{ record.enabled ? '受理中' : '已停用' }}</Tag>
          </template>
          <template v-if="column.key === 'actions'">
            <Button
              v-if="canSave && allowed('retrieve')"
              type="link"
              @click="open(record as QueueRecord)"
            >
              编辑
            </Button>
            <Button
              v-if="allowed('setEnabled')"
              type="link"
              @click="switchEnabled(record as QueueRecord)"
            >
              {{ record.enabled ? '停用' : '启用' }}
            </Button>
          </template>
        </template>
      </Table>
      <Modal
        v-model:open="editing"
        title="保存工单受理队列"
        :confirm-loading="saving"
        @ok="save"
      >
        <Form layout="vertical">
          <Form.Item label="队列编码" required>
            <Input v-model:value="draft.code" :maxlength="64" />
          </Form.Item>
          <Form.Item label="队列名称" required>
            <Input v-model:value="draft.name" :maxlength="128" />
          </Form.Item>
          <Form.Item label="可处理用户">
            <Select
              v-model:value="draft.handlerUserIds"
              mode="multiple"
              show-search
              :filter-option="false"
              :options="userOptions"
              @search="searchUsers"
              @focus="searchUsers()"
            />
          </Form.Item>
          <Form.Item label="可处理角色">
            <Select
              v-model:value="draft.handlerRoleCodes"
              mode="multiple"
              show-search
              :filter-option="false"
              :options="roleOptions"
              @search="searchRoles"
              @focus="searchRoles()"
            />
          </Form.Item>
          <Form.Item label="是否受理">
            <Switch v-model:checked="draft.enabled" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  </Page>
</template>
