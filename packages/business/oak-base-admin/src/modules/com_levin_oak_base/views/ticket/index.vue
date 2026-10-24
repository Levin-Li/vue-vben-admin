<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type { SupportScope } from '../../api/support-workbench-types';
import type {
  TicketCommand,
  TicketMessageRecord,
  TicketOutboundRecord,
  TicketRecord,
  TicketReplyCommand,
  TicketUnsentReview,
} from '../../api/ticket-service';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Timeline,
} from 'ant-design-vue';

import { ticketService } from '../../api/ticket-service';
import { userService } from '../../api/user-service';
import { helpDocumentUrl } from '../../help-center';
import { moduleFetchEnumOptions } from '../api-module';
import { buildSupportUserQuery } from '../support-options';
import SupportScopeSelector from '../support-scope-selector.vue';
import { createTicketCrudConfig } from './config';

// 工单不提供通用新增/编辑；状态变化只提交真实业务命令与预期版本。
const { hasPermission } = useRbacAccess();
const route = useRoute();
const router = useRouter();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(ticketService, method));
const selectedScope = ref<UserOrgSelectorRecord>();
const scopeGeneration = ref(0);
const initialQuery = ref<Record<string, unknown>>({});
const crudPage = ref<{ reload: () => Promise<unknown> }>();
let queryState: Record<string, unknown> = {};
const detailScope = ref<SupportScope>();
const statuses = ref<{ label: string; value: string }[]>([]);
const directions = ref<{ label: string; value: string }[]>([]);
const error = ref('');
watch(error, (value) => {
  if (value) message.error(value);
});
const detail = ref<TicketRecord>();
const opened = ref(false);
const messages = ref<TicketMessageRecord[]>([]);
const messagePage = ref(1);
const messageTotal = ref(0);
const messageError = ref('');
const expandedMessage = ref<TicketMessageRecord>();
const action = ref<
  'assign' | 'close' | 'confirmContact' | 'reopen' | 'resolve' | 'start'
>();
const remark = ref('');
const assigneeId = ref<string>();
const evidence = ref('');
const contactAcknowledged = ref(false);
const userOptions = ref<{ label: string; value: string }[]>([]);
const busy = ref(false);
const replyOpen = ref(false);
const body = ref('');
const attachmentIds = ref<string[]>([]);
const frozenReply = ref<TicketReplyCommand>();
const outbound = ref<TicketOutboundRecord>();
const outboundFresh = ref(false);
const reviewSnapshot =
  ref<Omit<TicketUnsentReview, 'evidenceRef' | 'reason' | 'verifiedUnsent'>>();
const reviewOpen = ref(false);
const reviewConfirmed = ref(false);
const reviewEvidence = ref('');
const stateActions = [
  { method: 'assign', event: '分派', label: '分派' },
  { method: 'start', event: '开始处理', label: '开始处理' },
  { method: 'resolve', event: '解决', label: '解决' },
  { method: 'reopen', event: '重开', label: '重开' },
  { method: 'close', event: '关闭', label: '关闭' },
] as const;
const supported = (event: string) =>
  Boolean(detail.value?.supportEventsByCurrentStatus?.includes(event));
