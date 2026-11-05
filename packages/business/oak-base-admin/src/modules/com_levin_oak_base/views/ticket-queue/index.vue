<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type {
  QueueInput,
  QueueRecord,
  SupportScope,
} from '../../api/support-workbench-types';

import { computed, reactive, ref } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { DEFAULT_CONTENT_MODAL_BODY_STYLE } from '@levin/admin-framework/framework-commons/shared/config-helpers';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { isPlatformUser as isPlatformIdentity } from '@levin/admin-framework/framework-commons/shared/user-identity';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Select,
  Switch,
} from 'ant-design-vue';

import { roleService } from '../../api/role-service';
import { ticketQueueService } from '../../api/ticket-queue-service';
import { tenantOptionsLoader } from '../api-module';
import SupportScopeSelector from '../support-scope-selector.vue';
import SupportUserSelector from '../support-user-selector.vue';
import { createTicketQueueCrudConfig } from './config';
import {
  buildQueueHandlerRoleQuery,
  isQueueHandlerRoleOption,
} from './handler-options';

// 组织选择只提供业务上下文，服务端仍独立验证范围和各操作权限。
const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(ticketQueueService, method));
const selectedScope = ref<UserOrgSelectorRecord>();
const formScopeRecord = ref<UserOrgSelectorRecord>();
const formTenantId = ref<string>();
const tenantOptions = ref<{ label: string; value: string }[]>([]);
const platformUser = computed(() =>
  isPlatformIdentity(useUserStore().userInfo),
);
const activeFormScope = computed<SupportScope | undefined>(() => {
  const org = formScopeRecord.value;
  return org?.kind === 'org' &&
    org.tenantId &&
    org.tenantId === formTenantId.value
    ? { tenantId: org.tenantId, orgId: org.id }
    : undefined;
});
// 租户候选不授予组织权限，组织仍从授权树按租户读取。
async function loadTenantOptions(keyword = '') {
  try {
    const options = await tenantOptionsLoader(keyword);
    tenantOptions.value = options.map((item) => ({
      label: item.label,
      value: String(item.value),
    }));
  } catch (error) {
    notifyApiErrorOnce(error);
  }
}
function changeFormTenant(value?: string) {
  if (value === formTenantId.value) return;
  formTenantId.value = value;
  formScopeRecord.value = undefined;
  draft.tenantId = value || '';
  draft.orgId = '';
  draft.handlerUserIds = [];
  draft.handlerRoleCodes = [];
  roleOptions.value = [];
  roleOptionsVersion += 1;
}
function changeFormOrganization(records: UserOrgSelectorRecord[]) {
  const org = records[0];
  if (org && (org.kind !== 'org' || org.tenantId !== formTenantId.value))
    return;
  formScopeRecord.value = org;
  draft.tenantId = org?.tenantId || '';
  draft.orgId = org?.id || '';
  draft.handlerUserIds = [];
  draft.handlerRoleCodes = [];
  roleOptions.value = [];
  roleOptionsVersion += 1;
}
const scopeGeneration = ref(0);
const initialQuery = ref<Record<string, unknown>>({});
let queryState: Record<string, unknown> = {};
let reloadList: (() => Promise<unknown> | unknown) | undefined;
let listVersion = 0;
let detailVersion = 0;
let roleOptionsVersion = 0;

function currentScope(orgId: unknown): SupportScope | undefined {
  const record = selectedScope.value;
  if (
    orgId &&
    (typeof orgId !== 'string' || record?.id !== orgId || !record.tenantId)
  )
    throw new Error('受理组织已变化，请重新选择');
  return typeof orgId === 'string' && record?.id === orgId && record.tenantId
    ? { tenantId: record.tenantId, orgId: record.id }
    : undefined;
}

// 公共查询插槽必须携带实际查询模型，不能从页面本地控件臆造请求范围。
function searchScopeState(slot: unknown): Record<string, unknown> {
  if (!slot || typeof slot !== 'object' || !('searchState' in slot))
    throw new Error('受理组织查询插槽未提供查询模型');
  const state = slot.searchState;
  if (!state || typeof state !== 'object' || Array.isArray(state))
    throw new Error('受理组织查询模型无效');
  return state as Record<string, unknown>;
}

function scopeSelection(state: Record<string, unknown>) {
  queryState = state;
  return state.orgId === selectedScope.value?.id
    ? selectedScope.value
    : undefined;
}

