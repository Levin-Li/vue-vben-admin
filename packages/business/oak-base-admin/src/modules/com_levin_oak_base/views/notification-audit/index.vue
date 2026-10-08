<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type {
  AuditDetail,
  AuditRecord,
  AuditReview,
  SupportScope,
} from '../../api/support-workbench-types';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
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

// 审计只消费安全元数据；未知结果必须先核验，重试是独立操作。
const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(notificationAuditService, method));
const scope = ref<SupportScope>();
const status = ref<string>();
const statuses = ref<{ label: string; value: string }[]>([]);
const channels = ref<{ label: string; value: string }[]>([]);
const outcomes = ref<{ label: string; value: string }[]>([]);
const statusLabel = (value: string) =>
  statuses.value.find((item) => item.value === value)?.label || '状态不可用';
const channelLabel = (value: string) =>
  channels.value.find((item) => item.value === value)?.label || '渠道不可用';
const outcomeLabel = (value: string) =>
  outcomes.value.find((item) => item.value === value)?.label || '结果不可用';
const rows = ref<AuditRecord[]>([]);
const pageIndex = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const detail = ref<AuditDetail>();
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
const columns = [
  { title: '投递标识', dataIndex: 'id' },
  { title: '渠道', key: 'channel' },
  { title: '状态', key: 'status' },
  { title: '尝试次数', dataIndex: 'attemptCount' },
  { title: '操作', key: 'actions' },
];
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
let version = 0;
let detailVersion = 0;
async function load(page = pageIndex.value) {
  const current = ++version;
  rows.value = [];
  error.value = '';
  if (!allowed('list')) return;
  loading.value = true;
  try {
    const result = await notificationAuditService.list({
      ...scope.value,
      status: status.value,
      pageIndex: page,
      pageSize: 20,
    });
    if (current !== version) return;
    rows.value = result.items;
    total.value = result.totals;
    pageIndex.value = page;
  } catch {
    if (current === version) error.value = '通知投递审计不可访问';
  } finally {
    if (current === version) loading.value = false;
  }
}
function changeScope(record?: UserOrgSelectorRecord) {
  scope.value =
    record?.kind === 'org' && record.tenantId
      ? { tenantId: record.tenantId, orgId: record.id }
      : undefined;
  detailVersion += 1;
  detail.value = undefined;
  opened.value = false;
  action.value = undefined;
  void load(1);
}
async function open(record: AuditRecord) {
  if (!allowed('retrieve')) return;
  const current = ++detailVersion;
  try {
    const result = await notificationAuditService.retrieve({
      id: record.id,
      tenantId: scope.value?.tenantId,
    });
    if (current !== detailVersion) return;
    detail.value = result;
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
    tenantId: scope.value?.tenantId,
    optimisticLock: detail.value.delivery.optimisticLock,
    reason: reason.value,
    ...(method === 'resolveUnsent'
      ? { verifiedUnsent: true, verificationRef: verificationRef.value }
      : {}),
  };
  try {
    const result = await notificationAuditService[method](req);
    action.value = undefined;
    await open(result);
    await load();
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
    error.value = '投递状态选项加载失败';
  }
  await load(1);
});
</script>
<template>
  <Page title="通知投递">
    <div class="bg-card grid gap-4 rounded-lg p-4">
      <SupportScopeSelector @change="changeScope" />
      <Alert
        type="info"
        message="提交成功只表示渠道受理；未知结果须核验，不能直接重发。"
      />
      <Alert v-if="error" type="error" :message="error" />
      <div class="flex gap-2">
        <Select
          v-model:value="status"
          allow-clear
          :options="statuses"
          placeholder="投递状态"
          class="w-48"
          @change="load(1)"
        />
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
          <span v-if="column.key === 'status'">{{
            statusLabel(record.status)
          }}</span>
          <span v-if="column.key === 'channel'">{{
            channelLabel(record.channel)
          }}</span>
          <Button
            v-if="column.key === 'actions' && allowed('retrieve')"
            type="link"
            @click="open(record as AuditRecord)"
          >
            查看审计
          </Button>
        </template>
      </Table>
      <Modal
        v-model:open="opened"
        title="投递审计"
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
        <template v-if="action === 'resolveUnsent'">
          <Alert
            type="warning"
            message="仅在已核验供应商未受理时确认；本操作不会发送通知。"
          />
          <Input
            v-model:value="verificationRef"
            :maxlength="128"
            placeholder="无机密核验记录标识，禁止邮箱或 URL"
            class="my-4"
          />
          <Checkbox v-model:checked="verifiedUnsent">
            我已核验本次渠道没有受理
          </Checkbox>
        </template>
        <Select
          v-else
          v-model:value="reason"
          class="w-full"
          :options="[
            { label: '配置已修复', value: 'ConfigurationFixed' },
            { label: '服务已恢复', value: 'ServiceRestored' },
          ]"
        />
      </Modal>
    </div>
  </Page>
</template>