const canContact = computed(
  () => Boolean(detail.value) && allowed('confirmContact') && allowed('start'),
);
const contactConfirmed = computed(
  () =>
    Boolean(detail.value?.confirmedContactEmail) &&
    detail.value?.confirmedContactEmail === detail.value?.requesterEmail,
);
const canReply = computed(
  () => supported('回复') && allowed('reply') && contactConfirmed.value,
);
const canRetryOutbound = computed(
  () =>
    allowed('retryOutbound') &&
    allowed('start') &&
    outboundFresh.value &&
    outbound.value?.ticketId === detail.value?.id &&
    outbound.value?.status === 'Failed' &&
    outbound.value.attemptCount < 5,
);
const canReviewUnsent = computed(
  () =>
    Boolean(detail.value) &&
    allowed('resolveOutboundUnsent') &&
    allowed('start') &&
    outbound.value?.ticketId === detail.value?.id &&
    outbound.value?.status === 'Unknown',
);
const replyAttachments = computed(() =>
  [
    ...new Set(messages.value.flatMap((item) => item.attachmentFileIds || [])),
  ].map((id, index) => ({ value: id, label: `当前会话附件 ${index + 1}` })),
);
const logs = computed(() =>
  (detail.value?.actionLog || []).toSorted((left, right) =>
    left.occurTime.localeCompare(right.occurTime),
  ),
);
const stateLabel = (value?: string) =>
  statuses.value.find((item) => item.value === value)?.label || '状态不可用';
const directionLabel = (value: string) =>
  directions.value.find((item) => item.value === value)?.label || '工单消息';
