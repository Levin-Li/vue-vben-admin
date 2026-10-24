<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type {
  AuditDetail,
  AuditRecord,
  AuditReview,
  SupportScope,
} from '../../api/support-workbench-types';

import { computed, onMounted, ref } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Select,
  Table,
} from 'ant-design-vue';

import { notificationAuditService } from '../../api/notification-audit-service';
import { moduleFetchEnumOptions } from '../api-module';
import SupportScopeSelector from '../support-scope-selector.vue';
import { normalizeNotificationChannels } from '../workflow-notification-route/config';
import { createNotificationAuditCrudConfig } from './config';

// 审计只消费安全元数据；未知结果必须先核验，重试是独立操作。
const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(notificationAuditService, method));
const selectedScope = ref<UserOrgSelectorRecord>();
const scopeGeneration = ref(0);
const initialQuery = ref<Record<string, unknown>>({});
let queryState: Record<string, unknown> = {};
let reloadList: (() => Promise<unknown> | unknown) | undefined;
const statuses = ref<{ label: string; value: string }[]>([]);
const channels = ref<{ label: string; value: string }[]>([]);
const outcomes = ref<{ label: string; value: string }[]>([]);
const statusLabel = (value: string) =>
  statuses.value.find((item) => item.value === value)?.label || '状态不可用';
const channelLabel = (value: string) =>
  channels.value.find((item) => item.value === value)?.label || '渠道不可用';
const outcomeLabel = (value: string) =>
  outcomes.value.find((item) => item.value === value)?.label || '结果不可用';
