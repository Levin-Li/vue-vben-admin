<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Modal,
  Spin,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';

import { noticeService } from '@levin/oak-base-admin/modules/com_levin_oak_base/api/index';

type NoticeProcessStatus = 'Finished' | 'Processing' | 'Rejected';
type MessageFilter = 'all' | 'read' | 'unread';

interface MyNoticeMessage {
  category?: string;
  content?: string;
  contentType?: string;
  createTime?: string;
  expiredTime?: string;
  id?: number | string;
  lastUpdateTime?: string;
  level?: string;
  name?: string;
  noticeId?: number | string;
  processLogId?: number | string;
  processRemark?: string;
  processStatus?: NoticeProcessStatus;
  processTime?: string;
  publishTime?: string;
  subtitle?: string;
  title?: string;
}

const loading = ref(false);
const loadingMore = ref(false);
const errorMessage = ref('');
const messages = ref<MyNoticeMessage[]>([]);
const activeFilter = ref<MessageFilter>('unread');
const detailOpen = ref(false);
const activeMessage = ref<MyNoticeMessage | null>(null);
const processingIds = ref(new Set<string>());
const selectedIds = ref(new Set<string>());
const pageIndex = ref(0);
const totalCount = ref(0);
const hasMore = ref(true);
const MESSAGE_PAGE_SIZE = 7;
const noticeLevelLabelMap: Record<string, string> = {
  Important: '重要',
  Normal: '普通',
  Urgent: '紧急',
  VeryUrgent: '非常紧急',
  VeryVeryUrgent: '非常非常紧急',
};
const noticeLevelColorMap: Record<string, string> = {
  Important: 'orange',
  Normal: 'default',
  Urgent: 'red',
  VeryUrgent: 'magenta',
  VeryVeryUrgent: 'volcano',
};

const unreadCount = computed(
  () =>
    messages.value.filter((item) => item.processStatus !== 'Finished').length,
);
const loadedCountText = computed(() => {
  if (totalCount.value <= 0) {
    return String(messages.value.length);
  }

  return `${messages.value.length}/${totalCount.value}`;
});

const filteredMessages = computed(() => {
  if (activeFilter.value === 'read') {
    return messages.value.filter((item) => item.processStatus === 'Finished');
  }

  if (activeFilter.value === 'unread') {
    return messages.value.filter((item) => item.processStatus !== 'Finished');
  }

  return messages.value;
});

const selectedMessages = computed(() =>
  messages.value.filter((item) => selectedIds.value.has(getMessageId(item))),
);

const selectedUnreadMessages = computed(() =>
  selectedMessages.value.filter((item) => item.processStatus !== 'Finished'),
);

const filteredSelectedCount = computed(
  () =>
    filteredMessages.value.filter((item) =>
      selectedIds.value.has(getMessageId(item)),
    ).length,
);

const allFilteredSelected = computed(
  () =>
    filteredMessages.value.length > 0 &&
    filteredSelectedCount.value === filteredMessages.value.length,
);

const filteredSelectionIndeterminate = computed(
  () =>
    filteredSelectedCount.value > 0 &&
    filteredSelectedCount.value < filteredMessages.value.length,
);

function normalizeListItems<T>(data: any): T[] {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.items || data?.records || data?.list || [];
}

function getPagingTotal(data: any) {
  const total = Number(data?.totals ?? data?.total ?? data?.totalCount ?? 0);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

function getMessageId(item: MyNoticeMessage) {
  return String(item.noticeId || item.id || '').trim();
}

function getMessageTitle(item: MyNoticeMessage) {
  return String(item.title || item.name || '通知').trim();
}

function getNoticeLevelValue(item?: MyNoticeMessage | null) {
  return String(item?.level || '').trim();
}

function getNoticeLevelLabel(item?: MyNoticeMessage | null) {
  const level = getNoticeLevelValue(item);
  return noticeLevelLabelMap[level] || level;
}

function getNoticeLevelColor(item?: MyNoticeMessage | null) {
  return noticeLevelColorMap[getNoticeLevelValue(item)] || 'default';
}

function stripContent(content?: string) {
  return String(content || '')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function getMessageSummary(item: MyNoticeMessage) {
  return String(item.subtitle || stripContent(item.content) || '请查看通知详情')
    .trim()
    .slice(0, 160);
}

function getMessageContent(item?: MyNoticeMessage | null) {
  if (!item) {
    return '';
  }

  return stripContent(item.content) || item.subtitle || '暂无内容';
}

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return value;
  }

  return value.replace('T', ' ').slice(0, 19);
}

function getStatusLabel(item: MyNoticeMessage) {
  return item.processStatus === 'Finished' ? '已读' : '未读';
}