// 列表只传专用服务声明的范围、编码和分页参数。
async function listQueues(params: Record<string, unknown> = {}) {
  const version = ++listVersion;
  if (!allowed('list')) return { items: [], totals: 0 };
  const scope = currentScope(params.orgId);
  if (!scope) return { items: [], totals: 0 };
  const result = await ticketQueueService.list({
    ...scope,
    code: typeof params.code === 'string' ? params.code.trim() : undefined,
    pageIndex: Number(params.pageIndex) || 1,
    pageSize: Number(params.pageSize) || 20,
  });
  return version === listVersion ? result : { items: [], totals: 0 };
}

const crudConfig = computed(() =>
  createTicketQueueCrudConfig({
    apiService: { list: listQueues },
    initialQuery: initialQuery.value,
  }),
);

function changeScope(
  record: undefined | UserOrgSelectorRecord,
  state: Record<string, unknown>,
) {
  selectedScope.value =
    record?.kind === 'org' && record.tenantId ? record : undefined;
  initialQuery.value = { ...state, orgId: selectedScope.value?.id };
  queryState = initialQuery.value;
  detailVersion += 1;
  listVersion += 1;
  editing.value = false;
  roleOptions.value = [];
  roleOptionsVersion += 1;
  reloadList = undefined;
  scopeGeneration.value += 1;
}

// 单个 save 接口同时负责新增和编辑，保留其乐观锁与受控候选项。
const editing = ref(false);
const saving = ref(false);
const draft = reactive<QueueInput>({
  tenantId: '',
  orgId: '',
  code: '',
  name: '',
  enabled: false,
  handlerUserIds: [],
  handlerRoleCodes: [],
});
const roleOptions = ref<{ label: string; value: string }[]>([]);
const canSave = computed(() => allowed('save') && Boolean(selectedScope.value));
// 平台用户可先打开新增表单，再选择有权受理的租户和组织。
const canCreate = computed(
  () => allowed('save') && (platformUser.value || Boolean(selectedScope.value)),
);
const switchingIds = new Set<string>();