const detail = ref<AuditDetail>();
const detailScope = ref<SupportScope>();
const opened = ref(false);
const action = ref<'resolveUnsent' | 'retry'>();
const processing = ref(false);
const reason = ref<AuditReview['reason']>('ConfigurationFixed');
const verificationRef = ref('');
const verifiedUnsent = ref(false);
const canRetry = computed(
  () =>
    allowed('retry') &&
    detail.value &&
    ['RetryableFailed', 'TerminalFailed'].includes(
      detail.value.delivery.status,
    ) &&
    !detail.value.delivery.exhausted,
);
const canResolve = computed(
  () => allowed('resolveUnsent') && detail.value?.delivery.status === 'Unknown',
);
const attemptColumns = [
  { title: '序号', dataIndex: 'attemptNo' },
  { title: '开始时间', dataIndex: 'startedTime' },
  { title: '结束时间', dataIndex: 'finishedTime' },
  { title: '结果', key: 'outcome' },
];
const reviewColumns = [
  { title: '时间', dataIndex: 'occurTime' },
  { title: '操作人', dataIndex: 'operator' },
  { title: '动作', dataIndex: 'action' },
  { title: '原因', dataIndex: 'reason' },
  { title: '核验引用', dataIndex: 'verificationRef' },
];
let listVersion = 0;
let detailVersion = 0;
const crudConfig = computed(() =>
  createNotificationAuditCrudConfig({
    apiService: { list: listRecords },
    initialQuery: initialQuery.value,
    statuses: statuses.value,
    statusLabel,
    channelLabel,
  }),
);
// 范围由当前查询模型和已选组织共同确认，禁止复用已变化的组织标识。
function currentScope(orgId: unknown): SupportScope | undefined {
  const record = selectedScope.value;
  if (
    orgId &&
    (typeof orgId !== 'string' ||
      record?.kind !== 'org' ||
      record.id !== orgId ||
      !record.tenantId)
  )
    throw new Error('业务范围已变化，请重新选择组织');
  return typeof orgId === 'string' &&
    record?.kind === 'org' &&
    record.id === orgId &&
    record.tenantId
    ? { tenantId: record.tenantId, orgId: record.id }
    : undefined;
}
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
  return state.orgId === selectedScope.value?.id
    ? selectedScope.value
    : undefined;
}
// 公共 CRUD 负责查询、分页与加载反馈；适配层仅传实际接口接受的参数。
async function listRecords(params: Record<string, unknown> = {}) {
  const current = ++listVersion;
  if (!allowed('list')) return { items: [], totals: 0 };
  const result = await notificationAuditService.list({
    ...currentScope(params.orgId),
    status: typeof params.status === 'string' ? params.status : undefined,
    pageIndex: Number(params.pageIndex) || 1,
    pageSize: Number(params.pageSize) || 20,
  });
  return current === listVersion ? result : { items: [], totals: 0 };
}
// 选择条件只更新表单；切换组织立即清理旧范围的列表和详情。
function changeScope(
  record: undefined | UserOrgSelectorRecord,
  state: Record<string, unknown>,
) {
  selectedScope.value = record?.kind === 'org' ? record : undefined;
  initialQuery.value = { ...state, orgId: selectedScope.value?.id };
  queryState = initialQuery.value;
  detailVersion += 1;
  detail.value = undefined;
  detailScope.value = undefined;
  opened.value = false;
  action.value = undefined;
  reloadList = undefined;
  listVersion += 1;
  scopeGeneration.value += 1;
}
async function open(
  record: AuditRecord,
  requestScope = currentScope(queryState.orgId),
) {
  if (!allowed('retrieve')) return;
  const current = ++detailVersion;
  try {
    const result = await notificationAuditService.retrieve({
      id: record.id,
      tenantId: requestScope?.tenantId,
    });
    if (current !== detailVersion) return;
    detail.value = result;
    detailScope.value = requestScope;
    opened.value = true;
  } catch {
    message.error('投递详情不可访问或已失效');
  }
}
function begin(value: 'resolveUnsent' | 'retry') {
  if (value === 'retry' ? !canRetry.value : !canResolve.value) return;
  action.value = value;
  reason.value =
    value === 'resolveUnsent' ? 'VerifiedUnsent' : 'ConfigurationFixed';
  verificationRef.value = '';
  verifiedUnsent.value = false;
}
async function submit() {
  if (!detail.value || !action.value || processing.value) return;
  const method = action.value;
  if (method === 'retry' ? !canRetry.value : !canResolve.value) return;
  if (
    method === 'resolveUnsent' &&
    (!verifiedUnsent.value || !/^[\w.:-]{1,128}$/.test(verificationRef.value))
  ) {
    message.error('必须明确核验未受理并提供无机密记录标识');
    return;
  }
  processing.value = true;
  const req: AuditReview = {
    id: detail.value.delivery.id,
    tenantId: detailScope.value?.tenantId,
    optimisticLock: detail.value.delivery.optimisticLock,
    reason: reason.value,
    ...(method === 'resolveUnsent'
      ? { verifiedUnsent: true, verificationRef: verificationRef.value }
      : {}),
  };
  const generation = scopeGeneration.value;
  try {
    const result = await notificationAuditService[method](req);
    if (generation !== scopeGeneration.value) return;
    action.value = undefined;
    await open(result, detailScope.value);
    await reloadList?.();
  } catch {
    message.error('人工处理失败，请刷新核对权限、状态和版本');
  } finally {
    processing.value = false;
  }
}
onMounted(async () => {
  try {
    const [result, channelOptions, outcomeOptions] = await Promise.all([
      moduleFetchEnumOptions(
        'com.levin.oak.base.entities.NotificationDelivery$Status',
      ),
      moduleFetchEnumOptions(
        'com.levin.oak.base.entities.NotificationDelivery$Channel',
      ),
      moduleFetchEnumOptions(
        'com.levin.oak.base.entities.NotificationDeliveryAttempt$Outcome',
      ),
    ]);
    channels.value = normalizeNotificationChannels(channelOptions);
    outcomes.value = outcomeOptions.map((item) => ({
      label: item.label,
      value: String(item.value),
    }));
    statuses.value = result.map((item) => ({
      label: item.label,
      value: String(item.value),
    }));
  } catch {
    message.error('投递状态选项加载失败');
  }
});
</script>
<template>
  <div class="flex min-w-0 flex-col gap-2">
    <CrudPage :key="scopeGeneration" :config="crudConfig">
      <template #search-field-orgId="slot">
        <SupportScopeSelector
          :model-value="scopeSelection(searchScopeState(slot))"
          placeholder="全部授权范围"
          @change="changeScope($event, searchScopeState(slot))"
        />
      </template>
      <template #row-actions="{ record, reload }">
        <Button
          v-if="allowed('retrieve')"
          size="small"
          type="link"
          @click="
            reloadList = reload;
            open(record as AuditRecord);
          "
        >
          查看详情
        </Button>
      </template>
      <template #emptyText>
        <Empty description="当前业务范围和状态下暂无通知投递记录" />
      </template>
    </CrudPage>
    <Modal
      v-model:open="opened"
      title="通知投递详情"
      width="960px"
      :footer="null"
    >
      <template v-if="detail">
        <Descriptions :column="2">
          <Descriptions.Item label="事件标识">
            {{ detail.delivery.eventId }}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {{ statusLabel(detail.delivery.status) }}
          </Descriptions.Item>
          <Descriptions.Item label="尝试次数">
            {{ detail.delivery.attemptCount }}
          </Descriptions.Item>
          <Descriptions.Item label="版本">
            {{ detail.delivery.optimisticLock }}
          </Descriptions.Item>
          <Descriptions.Item label="渠道受理时间">
            {{ detail.delivery.deliveredTime || '-' }}
          </Descriptions.Item>
        </Descriptions>
        <Alert
          v-if="detail.attemptsTruncated"
          type="warning"
          message="历史超过一千条，当前仅显示前一千条"
        />
        <h3>投递尝试</h3>
        <Table
          :columns="attemptColumns"
          :data-source="detail.attempts"
          row-key="attemptNo"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <div v-if="column.key === 'outcome'">
              {{ outcomeLabel(record.outcome) }}
            </div>
          </template>
        </Table>
        <h3>人工日志</h3>
        <Table
          :columns="reviewColumns"
          :data-source="detail.reviews"
          :pagination="false"
        />
        <div class="mt-4 flex gap-2">
          <Button v-if="canResolve" @click="begin('resolveUnsent')">
            核验未受理
          </Button>
          <Button v-if="canRetry" @click="begin('retry')">重试投递</Button>
        </div>
      </template>
    </Modal>
    <Modal
      :open="Boolean(action)"
      :title="action === 'resolveUnsent' ? '核验渠道未受理' : '重试通知投递'"
      :confirm-loading="processing"
      @cancel="action = undefined"
      @ok="submit"
    >
      <Form
        id="notification-audit-review"
        name="notificationAuditReview"
        data-form-id="notification-audit-review"
        data-form-name="通知投递人工处理"
        layout="horizontal"
        :label-col="{ style: { width: '88px' } }"
        :wrapper-col="{ flex: 1 }"
      >
        <template v-if="action === 'resolveUnsent'">
          <Alert
            type="warning"
            message="仅在已核验供应商未受理时确认；本操作不会发送通知。"
          />
          <Form.Item label="核验记录" name="verificationRef" class="mt-4">
            <Input
              v-model:value="verificationRef"
              :maxlength="128"
              placeholder="无机密核验记录标识，禁止邮箱或 URL"
            />
          </Form.Item>
          <Checkbox v-model:checked="verifiedUnsent">
            我已核验本次渠道没有受理
          </Checkbox>
        </template>
        <Form.Item v-else label="重试原因" name="reason">
          <Select
            v-model:value="reason"
            class="w-full"
            :options="[
              { label: '配置已修复', value: 'ConfigurationFixed' },
              { label: '服务已恢复', value: 'ServiceRestored' },
            ]"
          />
        </Form.Item>
      </Form>
    </Modal>
  </div>
</template>