function getStatusColor(item: MyNoticeMessage) {
  return item.processStatus === 'Finished' ? 'default' : 'processing';
}

function isProcessing(item: MyNoticeMessage) {
  return processingIds.value.has(getMessageId(item));
}

function isSelected(item: MyNoticeMessage) {
  return selectedIds.value.has(getMessageId(item));
}

function setProcessing(item: MyNoticeMessage, value: boolean) {
  const next = new Set(processingIds.value);
  const id = getMessageId(item);

  if (value) {
    next.add(id);
  } else {
    next.delete(id);
  }

  processingIds.value = next;
}

function setSelected(item: MyNoticeMessage, value: boolean) {
  const next = new Set(selectedIds.value);
  const id = getMessageId(item);

  if (!id) {
    return;
  }

  if (value) {
    next.add(id);
  } else {
    next.delete(id);
  }

  selectedIds.value = next;
}

function handleSelectChange(
  item: MyNoticeMessage,
  event: { target: { checked: boolean } },
) {
  setSelected(item, event.target.checked);
}

function handleSelectAllChange(event: { target: { checked: boolean } }) {
  const next = new Set(selectedIds.value);

  filteredMessages.value.forEach((item) => {
    const id = getMessageId(item);
    if (!id) {
      return;
    }

    if (event.target.checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
  });

  selectedIds.value = next;
}

function clearSelectedItems(items: MyNoticeMessage[]) {
  const removeIds = new Set(items.map((item) => getMessageId(item)));
  selectedIds.value = new Set(
    [...selectedIds.value].filter((id) => !removeIds.has(id)),
  );
}

function mergeMessages(
  currentMessages: MyNoticeMessage[],
  nextMessages: MyNoticeMessage[],
) {
  const messageMap = new Map<string, MyNoticeMessage>();
  [...currentMessages, ...nextMessages].forEach((item) => {
    const id = getMessageId(item);
    if (id) {
      messageMap.set(id, item);
    }
  });
  return [...messageMap.values()];
}

async function loadMessages(reset = true) {
  if (!reset && (loading.value || loadingMore.value || !hasMore.value)) {
    return;
  }

  if (reset) {
    loading.value = true;
    pageIndex.value = 0;
    totalCount.value = 0;
    hasMore.value = true;
    selectedIds.value = new Set();
  } else {
    loadingMore.value = true;
  }

  errorMessage.value = '';

  try {
    const nextPageIndex = reset ? 1 : pageIndex.value + 1;
    const result = await noticeService.myMessages({
      pageIndex: nextPageIndex,
      pageSize: MESSAGE_PAGE_SIZE,
    });
    const pagingResult = (result || {}) as Record<string, any>;
    const nextItems = normalizeListItems<MyNoticeMessage>(pagingResult);
    const total = getPagingTotal(pagingResult);

    messages.value = reset
      ? nextItems
      : mergeMessages(messages.value, nextItems);
    pageIndex.value = nextPageIndex;
    totalCount.value = total || messages.value.length;
    hasMore.value =
      typeof pagingResult.hasMore === 'boolean'
        ? pagingResult.hasMore
        : nextItems.length >= MESSAGE_PAGE_SIZE &&
          messages.value.length < totalCount.value;
  } catch (error) {
    console.error(error);
    errorMessage.value = '我的消息加载失败';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadNextPage() {
  await loadMessages(false);
}

async function ensureCurrentFilterPageFilled() {
  while (
    !loading.value &&
    !loadingMore.value &&
    hasMore.value &&
    filteredMessages.value.length < MESSAGE_PAGE_SIZE
  ) {
    await loadMessages(false);
  }
}

function handleMessagesScroll(event: Event) {
  const target = event.currentTarget as HTMLElement | null;
  if (!target) {
    return;
  }

  const distanceToBottom =
    target.scrollHeight - target.scrollTop - target.clientHeight;
  if (distanceToBottom <= 96) {
    loadNextPage();
  }
}

async function processMessage(
  item: MyNoticeMessage,
  status: NoticeProcessStatus,
  remark: string,
) {
  setProcessing(item, true);

  try {
    const result = (await noticeService.processMyMessage({
      noticeId: getMessageId(item),
      remark,
      status,
    })) as MyNoticeMessage | undefined;

    if (status === 'Rejected') {
      messages.value = messages.value.filter(
        (messageItem) => getMessageId(messageItem) !== getMessageId(item),
      );
      totalCount.value = Math.max(0, totalCount.value - 1);
      if (
        activeMessage.value &&
        getMessageId(activeMessage.value) === getMessageId(item)
      ) {
        detailOpen.value = false;
        activeMessage.value = null;
      }
      return;
    }

    const updated: MyNoticeMessage = {
      ...item,
      ...(result && typeof result === 'object' ? result : {}),
      processStatus: status,
      processRemark: remark,
    };
    messages.value = messages.value.map((messageItem) =>
      getMessageId(messageItem) === getMessageId(item) ? updated : messageItem,
    );

    if (
      activeMessage.value &&
      getMessageId(activeMessage.value) === getMessageId(item)
    ) {
      activeMessage.value = updated;
    }
  } finally {
    setProcessing(item, false);
  }
}

async function openMessage(item: MyNoticeMessage) {
  activeMessage.value = item;
  detailOpen.value = true;

  if (item.processStatus !== 'Finished') {
    await processMessage(item, 'Finished', '用户查看消息');
  }
}

async function markRead(item: MyNoticeMessage) {
  await processMessage(item, 'Finished', '用户标记已读');
  message.success('已标记为已读');
}

async function markSelectedRead() {
  const targets = [...selectedUnreadMessages.value];

  if (targets.length === 0) {
    message.info('请选择未读消息');
    return;
  }

  for (const item of targets) {
    await processMessage(item, 'Finished', '用户批量标记已读');
  }

  clearSelectedItems(targets);
  message.success(`已标记 ${targets.length} 条为已读`);
}

function rejectMessage(item: MyNoticeMessage) {
  Modal.confirm({
    content: `拒绝后，该消息将从我的消息中移除。`,
    okButtonProps: { danger: true },
    okText: '拒绝',
    title: `拒绝「${getMessageTitle(item)}」`,
    async onOk() {
      await processMessage(item, 'Rejected', '用户拒绝消息');
      message.success('消息已拒绝');
    },
  });
}

function rejectSelectedMessages() {
  const targets = [...selectedMessages.value];

  if (targets.length === 0) {
    message.info('请选择消息');
    return;
  }

  Modal.confirm({
    content: `拒绝后，选中的 ${targets.length} 条消息将从我的消息中移除。`,
    okButtonProps: { danger: true },
    okText: '拒绝',
    title: '批量拒绝消息',
    async onOk() {
      for (const item of targets) {
        await processMessage(item, 'Rejected', '用户批量拒绝消息');
      }
      clearSelectedItems(targets);
      message.success(`已拒绝 ${targets.length} 条消息`);
    },
  });
}

watch(
  activeFilter,
  () => {
    ensureCurrentFilterPageFilled();
  },
  { flush: 'post' },
);

watch(
  messages,
  (items) => {
    const validIds = new Set(items.map((item) => getMessageId(item)));
    selectedIds.value = new Set(
      [...selectedIds.value].filter((id) => validIds.has(id)),
    );
    ensureCurrentFilterPageFilled();
  },
  { deep: true },
);

onMounted(loadMessages);
</script>

<template>
  <Page
    auto-content-height
    content-class="!bg-transparent !p-0 min-w-0 !overflow-hidden"
  >
    <div class="my-messages-page flex h-full min-h-0 flex-col">
      <div
        class="my-messages-toolbar flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <div class="text-base font-semibold text-foreground">我的消息</div>
          <Tag color="blue">已加载 {{ loadedCountText }}</Tag>
          <Tag v-if="unreadCount > 0" color="processing">
            未读 {{ unreadCount }}
          </Tag>
          <Tag v-if="selectedMessages.length > 0" color="purple">
            已选 {{ selectedMessages.length }}
          </Tag>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2">
          <Checkbox
            :checked="allFilteredSelected"
            :indeterminate="filteredSelectionIndeterminate"
            @change="handleSelectAllChange"
          >
            全选
          </Checkbox>
          <Button
            :disabled="selectedUnreadMessages.length === 0"
            size="small"
            @click="markSelectedRead"
          >
            <IconifyIcon class="size-4" icon="lucide:check-check" />
            批量已读
          </Button>
          <Button
            :disabled="selectedMessages.length === 0"
            danger
            size="small"
            @click="rejectSelectedMessages"
          >
            <IconifyIcon class="size-4" icon="lucide:bell-off" />
            批量拒绝
          </Button>
          <div class="flex rounded-md border bg-background p-0.5">
            <Button
              :type="activeFilter === 'all' ? 'primary' : 'text'"
              size="small"
              @click="activeFilter = 'all'"
            >
              全部
            </Button>
            <Button
              :type="activeFilter === 'unread' ? 'primary' : 'text'"
              size="small"
              @click="activeFilter = 'unread'"
            >
              未读
            </Button>
            <Button
              :type="activeFilter === 'read' ? 'primary' : 'text'"
              size="small"
              @click="activeFilter = 'read'"
            >
              已读
            </Button>
          </div>
          <Tooltip title="刷新">
            <Button
              :loading="loading"
              aria-label="刷新"
              shape="circle"
              type="text"
              @click="() => loadMessages()"
            >
              <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        class="m-4"
        show-icon
        type="error"
      />

      <Spin :spinning="loading" class="min-h-0 flex-1 overflow-hidden">
        <div
          class="h-full overflow-auto px-4 py-3"
          @scroll="handleMessagesScroll"
        >
          <Empty
            v-if="!loading && filteredMessages.length === 0 && !hasMore"
            class="mt-20"
            description="暂无消息"
          />

          <div v-else class="grid gap-2">
            <div
              v-for="item in filteredMessages"
              :key="getMessageId(item)"
              class="message-row grid min-w-0 gap-3 border-b bg-card px-4 py-3 md:grid-cols-[auto_1fr_auto]"
            >
              <Checkbox
                :checked="isSelected(item)"
                class="mt-1"
                @change="handleSelectChange(item, $event)"
                @click.stop
              />
              <button
                class="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left"
                type="button"
                @click="openMessage(item)"
              >
                <div class="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                  <Tag :color="getStatusColor(item)">
                    {{ getStatusLabel(item) }}
                  </Tag>
                  <Tag
                    v-if="getNoticeLevelValue(item)"
                    :color="getNoticeLevelColor(item)"
                  >
                    {{ getNoticeLevelLabel(item) }}
                  </Tag>
                  <Tag v-if="item.category">{{ item.category }}</Tag>
                  <span class="truncate text-sm font-semibold text-foreground">
                    {{ getMessageTitle(item) }}
                  </span>
                </div>
                <div class="line-clamp-2 text-sm text-muted-foreground">
                  {{ getMessageSummary(item) }}
                </div>
                <div
                  class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
                >
                  <span
                    >发布：{{
                      formatDate(item.publishTime || item.createTime)
                    }}</span
                  >
                  <span>过期：{{ formatDate(item.expiredTime) }}</span>
                </div>
              </button>

              <div class="flex items-center justify-end gap-2">
                <Button size="small" type="link" @click="openMessage(item)">
                  <IconifyIcon class="size-4" icon="lucide:eye" />
                  查看
                </Button>
                <Button
                  v-if="item.processStatus !== 'Finished'"
                  :loading="isProcessing(item)"
                  size="small"
                  type="link"
                  @click="markRead(item)"
                >
                  <IconifyIcon class="size-4" icon="lucide:check-check" />
                  已读
                </Button>
                <Button
                  :loading="isProcessing(item)"
                  danger
                  size="small"
                  type="link"
                  @click="rejectMessage(item)"
                >
                  <IconifyIcon class="size-4" icon="lucide:bell-off" />
                  拒绝
                </Button>
              </div>
            </div>

            <div
              v-if="messages.length > 0 || loadingMore || hasMore"
              class="flex-center py-4 text-xs text-muted-foreground"
            >
              <template v-if="loadingMore">加载中...</template>
              <template v-else-if="hasMore">继续下滑加载更多</template>
              <template v-else>没有更多消息</template>
            </div>
          </div>
        </div>
      </Spin>

      <Modal
        v-model:open="detailOpen"
        :footer="null"
        :title="activeMessage ? getMessageTitle(activeMessage) : '消息详情'"
        width="720px"
      >
        <div v-if="activeMessage" class="grid gap-4">
          <div class="flex flex-wrap items-center gap-2">
            <Tag :color="getStatusColor(activeMessage)">
              {{ getStatusLabel(activeMessage) }}
            </Tag>
            <Tag
              v-if="getNoticeLevelValue(activeMessage)"
              :color="getNoticeLevelColor(activeMessage)"
            >
              {{ getNoticeLevelLabel(activeMessage) }}
            </Tag>
            <Tag v-if="activeMessage.category">{{
              activeMessage.category
            }}</Tag>
            <span class="text-xs text-muted-foreground">
              {{
                formatDate(
                  activeMessage.publishTime || activeMessage.createTime,
                )
              }}
            </span>
          </div>

          <div
            v-if="activeMessage.subtitle"
            class="text-sm text-muted-foreground"
          >
            {{ activeMessage.subtitle }}
          </div>

          <pre
            class="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-6 text-foreground"
            >{{ getMessageContent(activeMessage) }}</pre
          >

          <div class="flex justify-end gap-2">
            <Button @click="detailOpen = false">关闭</Button>
            <Button danger @click="rejectMessage(activeMessage)">
              <IconifyIcon class="size-4" icon="lucide:bell-off" />
              拒绝消息
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.my-messages-page :deep(.ant-spin-nested-loading),
.my-messages-page :deep(.ant-spin-container) {
  height: 100%;
  min-height: 0;
}

.message-row {
  border-color: hsl(var(--border));
}
</style>