async function open(record?: QueueRecord) {
  const version = ++detailVersion;
  if (
    !allowed('save') ||
    (record ? !canSave.value || !allowed('retrieve') : !canCreate.value)
  )
    return;
  try {
    const scope = currentScope(queryState.orgId);
    if (!scope && (record || !platformUser.value)) return;
    const source =
      record && scope
        ? await ticketQueueService.retrieve({ ...scope, id: record.id })
        : undefined;
    if (version !== detailVersion) return;
    Object.assign(
      draft,
      {
        tenantId: scope?.tenantId || '',
        orgId: scope?.orgId || '',
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
    formScopeRecord.value = selectedScope.value;
    formTenantId.value = scope?.tenantId;
    editing.value = true;
  } catch (error_) {
    notifyApiErrorOnce(error_);
  }
}

// 候选项仅从当前组织及其租户读取；搜索失败不清除已选值。
async function searchRoles(value = '') {
  const scope = activeFormScope.value;
  if (!scope) return;
  const version = scopeGeneration.value;
  const optionsVersion = ++roleOptionsVersion;
  try {
    const result = (await roleService.list(
      buildQueueHandlerRoleQuery(scope, value),
    )) as {
      items: { code: string; name?: string; tenantId?: null | string }[];
    };
    if (
      version !== scopeGeneration.value ||
      optionsVersion !== roleOptionsVersion
    )
      return;
    roleOptions.value = (result.items || [])
      .filter((item) => isQueueHandlerRoleOption(item, scope.tenantId))
      .map((item) => ({ value: item.code, label: item.name || item.code }));
  } catch (error_) {
    if (
      version === scopeGeneration.value &&
      optionsVersion === roleOptionsVersion
    )
      notifyApiErrorOnce(error_);
  }
}

async function save() {
  if (!allowed('save') || saving.value) return;
  const scope = activeFormScope.value;
  if (!scope) {
    message.error('请选择租户和受理组织');
    return;
  }
  if (!draft.code.trim() || !draft.name.trim()) {
    message.error('请填写队列编码和名称');
    return;
  }
  saving.value = true;
  const version = scopeGeneration.value;
  try {
    await ticketQueueService.save({ ...draft, ...scope });
    if (version === scopeGeneration.value) {
      editing.value = false;
      await reloadList?.();
    }
  } catch (error_) {
    notifyApiErrorOnce(error_);
  } finally {
    saving.value = false;
  }
}

async function switchEnabled(record: QueueRecord) {
  if (!allowed('setEnabled') || switchingIds.has(record.id)) return;
  switchingIds.add(record.id);
  const version = scopeGeneration.value;
  try {
    const scope = currentScope(queryState.orgId);
    if (!scope) return;
    await ticketQueueService.setEnabled({
      ...scope,
      id: record.id,
      optimisticLock: record.optimisticLock,
      enabled: !record.enabled,
    });
    if (version === scopeGeneration.value) await reloadList?.();
  } catch (error_) {
    notifyApiErrorOnce(error_);
  } finally {
    switchingIds.delete(record.id);
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <CrudPage :key="scopeGeneration" :config="crudConfig">
      <template #search-field-orgId="slot">
        <SupportScopeSelector
          :model-value="scopeSelection(searchScopeState(slot))"
          placeholder="选择受理组织"
          @change="changeScope($event, searchScopeState(slot))"
        />
      </template>

      <template #toolbar-extra="{ loadList, isListOperationVisible }">
        <Button
          v-if="canCreate && isListOperationVisible('queue:create')"
          type="primary"
          @click="
            reloadList = loadList;
            open();
          "
        >
          新建队列
        </Button>
      </template>

      <template #row-actions="{ record, reload }">
        <Button
          v-if="canSave && allowed('retrieve')"
          size="small"
          type="link"
          @click="
            reloadList = reload;
            open(record as QueueRecord);
          "
        >
          编辑
        </Button>
        <Button
          v-if="allowed('setEnabled')"
          size="small"
          type="link"
          @click="
            reloadList = reload;
            switchEnabled(record as QueueRecord);
          "
        >
          {{ record.enabled ? '停用' : '启用' }}
        </Button>
      </template>

      <template #emptyText>
        {{ selectedScope ? '暂无受理队列' : '选择受理组织后查看队列' }}
      </template>
    </CrudPage>

    <Modal
      v-model:open="editing"
      title="保存工单受理队列"
      width="960px"
      :body-style="DEFAULT_CONTENT_MODAL_BODY_STYLE"
      :confirm-loading="saving"
      :mask-closable="false"
      @ok="save"
    >
      <Form
        id="ticket-queue-edit"
        data-form-id="ticket-queue-edit"
        data-form-name="工单受理队列编辑"
        name="ticketQueueEdit"
        layout="horizontal"
        class="grid gap-x-4"
        style="
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(100%, 330px), 1fr)
          );
        "
        :label-col="{ style: { width: '104px' } }"
        :wrapper-col="{ flex: 1 }"
      >
        <!-- 新增时选择租户及授权组织；编辑保留原归属。 -->
        <Form.Item v-if="platformUser" label="归属租户" required>
          <Select
            data-testid="form-tenant"
            :value="formTenantId"
            :disabled="Boolean(draft.id)"
            :options="
              tenantOptions.length > 0
                ? tenantOptions
                : formTenantId
                  ? [
                      {
                        label: selectedScope?.tenantName || formTenantId,
                        value: formTenantId,
                      },
                    ]
                  : []
            "
            :filter-option="false"
            allow-clear
            show-search
            placeholder="请选择归属租户"
            @focus="loadTenantOptions()"
            @search="loadTenantOptions"
            @update:value="
              (value) =>
                changeFormTenant(value == null ? undefined : String(value))
            "
          />
        </Form.Item>
        <Form.Item v-if="platformUser" label="受理组织" required>
          <UserOrgSelector
            data-testid="form-organization"
            :key="formTenantId"
            :disabled="!formTenantId || Boolean(draft.id)"
            :model-value="formScopeRecord"
            :org-load-api="
              () => rbacService.fetchAuthorizedOrgTreeByTenant(formTenantId!)
            "
            :selectable-types="['org']"
            :max-select-count="1"
            value-mode="record"
            placeholder="请选择受理组织"
            @update:selected-records="changeFormOrganization"
          />
        </Form.Item>
        <Form.Item label="队列编码" name="code" required>
          <Input v-model:value="draft.code" :maxlength="64" />
        </Form.Item>
        <Form.Item label="队列名称" name="name" required>
          <Input v-model:value="draft.name" :maxlength="128" />
        </Form.Item>
        <Form.Item label="可处理用户" name="handlerUserIds">
          <SupportUserSelector
            data-testid="queue-handler-users"
            :key="`${draft.tenantId}:${draft.orgId}`"
            :model-value="draft.handlerUserIds"
            :scope="activeFormScope"
            multiple
            @update:model-value="
              draft.handlerUserIds = Array.isArray($event)
                ? $event.filter(
                    (item): item is string => typeof item === 'string',
                  )
                : []
            "
          />
        </Form.Item>
        <Form.Item label="可处理角色" name="handlerRoleCodes">
          <Select
            data-testid="queue-handler-roles"
            v-model:value="draft.handlerRoleCodes"
            mode="multiple"
            show-search
            :filter-option="false"
            :options="roleOptions"
            @search="searchRoles"
            @focus="searchRoles()"
          />
        </Form.Item>
        <Form.Item label="是否受理" name="enabled">
          <Switch v-model:checked="draft.enabled" />
        </Form.Item>
      </Form>
    </Modal>
  </div>
</template>