const outboundLabels: Record<string, string> = {
  Pending: '等待发送',
  Sending: '正在提交',
  Accepted: 'SMTP 已受理',
  Failed: '发送前确定失败',
  Unknown: '结果不明，待核验',
};
let listVersion = 0;
let detailVersion = 0;
let messagesVersion = 0;
let outboundVersion = 0;
const crudConfig = computed(() =>
  createTicketCrudConfig({
    apiService: { list: listTickets },
    initialQuery: initialQuery.value,
    stateLabel,
    statuses: statuses.value,
  }),
);
// 查询参数中的组织必须与当前授权选择器记录一致，避免跨范围复用旧值。
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
// 列表只传工单查询服务接受的范围、状态及分页参数。
async function listTickets(params: Record<string, unknown> = {}) {
  const current = ++listVersion;
  if (!allowed('list')) return { items: [], totals: 0 };
  const result = await ticketService.list({
    ...currentScope(params.orgId),
    status: typeof params.status === 'string' ? params.status : undefined,
    pageIndex: Number(params.pageIndex) || 1,
    pageSize: Number(params.pageSize) || 20,
  });
  return current === listVersion ? result : { items: [], totals: 0 };
}
function locator() {
  if (!detail.value) throw new Error('工单不可访问');
  return { id: detail.value.id, ...detailScope.value };
}
async function loadMessages(page = 1) {
  const current = ++messagesVersion;
  messages.value = [];
  messageError.value = '';
  if (!detail.value || !allowed('messages')) return;
  try {
    const result = await ticketService.messages({
      ...locator(),
      pageIndex: page,
      pageSize: 20,
    });
    if (current !== messagesVersion) return;
    messages.value = result.items;
    messageTotal.value = result.totals;
    messagePage.value = page;
  } catch {
    if (current === messagesVersion) messageError.value = '工单会话不可访问';
  }
}
async function open(id: string, requestScope = currentScope(queryState.orgId)) {
  const current = ++detailVersion;
  outboundVersion += 1;
  reviewOpen.value = false;
  reviewSnapshot.value = undefined;
  if (detail.value?.id !== id) {
    outbound.value = undefined;
    outboundFresh.value = false;
  }
  expandedMessage.value = undefined;
  action.value = undefined;
  detail.value = undefined;
  messagesVersion += 1;
  messages.value = [];
  opened.value = false;
  error.value = '';
  if (!allowed('retrieve')) {
    error.value = '工单来源不可访问';
    return;
  }
  try {
    const result = await ticketService.retrieve({ id, ...requestScope });
    if (current !== detailVersion) return;
    detail.value = result;
    detailScope.value = requestScope;
    opened.value = true;
    await loadMessages();
  } catch {
    if (current === detailVersion) error.value = '工单来源不可访问或已失效';
  }
}
function changeScope(
  record: undefined | UserOrgSelectorRecord,
  state: Record<string, unknown>,
) {
  selectedScope.value = record?.kind === 'org' ? record : undefined;
  initialQuery.value = { ...state, orgId: selectedScope.value?.id };
  queryState = initialQuery.value;
  listVersion += 1;
  detailVersion += 1;
  messagesVersion += 1;
  detail.value = undefined;
  detailScope.value = undefined;
  messages.value = [];
  opened.value = false;
  action.value = undefined;
  replyOpen.value = false;
  outboundVersion += 1;
  outbound.value = undefined;
  outboundFresh.value = false;
  reviewOpen.value = false;
  reviewSnapshot.value = undefined;
  reviewConfirmed.value = false;
  reviewEvidence.value = '';
  expandedMessage.value = undefined;
  frozenReply.value = undefined;
  scopeGeneration.value += 1;
}
async function deepLink(value: unknown) {
  if (value === undefined) return;
  if (typeof value !== 'string' || !/^[A-Z0-9][\w.:-]{0,63}$/i.test(value)) {
    error.value = '工单定位参数无效';
    return;
  }
  await open(value);
}
function begin(method: NonNullable<typeof action.value>) {
  const item = stateActions.find((candidate) => candidate.method === method);
  if (
    method === 'confirmContact'
      ? !canContact.value
      : !item || !allowed(method) || !supported(item.event)
  )
    return;
  action.value = method;
  remark.value = '';
  assigneeId.value = undefined;
  evidence.value = '';
  contactAcknowledged.value = false;
  userOptions.value = [];
}
async function searchUsers(containsName = '') {
  if (!detail.value) return;
  const selected = detail.value.id;
  try {
    const result = (await userService.list(
      buildSupportUserQuery(
        { tenantId: detail.value.tenantId, orgId: detail.value.orgId },
        containsName,
      ),
    )) as { items: { id: string; name?: string; realName?: string }[] };
    if (detail.value?.id !== selected) return;
    userOptions.value = (result.items || []).map((item) => ({
      value: item.id,
      label: item.realName || item.name || item.id,
    }));
  } catch {
    message.error('处理人选项不可访问');
  }
}
async function submitAction() {
  if (!detail.value || !action.value || busy.value) return;
  const method = action.value;
  const item = stateActions.find((candidate) => candidate.method === method);
  if (
    method === 'confirmContact'
      ? !canContact.value
      : !item || !allowed(method) || !supported(item.event)
  )
    return;
  if (method === 'assign' && !assigneeId.value) {
    message.error('请选择有效处理人');
    return;
  }
  if (
    method === 'confirmContact' &&
    (!contactAcknowledged.value || !/^[\w.:-]{1,128}$/.test(evidence.value))
  ) {
    message.error('必须核验固定联系人并提供无机密核验记录标识');
    return;
  }
  busy.value = true;
  const command: TicketCommand = {
    ...locator(),
    optimisticLock: detail.value.optimisticLock,
    remark: remark.value || undefined,
  };
  const selected = detailVersion;
  const requestScope = detailScope.value;
  try {
    if (method === 'assign')
      await ticketService.assign({
        ...command,
        assigneeId: assigneeId.value || '',
      });
    else if (method === 'confirmContact')
      await ticketService.confirmContact({
        ...command,
        evidenceReason: evidence.value,
      });
    else await ticketService[method](command);
    if (selected !== detailVersion) return;
    action.value = undefined;
    await open(command.id, requestScope);
    await crudPage.value?.reload();
  } catch {
    message.error('工单操作失败，请刷新核对权限、状态和版本');
  } finally {
    busy.value = false;
  }
}
// 首次发送冻结本次业务请求，技术重试使用同一回复键与内容，不创建第二条外发意图。
function beginReply() {
  if (!canReply.value) return;
  body.value = '';
  attachmentIds.value = [];
  frozenReply.value = undefined;
  replyOpen.value = true;
}
async function submitReply() {
  if (!detail.value || !canReply.value || busy.value) return;
  if (!body.value.trim()) {
    message.error('请输入回复正文');
    return;
  }
  if (attachmentIds.value.length > 20) {
    message.error('每次最多选择二十件关联附件');
    return;
  }
  frozenReply.value ||= {
    ...locator(),
    optimisticLock: detail.value.optimisticLock,
    replyKey: crypto.randomUUID(),
    body: body.value,
    attachmentIds: [...attachmentIds.value],
  };
  busy.value = true;
  try {
    const request = frozenReply.value;
    const selected = detailVersion;
    const result = await ticketService.reply(request);
    if (selected !== detailVersion) return;
    outbound.value = result;
    outboundFresh.value = false;
    replyOpen.value = false;
    await open(request.id, detailScope.value);
    await crudPage.value?.reload();
    message.success('回复已保存，请查看外发受理状态');
  } catch {
    message.error('本次回复提交未确认，可重试相同请求');
  } finally {
    busy.value = false;
  }
}
// 外发读取绑定当前工单和场景；旧范围响应不能恢复核验或重试入口。
async function readOutbound(intentId: string) {
  if (!detail.value || !allowed('outbound')) return;
  const current = ++outboundVersion;
  const selected = detailVersion;
  const target = locator();
  outboundFresh.value = false;
  try {
    const result = await ticketService.outbound({ ...target, intentId });
    if (current !== outboundVersion || selected !== detailVersion) return;
    if (!result || result.ticketId !== target.id || result.id !== intentId) {
      outbound.value = undefined;
      message.error('外发结果不可访问');
      return;
    }
    outbound.value = result;
    outboundFresh.value = true;
    if (
      reviewSnapshot.value &&
      (result.status !== 'Unknown' ||
        result.id !== reviewSnapshot.value.intentId ||
        result.optimisticLock !== reviewSnapshot.value.intentVersion)
    ) {
      reviewOpen.value = false;
      reviewSnapshot.value = undefined;
      reviewConfirmed.value = false;
      reviewEvidence.value = '';
    }
  } catch {
    if (current !== outboundVersion || selected !== detailVersion) return;
    outbound.value = undefined;
    message.error('外发结果不可访问');
  }
}
async function refreshOutbound(record?: TicketOutboundRecord) {
  const current = record || outbound.value;
  if (current) await readOutbound(current.id);
}
async function openOutbound(intentId: string) {
  outbound.value = undefined;
  await readOutbound(intentId);
}
function beginUnsentReview() {
  if (!detail.value || !outbound.value || !canReviewUnsent.value || busy.value)
    return;
  reviewSnapshot.value = {
    ...locator(),
    intentId: outbound.value.id,
    intentVersion: outbound.value.optimisticLock,
  };
  reviewEvidence.value = '';
  reviewConfirmed.value = false;
  reviewOpen.value = true;
}
async function confirmUnsentReview() {
  const snapshot = reviewSnapshot.value;
  if (!snapshot || !outbound.value || !canReviewUnsent.value || busy.value)
    return;
  if (
    snapshot.id !== detail.value?.id ||
    snapshot.intentId !== outbound.value.id ||
    snapshot.intentVersion !== outbound.value.optimisticLock
  ) {
    reviewOpen.value = false;
    message.error('外发版本已变化，请刷新后重新核验');
    return;
  }
  if (
    !reviewConfirmed.value ||
    !/^[\w.:-]{1,128}$/.test(reviewEvidence.value)
  ) {
    message.error('必须明确核验未受理并提供无机密证据引用');
    return;
  }
  const current = ++outboundVersion;
  const selected = detailVersion;
  busy.value = true;
  outboundFresh.value = false;
  try {
    const result = await ticketService.resolveOutboundUnsent({
      ...snapshot,
      verifiedUnsent: true,
      reason: 'VerifiedUnsent',
      evidenceRef: reviewEvidence.value,
    });
    if (current !== outboundVersion || selected !== detailVersion) return;
    if (
      !result ||
      result.id !== snapshot.intentId ||
      result.ticketId !== snapshot.id
    ) {
      outbound.value = undefined;
      message.error('外发结果不可访问');
      return;
    }
    outbound.value = result;
    reviewOpen.value = false;
    reviewSnapshot.value = undefined;
    message.success('未受理核验已记录；请刷新外发结果后再单独决定是否重试');
  } catch {
    if (current === outboundVersion && selected === detailVersion) {
      outbound.value = undefined;
      reviewOpen.value = false;
      message.error('核验失败，请重新读取当前外发状态与权限');
    }
  } finally {
    busy.value = false;
  }
}
async function retryOutbound() {
  if (!detail.value || !outbound.value || !canRetryOutbound.value || busy.value)
    return;
  const current = ++outboundVersion;
  const selected = detailVersion;
  const target = {
    ...locator(),
    intentId: outbound.value.id,
    intentVersion: outbound.value.optimisticLock,
  };
  busy.value = true;
  outboundFresh.value = false;
  try {
    const result = await ticketService.retryOutbound(target);
    if (current !== outboundVersion || selected !== detailVersion) return;
    if (result.ticketId !== target.id || result.id !== target.intentId) {
      outbound.value = undefined;
      return;
    }
    outbound.value = result;
  } catch {
    if (current === outboundVersion && selected === detailVersion) {
      outbound.value = undefined;
      message.error('重试失败，请刷新核对外发状态和版本');
    }
  } finally {
    busy.value = false;
  }
}
async function fullMessage(record: TicketMessageRecord) {
  if (!detail.value || !allowed('message')) return;
  try {
    expandedMessage.value = await ticketService.message({
      ...locator(),
      messageId: record.id,
    });
  } catch {
    message.error('消息详情不可访问');
  }
}
async function download(blobId: string) {
  if (!detail.value || !allowed('attachmentDownload') || busy.value) return;
  const current = detailVersion;
  busy.value = true;
  try {
    const result = await ticketService.attachmentDownload({
      ...locator(),
      blobId,
    });
    if (current !== detailVersion) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.fileName;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    message.error('工单附件不可访问或已失效');
  } finally {
    busy.value = false;
  }
}
function openInbox(id: string) {
  if (/^[A-Z0-9][\w.:-]{0,63}$/i.test(id))
    void router.push({ path: '/clob/V1/Inbox', query: { id } });
}
onMounted(async () => {
  try {
    const [stateOptions, directionOptions] = await Promise.all([
      moduleFetchEnumOptions('com.levin.oak.base.entities.enums.TicketStatus'),
      moduleFetchEnumOptions(
        'com.levin.oak.base.entities.TicketMessage$Direction',
      ),
    ]);
    statuses.value = stateOptions.map((item) => ({
      label: item.label,
      value: String(item.value),
    }));
    directions.value = directionOptions.map((item) => ({
      label: item.label,
      value: String(item.value),
    }));
  } catch {
    error.value = '工单展示选项加载失败';
  }
  await deepLink(route.query.id);
});
watch(() => route.query.id, deepLink);
</script>
<template>
  <div class="flex min-w-0 flex-col gap-2">
    <CrudPage :key="scopeGeneration" ref="crudPage" :config="crudConfig">
      <template #search-field-orgId="slot">
        <SupportScopeSelector
          :model-value="scopeSelection(searchScopeState(slot))"
          placeholder="全部授权范围"
          @change="changeScope($event, searchScopeState(slot))"
        />
      </template>
      <template #toolbar-extra="{ isListOperationVisible }">
        <Button
          v-if="isListOperationVisible('ticket:help')"
          @click="router.push(helpDocumentUrl('mail-ticket-guide'))"
        >
          帮助
        </Button>
      </template>
      <template #row-actions="{ record }">
        <Button
          v-if="allowed('retrieve')"
          size="small"
          type="link"
          @click="open(String(record.id))"
        >
          查看工单
        </Button>
      </template>
    </CrudPage>
    <div class="contents">
      <Modal
        v-model:open="opened"
        :title="detail?.title || '客服工单'"
        width="1120px"
        :footer="null"
      >
        <template v-if="detail">
          <Descriptions :column="2">
            <Descriptions.Item label="工单状态">
              {{ stateLabel(detail.status) }}
            </Descriptions.Item>
            <Descriptions.Item label="支持邮箱">
              {{ detail.supportEmail }}
            </Descriptions.Item>
            <Descriptions.Item label="固定请求人邮箱">
              {{ detail.requesterEmail }}
            </Descriptions.Item>
            <Descriptions.Item label="联系人确认">
              {{ contactConfirmed ? '已确认' : '待核验' }}
            </Descriptions.Item>
          </Descriptions>
          <div class="my-4 flex flex-wrap gap-2">
            <template v-for="item in stateActions" :key="item.method">
              <Button
                v-if="allowed(item.method) && supported(item.event)"
                @click="begin(item.method)"
              >
                {{ item.label }}
              </Button>
            </template>
            <Button
              v-if="canContact && !contactConfirmed"
              @click="begin('confirmContact')"
            >
              核验联系人
            </Button>
            <Button v-if="canReply" @click="beginReply">邮件回复</Button>
          </div>
          <Alert
            v-if="!contactConfirmed"
            type="info"
            message="发出邮件回复前须明确核验当前固定联系人。"
          />
          <h3>工单会话</h3>
          <Alert v-if="messageError" type="error" :message="messageError" />
          <article
            v-for="item in messages"
            :key="item.id"
            class="my-3 rounded border p-3"
          >
            <div>
              {{ directionLabel(item.direction) }} ·
              {{ item.createTime || item.occurredTime }}
            </div>
            <pre class="max-h-72 overflow-auto whitespace-pre-wrap">{{
              item.body
            }}</pre>
            <Button
              v-if="item.bodyTruncated && allowed('message')"
              type="link"
              @click="fullMessage(item)"
            >
              查看完整消息
            </Button>
            <Button
              v-if="item.sourceInboxId"
              type="link"
              @click="openInbox(item.sourceInboxId)"
            >
              查看来源邮件
            </Button>
            <Button
              v-if="item.outboundIntentId && allowed('outbound')"
              type="link"
              @click="openOutbound(item.outboundIntentId)"
            >
              查看外发结果
            </Button>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="(id, index) in item.attachmentFileIds || []"
                :key="id"
                :disabled="!allowed('attachmentDownload')"
                :loading="busy"
                @click="download(id)"
              >
                下载会话附件 {{ index + 1 }}
              </Button>
            </div>
          </article>
          <Pagination
            v-if="allowed('messages')"
            :current="messagePage"
            :total="messageTotal"
            :page-size="20"
            :show-size-changer="false"
            @change="loadMessages"
          />
          <section v-if="outbound" class="my-4">
            <h3>工单外发结果</h3>
            <div>
              {{ outboundLabels[outbound.status] || '状态不可用' }} · 已尝试
              {{ outbound.attemptCount }} 次
            </div>
            <div v-if="outbound.submittedTime">
              SMTP 受理时间：{{ outbound.submittedTime }}
            </div>
            <Alert
              v-if="outbound.status === 'Unknown'"
              type="warning"
              message="外发结果不明，须核验渠道；邮箱未收到不足以证明未受理，不能直接重发。"
            />
            <Button
              v-if="canReviewUnsent"
              :loading="busy"
              @click="beginUnsentReview"
            >
              核验工单邮件未受理
            </Button>
            <Button v-if="allowed('outbound')" @click="refreshOutbound()">
              刷新外发结果
            </Button>
            <Button
              v-if="canRetryOutbound"
              :loading="busy"
              @click="retryOutbound"
            >
              重试发送前失败
            </Button>
          </section>
          <h3>流程日志</h3>
          <Timeline>
            <Timeline.Item v-for="(log, index) in logs" :key="index">
              <div>{{ log.occurTime }}</div>
              <div>{{ log.operator }}</div>
              <div>
                {{ stateLabel(log.beforeStatus) }} → {{ log.action }} →
                {{ stateLabel(log.afterStatus) }}
              </div>
              <div v-if="log.remark?.trim()">{{ log.remark }}</div>
            </Timeline.Item>
          </Timeline>
        </template>
      </Modal>
      <Modal
        :open="Boolean(action)"
        :title="action === 'confirmContact' ? '核验固定联系人' : '执行工单操作'"
        :confirm-loading="busy"
        @cancel="action = undefined"
        @ok="submitAction"
      >
        <Form
          id="ticket-action"
          name="ticketAction"
          data-form-id="ticket-action"
          data-form-name="执行工单操作"
          layout="vertical"
        >
          <Form.Item v-if="action === 'assign'" label="目标处理人" required>
            <Select
              v-model:value="assigneeId"
              show-search
              :filter-option="false"
              :options="userOptions"
              @search="searchUsers"
              @focus="searchUsers()"
            />
          </Form.Item>
          <template v-if="action === 'confirmContact'">
            <p>核验邮箱：{{ detail?.requesterEmail }}</p>
            <Input
              v-model:value="evidence"
              :maxlength="128"
              placeholder="无机密核验记录标识"
            />
            <Checkbox v-model:checked="contactAcknowledged">
              我已核验该固定联系人
            </Checkbox>
          </template>
          <Form.Item v-else label="处理说明">
            <Input.TextArea v-model:value="remark" :maxlength="512" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        v-model:open="replyOpen"
        title="发送工单邮件回复"
        :confirm-loading="busy"
        @ok="submitReply"
      >
        <Form
          id="ticket-email-reply"
          name="ticketEmailReply"
          data-form-id="ticket-email-reply"
          data-form-name="发送工单邮件回复"
          layout="vertical"
        >
          <Form.Item label="固定收件人">
            {{ detail?.confirmedContactEmail }}
          </Form.Item>
          <Form.Item label="纯文本回复正文" required>
            <Input.TextArea
              v-model:value="body"
              :disabled="Boolean(frozenReply)"
              :maxlength="100000"
              :rows="8"
            />
          </Form.Item>
          <Form.Item label="当前会话私有附件（最多二十件）">
            <Select
              v-model:value="attachmentIds"
              mode="multiple"
              :disabled="Boolean(frozenReply)"
              :options="replyAttachments"
            />
          </Form.Item>
          <Alert
            v-if="frozenReply"
            type="info"
            message="本次请求内容已固定；技术重试复用同一个回复标识。"
          />
        </Form>
      </Modal>
      <Modal
        v-model:open="reviewOpen"
        title="核验工单邮件未受理"
        :confirm-loading="busy"
        @ok="confirmUnsentReview"
      >
        <Alert
          type="warning"
          message="须已完成供应商或线下核验；邮箱未收到不足以证明未受理。本操作不发送邮件，后续重试须另行明确操作。"
        />
        <Input
          v-model:value="reviewEvidence"
          :maxlength="128"
          placeholder="无机密证据记录标识，禁止URL、token或原文"
          class="my-4"
        />
        <Checkbox v-model:checked="reviewConfirmed">
          我已核验供应商未受理本次工单邮件
        </Checkbox>
      </Modal>
      <Modal
        :open="Boolean(expandedMessage)"
        title="工单消息详情"
        :footer="null"
        @cancel="expandedMessage = undefined"
      >
        <pre class="max-h-72 overflow-auto whitespace-pre-wrap">{{
          expandedMessage?.body
        }}</pre>
      </Modal>
    </div>
  </div>
</template>
