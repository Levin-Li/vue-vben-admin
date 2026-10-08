<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type { InboxRecord } from '../../api/inbox-service';
import type { SupportScope } from '../../api/support-workbench-types';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Alert,
  Button,
  Descriptions,
  Input,
  message,
  Modal,
  Select,
  Table,
} from 'ant-design-vue';

import { inboxService } from '../../api/inbox-service';
import { supportMailboxRuleService } from '../../api/support-mailbox-rule-service';
import SupportScopeSelector from '../support-scope-selector.vue';

// 邮件正文与会话头只按授权详情读取，HTML 作为文本展示，不执行外部内容。
const { hasPermission } = useRbacAccess();
const route = useRoute();
const router = useRouter();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(inboxService, method));
const scope = ref<SupportScope>();
const rows = ref<InboxRecord[]>([]);
const subject = ref('');
const pageIndex = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const detail = ref<InboxRecord>();
const opened = ref(false);
const mime = ref('');
const showHtmlSource = ref(false);
const mimeOpen = ref(false);
const pending = ref(false);
const intakeOpen = ref(false);
const ruleId = ref<string>();
const rulePage = ref(1);
const ruleTotal = ref(0);
const ruleOptions = ref<{ label: string; value: string }[]>([]);
const canIntake = computed(
  () => allowed('intake') && Boolean(scope.value) && Boolean(detail.value),
);
const columns = [
  { title: '主题', dataIndex: 'subject' },
  { title: '发件人', dataIndex: 'fromEmail' },
  { title: '收件人', dataIndex: 'recipientEmail' },
  { title: '接收时间', dataIndex: 'receivedTime' },
  { title: '解析状态', dataIndex: 'parseStatus' },
  { title: '操作', key: 'actions' },
];
let listVersion = 0;
let detailVersion = 0;
async function load(page = pageIndex.value) {
  const current = ++listVersion;
  rows.value = [];
  error.value = '';
  if (!allowed('list')) return;
  loading.value = true;
  try {
    const result = await inboxService.list({
      ...scope.value,
      subject: subject.value || undefined,
      pageIndex: page,
      pageSize: 20,
    });
    if (current !== listVersion) return;
    rows.value = result.items || [];
    total.value = result.totals || 0;
    pageIndex.value = page;
  } catch {
    if (current === listVersion) error.value = '收件箱不可访问，请重试';
  } finally {
    if (current === listVersion) loading.value = false;
  }
}
async function open(id: string) {
  const current = ++detailVersion;
  detail.value = undefined;
  opened.value = false;
  error.value = '';
  if (!allowed('retrieve')) {
    error.value = '邮件来源不可访问';
    return;
  }
  try {
    const result = await inboxService.retrieve({ id, ...scope.value });
    if (current !== detailVersion) return;
    detail.value = result;
    showHtmlSource.value = false;
    opened.value = true;
  } catch {
    if (current === detailVersion) error.value = '邮件来源不可访问或已失效';
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
  mimeOpen.value = false;
  intakeOpen.value = false;
  total.value = 0;
  void load(1);
}
async function loadDeepLink(value: unknown) {
  if (value === undefined) return;
  if (typeof value !== 'string' || !/^[A-Z0-9][\w.:-]{0,63}$/i.test(value)) {
    error.value = '邮件定位参数无效';
    return;
  }
  await open(value);
}
// 私有文件经同一受控 HTTP 客户端下载；对象 URL 只存在于当前下载动作。
async function download(blobId: string, preview = false) {
  if (!detail.value || !allowed('download') || pending.value) return;
  const current = detailVersion;
  pending.value = true;
  try {
    const result = await inboxService.download({
      id: detail.value.id,
      ...scope.value,
      blobId,
    });
    if (current !== detailVersion) return;
    if (preview) {
      const text = await result.blob.slice(0, 128_000).text();
      if (current !== detailVersion) return;
      mime.value = text;
      if (result.blob.size > 128_000)
        mime.value += '\n[预览已截断，请下载完整原始邮件]';
      mimeOpen.value = true;
    } else {
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
    }
  } catch {
    message.error('私有文件不可访问或已失效');
  } finally {
    pending.value = false;
  }
}
async function loadRules(page = 1) {
  if (!scope.value) return;
  try {
    const result = await supportMailboxRuleService.list({
      ...scope.value,
      pageIndex: page,
      pageSize: 20,
    });
    ruleOptions.value = result.items
      .filter(
        (item) =>
          item.enabled &&
          item.email.toLowerCase() ===
            detail.value?.recipientEmail?.toLowerCase(),
      )
      .map((item) => ({ value: item.id, label: item.email }));
    ruleTotal.value = result.totals;
    rulePage.value = page;
  } catch {
    message.error('受理规则不可访问');
  }
}
async function beginIntake() {
  if (!canIntake.value) return;
  ruleId.value = undefined;
  await loadRules();
  intakeOpen.value = true;
}
async function intake() {
  if (!canIntake.value || !detail.value || pending.value) return;
  if (!ruleId.value) {
    message.error('请选择已启用的匹配受理规则');
    return;
  }
  pending.value = true;
  try {
    const ticketId = await inboxService.intake({
      id: detail.value.id,
      ...scope.value,
      supportMailboxRuleId: ruleId.value,
    });
    intakeOpen.value = false;
    message.success('已转为工单');
    await router.push({ path: '/clob/V1/Ticket', query: { id: ticketId } });
  } catch {
    message.error('转工单失败，请核对收件范围和受理规则');
  } finally {
    pending.value = false;
  }
}
onMounted(async () => {
  await load(1);
  await loadDeepLink(route.query.id);
});
watch(() => route.query.id, loadDeepLink);
</script>
<template>
  <Page title="收件箱">
    <div class="bg-card grid gap-4 rounded-lg p-4">
      <SupportScopeSelector @change="changeScope" />
      <Alert v-if="error" type="error" :message="error" />
      <div class="flex gap-2">
        <Input
          v-model:value="subject"
          placeholder="主题精确查询"
          :maxlength="512"
        />
        <Button v-if="allowed('list')" @click="load(1)">查询</Button>
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
          <Button
            v-if="column.key === 'actions' && allowed('retrieve')"
            type="link"
            @click="open(record.id)"
          >
            查看邮件
          </Button>
        </template>
      </Table>
      <Modal
        v-model:open="opened"
        :title="detail?.subject || '邮件详情'"
        width="960px"
        :footer="null"
      >
        <template v-if="detail">
          <Descriptions :column="1">
            <Descriptions.Item label="发件人">
              {{ detail.fromEmail }}
            </Descriptions.Item>
            <Descriptions.Item label="收件人">
              {{ detail.recipientEmail }}
            </Descriptions.Item>
            <Descriptions.Item label="Message-ID">
              {{ detail.messageIdHeader || '-' }}
            </Descriptions.Item>
            <Descriptions.Item label="In-Reply-To">
              {{ detail.inReplyToHeader || '-' }}
            </Descriptions.Item>
            <Descriptions.Item label="References">
              {{ detail.referencesHeader || '-' }}
            </Descriptions.Item>
          </Descriptions>
          <Alert
            v-if="detail.processError"
            type="warning"
            :message="detail.processError"
          />
          <h3>邮件正文</h3>
          <Button
            v-if="detail.htmlContent"
            @click="showHtmlSource = !showHtmlSource"
          >
            {{ showHtmlSource ? '显示纯文本' : '显示 HTML 源文本' }}
          </Button>
          <pre class="max-h-96 overflow-auto whitespace-pre-wrap">{{
            detail.textContent || detail.htmlContent || '暂无正文'
          }}</pre>
          <h3>私有附件</h3>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="(id, index) in detail.attachmentFileIds || []"
              :key="id"
              :disabled="!allowed('download')"
              :loading="pending"
              @click="download(id)"
            >
              下载附件 {{ index + 1 }}
            </Button>
          </div>
          <div class="mt-4 flex gap-2">
            <Button
              v-if="detail.rawMimeFileId && allowed('download')"
              :loading="pending"
              @click="download(detail.rawMimeFileId, true)"
            >
              查看原始 MIME
            </Button>
            <Button
              v-if="detail.rawMimeFileId && allowed('download')"
              :loading="pending"
              @click="download(detail.rawMimeFileId)"
            >
              下载原始 MIME
            </Button>
            <Button v-if="canIntake" @click="beginIntake">收件转工单</Button>
          </div>
        </template>
      </Modal>
      <Modal
        v-model:open="mimeOpen"
        title="原始 MIME 文本预览"
        width="960px"
        :footer="null"
      >
        <pre class="max-h-[70vh] overflow-auto whitespace-pre-wrap">{{
          mime
        }}</pre>
      </Modal>
      <Modal
        v-model:open="intakeOpen"
        title="选择支持邮箱受理规则"
        :confirm-loading="pending"
        @ok="intake"
      >
        <Select
          v-model:value="ruleId"
          :options="ruleOptions"
          class="w-full"
          placeholder="匹配当前收件地址的启用规则"
        />
        <div class="mt-4 flex gap-2">
          <Button :disabled="rulePage <= 1" @click="loadRules(rulePage - 1)">
            上一页
          </Button>
          <Button
            :disabled="rulePage * 20 >= ruleTotal"
            @click="loadRules(rulePage + 1)"
          >
            下一页
          </Button>
        </div>
      </Modal>
    </div>
  </Page>
</template>
