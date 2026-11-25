<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';
import type {
  TicketMessageRecord,
  TicketQueueChoice,
  TicketRecord,
} from '../../api/ticket-service';

import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@vben/runtime/stores';
import { emitFrameworkEvent } from '@levin/admin-framework';
import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Button,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { ticketService } from '../../api/ticket-service';
import SupportScopeSelector from '../support-scope-selector.vue';
import SupportUserSelector from '../support-user-selector.vue';
import { ticketHelpContext } from './help-context';
import TicketImagePicker from './ticket-image-picker.vue';

const props = defineProps<{ mode: 'handling' | 'submitted' }>();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(ticketService, method));
const scope = ref<UserOrgSelectorRecord>();
const queryScope = computed(() =>
  scope.value?.kind === 'org' && scope.value.tenantId
    ? { tenantId: scope.value.tenantId, orgId: scope.value.id }
    : undefined,
);
const list = ref<TicketRecord[]>([]);
const current = ref<TicketRecord>();
const messages = ref<TicketMessageRecord[]>([]);
const pageIndex = ref(1);
const total = ref(0);
const messagePage = ref(1);
const messageTotal = ref(0);
const loading = ref(false);
const sending = ref(false);
const body = ref('');
const note = ref(false);
const createOpen = ref(false);
const assignOpen = ref(false);
const assigneeId = ref<string>();
const title = ref('');
const description = ref('');
const createTags = ref<string[]>([]);
const createImages = ref<string[]>([]);
const imageBusy = ref(false);
const createCategory = ref<string>();
const categoryFilter = ref<string>();
const categoryItems = ref<Array<{ code: string; name: string }>>([]);
const tagOptions = ref<string[]>([]);
const tagFilterDraft = ref('');
const tagFilter = ref('');
const editTagsOpen = ref(false);
const editTags = ref<string[]>([]);
const queueId = ref<string>();
const queues = ref<TicketQueueChoice[]>([]);
const selectedId = ref('');
const messageViewport = ref<HTMLElement>();
const expandedMessage = ref<TicketMessageRecord>();
const drafts = new Map<string, { body: string; note: boolean }>();
const unreadCounts = ref<Record<string, number>>({});
const screenshotUrl = ref('');
let generation = 0;
let scopeVersion = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let refreshing = false;
let refreshAgain = false;
let targetVersion = 0;
let queueSearchVersion = 0;
let needsLatestPage = false;
let forceScrollToLatest = false;
const currentUserId = computed(() => String(userStore.userInfo?.id || ''));
const replyUnavailable = computed(() => {
  if (props.mode === 'handling' && note.value) return false;
  return (
    current.value?.status === 'Closed' ||
    (props.mode === 'handling' && current.value?.status === 'Resolved')
  );
});
const isMine = (item: TicketMessageRecord) =>
  Boolean(item.authorUserId && item.authorUserId === currentUserId.value);
const senderName = (item: TicketMessageRecord) =>
  item.authorName?.trim() ||
  (item.authorUserId ? '未知用户' : item.externalSenderEmail || '外部发件人');
const senderAvatar = (item: TicketMessageRecord) =>
  Array.from(senderName(item))[0] || '用';
const messageTime = (value?: string) =>
  value ? value.replace('T', ' ').slice(0, 19) : '';
const labels: Record<string, string> = {
  New: '待受理',
  Assigned: '已分派',
  InProgress: '处理中',
  Resolved: '已解决',
  Closed: '已关闭',
};
const statusColors: Record<string, string> = {
  New: 'orange',
  Assigned: 'blue',
  InProgress: 'processing',
  Resolved: 'success',
  Closed: 'default',
};
const actions = [
  { method: 'assign', event: '分派', label: '分派' },
  { method: 'start', event: '开始处理', label: '我来处理' },
  { method: 'resolve', event: '解决', label: '解决' },
  { method: 'reopen', event: '重开', label: '重开' },
  { method: 'close', event: '关闭', label: '关闭' },
] as const;
const queueOptions = computed(() =>
  queues.value.map((item) => ({
    value: item.id,
    label: `${item.name} (${item.code})`,
  })),
);
const configuredTagOptions = computed(() =>
  tagOptions.value.map((value) => ({ value, label: value })),
);
watch(
  ticketHelpContext,
  (context) => {
    createImages.value = context?.screenshotBase64
      ? [context.screenshotBase64]
      : [];
  },
  { immediate: true },
);
const categoryOptions = computed(() =>
  categoryItems.value.map((item) => ({ value: item.code, label: item.name })),
);
const categoryName = (value?: string) =>
  categoryItems.value.find((item) => item.code === value)?.name ||
  value ||
  '未分类';

// 仅在已选授权组织内查询；切换组织时使旧请求失效。
function changeScope(value?: UserOrgSelectorRecord) {
  generation += 1;
  scopeVersion += 1;
  queueSearchVersion += 1;
  closeScreenshot();
  expandedMessage.value = undefined;
  scope.value = value;
  selectedId.value = '';
  current.value = undefined;
  list.value = [];
  messages.value = [];
  unreadCounts.value = {};
  queues.value = [];
  queueId.value = undefined;
  drafts.clear();
  body.value = '';
  note.value = false;
  tagOptions.value = [];
  categoryItems.value = [];
  createCategory.value = undefined;
  categoryFilter.value = undefined;
  pageIndex.value = 1;
  void refresh();
  void loadTagOptions();
  void loadCategories();
}

async function loadCategories() {
  const selected = queryScope.value;
  if (!selected || !allowed('categoryOptions')) return;
  const version = scopeVersion;
  try {
    const options = await ticketService.categoryOptions(selected);
    if (version === scopeVersion) categoryItems.value = options || [];
  } catch (error) {
    if (version === scopeVersion) notifyApiErrorOnce(error);
  }
}

async function loadTagOptions() {
  const selected = queryScope.value;
  if (!selected || !allowed('tagOptions')) return;
  const version = scopeVersion;
  try {
    const options = await ticketService.tagOptions(selected);
    if (version === scopeVersion) tagOptions.value = options || [];
  } catch (error) {
    if (version === scopeVersion) notifyApiErrorOnce(error);
  }
}

async function refresh() {
  const selected = queryScope.value;
  if (!selected) return;
  if (refreshing) {
    refreshAgain = true;
    return;
  }
  const version = generation;
  refreshing = true;
  loading.value = list.value.length === 0;
  try {
    const page = await ticketService.workbench({
      ...selected,
      view: props.mode,
      pageIndex: pageIndex.value,
      pageSize: 20,
      tag: tagFilter.value || undefined,
      category: categoryFilter.value,
    });
    if (version !== generation) return;
    list.value = page.items || [];
    total.value = page.totals || 0;
    const id = selectedId.value;
    const visibleIds = [
      ...new Set([...list.value.map((item) => item.id), ...(id ? [id] : [])]),
    ];
    if (visibleIds.length && allowed('unreadTicketCounts')) {
      const unread = await ticketService.unreadTicketCounts({
        ...selected,
        ticketIds: visibleIds,
      });
      if (version !== generation || id !== selectedId.value) return;
      unreadCounts.value = unread || {};
    } else unreadCounts.value = {};
    if (id) {
      const [detail, conversation] = await Promise.all([
        ticketService.retrieve({ ...selected, id }),
        ticketService.messages({
          ...selected,
          id,
          pageIndex: messagePage.value,
          pageSize: 100,
        }),
      ]);
      if (version !== generation || id !== selectedId.value) return;
      const viewport = messageViewport.value;
      const shouldScroll =
        !viewport ||
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
      const previousLastPage = Math.max(1, Math.ceil(messageTotal.value / 100));
      const nextLastPage = Math.max(1, Math.ceil(conversation.totals / 100));
      if (
        !needsLatestPage &&
        messageTotal.value > 0 &&
        messagePage.value === previousLastPage &&
        nextLastPage > previousLastPage &&
        shouldScroll
      ) {
        messagePage.value = nextLastPage;
        forceScrollToLatest = true;
        return;
      }
      if (needsLatestPage && conversation.totals > 100) {
        needsLatestPage = false;
        const lastPage = Math.ceil(conversation.totals / 100);
        if (lastPage !== messagePage.value) {
          messagePage.value = lastPage;
          return;
        }
      }
      needsLatestPage = false;
      const lastId = messages.value.at(-1)?.id;
      const previousMessageTotal = messageTotal.value;
      current.value = detail;
      messages.value = conversation.items || [];
      messageTotal.value = conversation.totals || 0;
      if (
        (forceScrollToLatest || shouldScroll) &&
        (forceScrollToLatest ||
          lastId !== messages.value.at(-1)?.id ||
          previousMessageTotal !== messageTotal.value)
      ) {
        await nextTick();
        if (version === generation && messageViewport.value) {
          messageViewport.value.scrollTop = messageViewport.value.scrollHeight;
          forceScrollToLatest = false;
        }
      }
      if (
        !document.hidden &&
        (unreadCounts.value[id] || 0) > 0 &&
        messages.value.length &&
        allowed('markTicketRead')
      ) {
        await ticketService.markTicketRead({
          ...selected,
          id,
          messageIds: messages.value.map((item) => item.id),
        });
        if (version !== generation || id !== selectedId.value) return;
        const unread = await ticketService.unreadTicketCounts({
          ...selected,
          ticketIds: visibleIds,
        });
        if (version !== generation || id !== selectedId.value) return;
        unreadCounts.value = unread || {};
        emitFrameworkEvent('personal-message', 'read.changed', {});
      }
    }
  } catch (error) {
    if (version === generation) {
      // 权限或组织资格可能在轮询期间变化，失败后不继续展示旧会话。
      list.value = [];
      current.value = undefined;
      messages.value = [];
      unreadCounts.value = {};
      selectedId.value = '';
      expandedMessage.value = undefined;
      closeScreenshot();
      notifyApiErrorOnce(error);
    }
  } finally {
    refreshing = false;
    loading.value = false;
    if (refreshAgain) {
      refreshAgain = false;
      void refresh();
    }
  }
}
function selectTicket(item: TicketRecord) {
  if (selectedId.value === item.id) {
    void refresh();
    return;
  }
  if (selectedId.value && selectedId.value !== item.id)
    drafts.set(selectedId.value, { body: body.value, note: note.value });
  const draft = drafts.get(item.id);
  body.value = draft?.body || '';
  note.value = draft?.note || false;
  generation += 1;
  closeScreenshot();
  expandedMessage.value = undefined;
  selectedId.value = item.id;
  current.value = item;
  messages.value = [];
  messagePage.value = 1;
  needsLatestPage = true;
  forceScrollToLatest = true;
  void refresh();
}

function preserveCurrentDraft() {
  if (selectedId.value)
    drafts.set(selectedId.value, { body: body.value, note: note.value });
}
async function searchQueues(keyword = '', autoSelect = false) {
  const selected = queryScope.value;
  if (!selected) return;
  const version = ++queueSearchVersion;
  const selectedScopeVersion = scopeVersion;
  const category = createCategory.value;
  try {
    const page = await ticketService.queueChoices({
      tenantId: selected.tenantId,
      requesterOrgId: selected.orgId,
      keyword,
      category,
      pageIndex: 1,
      pageSize: 100,
    });
    if (
      version !== queueSearchVersion ||
      selectedScopeVersion !== scopeVersion ||
      category !== createCategory.value
    )
      return;
    queues.value = page.items || [];
    if (autoSelect && category)
      queueId.value =
        page.totals === 1 && queues.value.length === 1
          ? queues.value[0]?.id
          : undefined;
  } catch (error) {
    if (version === queueSearchVersion && selectedScopeVersion === scopeVersion)
      notifyApiErrorOnce(error);
  }
}

function changeCreateCategory(value: unknown) {
  createCategory.value = typeof value === 'string' ? value : undefined;
  queueId.value = undefined;
  queues.value = [];
  void searchQueues('', Boolean(createCategory.value));
}
async function createTicket() {
  if (imageBusy.value || sending.value) return;
  const selected = queryScope.value;
  if (
    !selected ||
    !queueId.value ||
    !title.value.trim() ||
    !description.value.trim()
  ) {
    message.error('请选择发起组织、受理小组并填写工单标题和问题描述');
    return;
  }
  sending.value = true;
  try {
    const id = await ticketService.createInternal({
      tenantId: selected.tenantId,
      requesterOrgId: selected.orgId,
      queueId: queueId.value,
      title: title.value,
      body: description.value,
      category: createCategory.value,
      sourcePagePath: ticketHelpContext.value?.path,
      sourcePageTitle: ticketHelpContext.value?.title,
      screenshotsBase64: createImages.value.length
        ? [...createImages.value]
        : undefined,
      tags: createTags.value,
    });
    createOpen.value = false;
    title.value = '';
    description.value = '';
    queueId.value = undefined;
    createTags.value = [];
    createCategory.value = undefined;
    ticketHelpContext.value = undefined;
    createImages.value = [];
    preserveCurrentDraft();
    body.value = '';
    note.value = false;
    selectedId.value = id;
    messagePage.value = 1;
    needsLatestPage = true;
    forceScrollToLatest = true;
    await refresh();
    message.success('工单已提交');
  } catch (error) {
    notifyApiErrorOnce(error);
  } finally {
    sending.value = false;
  }
}

function applyTagFilter() {
  preserveCurrentDraft();
  closeScreenshot();
  expandedMessage.value = undefined;
  body.value = '';
  note.value = false;
  tagFilter.value = tagFilterDraft.value.trim();
  selectedId.value = '';
  current.value = undefined;
  messages.value = [];
  pageIndex.value = 1;
  generation += 1;
  void refresh();
}

function applyCategoryFilter(value: unknown) {
  categoryFilter.value = typeof value === 'string' ? value : undefined;
  preserveCurrentDraft();
  selectedId.value = '';
  current.value = undefined;
  messages.value = [];
  closeScreenshot();
  expandedMessage.value = undefined;
  pageIndex.value = 1;
  generation += 1;
  void refresh();
}

async function changeCategory(value: unknown) {
  const selected = queryScope.value;
  const ticket = current.value;
  if (!selected || !ticket) return;
  const version = generation;
  try {
    const updated = await ticketService.updateCategory({
      ...selected,
      id: ticket.id,
      optimisticLock: ticket.optimisticLock,
      category: typeof value === 'string' ? value : undefined,
    });
    if (version === generation && current.value?.id === ticket.id) {
      current.value = updated;
      void refresh();
    }
  } catch (error) {
    if (version === generation) notifyApiErrorOnce(error);
  }
}

function openTagEditor() {
  editTags.value = [...(current.value?.tags || [])];
  editTagsOpen.value = true;
  void loadTagOptions();
}

async function saveTags() {
  const selected = queryScope.value;
  const ticket = current.value;
  if (!selected || !ticket) return;
  sending.value = true;
  try {
    current.value = await ticketService.updateTags({
      ...selected,
      id: ticket.id,
      optimisticLock: ticket.optimisticLock,
      tags: editTags.value,
    });
    editTagsOpen.value = false;
    await refresh();
    message.success('标签已保存');
  } catch (error) {
    notifyApiErrorOnce(error);
  } finally {
    sending.value = false;
  }
}

function openBlankTicket() {
  ticketHelpContext.value = undefined;
  createImages.value = [];
  createOpen.value = true;
}

function closeScreenshot() {
  if (screenshotUrl.value) URL.revokeObjectURL(screenshotUrl.value);
  screenshotUrl.value = '';
}

async function viewScreenshot(blobId: string) {
  const selected = queryScope.value;
  if (!selected || !current.value) return;
  const version = generation;
  const id = current.value.id;
  try {
    const blob = await ticketService.screenshot({
      ...selected,
      id,
      blobId,
    });
    if (version !== generation || selectedId.value !== id) return;
    closeScreenshot();
    screenshotUrl.value = URL.createObjectURL(blob);
  } catch (error) {
    notifyApiErrorOnce(error);
  }
}

async function downloadMailAttachment(blobId: string) {
  const selected = queryScope.value;
  if (!selected || !current.value || !allowed('attachmentDownload')) return;
  const version = generation;
  const id = current.value.id;
  try {
    const result = await ticketService.attachmentDownload({
      ...selected,
      id,
      blobId,
    });
    if (version !== generation || selectedId.value !== id) return;
    const url = URL.createObjectURL(result.blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      link.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    if (version === generation && selectedId.value === id)
      notifyApiErrorOnce(error);
  }
}
async function sendReply() {
  const selected = queryScope.value;
  const ticket = current.value;
  if (!selected || !ticket || !body.value.trim()) return;
  const submittedBody = body.value;
  const submittedNote = props.mode === 'handling' && note.value;
  sending.value = true;
  try {
    await ticketService.replyInternal({
      ...selected,
      id: ticket.id,
      optimisticLock: ticket.optimisticLock,
      body: submittedBody,
      internalNote: submittedNote,
    });
    if (current.value?.id === ticket.id) {
      if (body.value === submittedBody) body.value = '';
      needsLatestPage = true;
      forceScrollToLatest = true;
    }
    if (drafts.get(ticket.id)?.body === submittedBody) drafts.delete(ticket.id);
    await refresh();
  } catch (error) {
    notifyApiErrorOnce(error);
  } finally {
    sending.value = false;
  }
}

async function showFullMessage(item: TicketMessageRecord) {
  const selected = queryScope.value;
  if (!selected || !current.value) return;
  const version = generation;
  const id = current.value.id;
  try {
    const result = await ticketService.message({
      ...selected,
      id,
      messageId: item.id,
    });
    if (version === generation && selectedId.value === id)
      expandedMessage.value = result;
  } catch (error) {
    notifyApiErrorOnce(error);
  }
}

// 处理动作复用服务端状态事件与版本，界面不直接写入工单状态。
async function performAction(
  action: 'assign' | 'close' | 'reopen' | 'resolve' | 'start',
) {
  const selected = queryScope.value;
  const ticket = current.value;
  if (!selected || !ticket || (action === 'assign' && !assigneeId.value))
    return;
  sending.value = true;
  try {
    const command = {
      ...selected,
      id: ticket.id,
      optimisticLock: ticket.optimisticLock,
    };
    if (action === 'assign')
      await ticketService.assign({ ...command, assigneeId: assigneeId.value! });
    else await ticketService[action](command);
    assignOpen.value = false;
    assigneeId.value = undefined;
    await refresh();
  } catch (error) {
    notifyApiErrorOnce(error);
  } finally {
    sending.value = false;
  }
}

function confirmAction(action: (typeof actions)[number]) {
  if (action.method === 'assign') {
    assignOpen.value = true;
    return;
  }
  Modal.confirm({
    title: `确认「${action.label}」吗？`,
    onOk: () => performAction(action.method),
  });
}
function startTimer() {
  if (!timer)
    timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 7000);
}
function stopTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
onMounted(startTimer);
onActivated(startTimer);
onDeactivated(stopTimer);
onBeforeUnmount(() => {
  generation += 1;
  scopeVersion += 1;
  targetVersion += 1;
  stopTimer();
  closeScreenshot();
});
watch(currentUserId, (next, previous) => {
  if (previous && next !== previous) {
    targetVersion += 1;
    changeScope(undefined);
    createOpen.value = false;
    assignOpen.value = false;
    editTagsOpen.value = false;
    ticketHelpContext.value = undefined;
    title.value = '';
    description.value = '';
    createTags.value = [];
  }
});
// 通知只携带工单标识，组织和查看身份必须由服务端重新核验。
watch(
  () => [route.path, route.query.id],
  async ([path, value]) => {
    const expectedPath =
      props.mode === 'submitted'
        ? '/clob/V1/MyTickets'
        : '/clob/V1/MyHandlingTickets';
    if (path !== expectedPath || value === undefined) return;
    const version = ++targetVersion;
    generation += 1;
    scopeVersion += 1;
    selectedId.value = '';
    current.value = undefined;
    messages.value = [];
    list.value = [];
    unreadCounts.value = {};
    body.value = '';
    closeScreenshot();
    expandedMessage.value = undefined;
    scope.value = undefined;
    if (typeof value !== 'string' || !/^[A-Z0-9][\w.:-]{0,63}$/i.test(value)) {
      message.error('工单定位标识无效');
      return;
    }
    try {
      const target = await ticketService.resolveNotification(value);
      if (
        version !== targetVersion ||
        route.path !== expectedPath ||
        route.query.id !== value
      )
        return;
      if (
        target.id !== value ||
        !target.orgId ||
        !target.tenantId ||
        !target.orgName ||
        !['submitted', 'handling'].includes(target.view)
      )
        throw new Error('工单定位结果无效');
      if (target.view !== props.mode) {
        await router.replace({
          path:
            target.view === 'submitted'
              ? '/clob/V1/MyTickets'
              : '/clob/V1/MyHandlingTickets',
          query: { id: value },
        });
        return;
      }
      changeScope({
        kind: 'org',
        id: target.orgId,
        name: target.orgName,
        tenantId: target.tenantId,
      });
      selectedId.value = value;
      messagePage.value = 1;
      needsLatestPage = true;
      forceScrollToLatest = true;
      generation += 1;
      void refresh();
    } catch (error) {
      if (version === targetVersion) notifyApiErrorOnce(error);
    }
  },
  { immediate: true },
);
watch(pageIndex, () => {
  generation += 1;
  void refresh();
});
watch(messagePage, () => {
  generation += 1;
  void refresh();
});
watch(
  () => [route.path, route.query.create],
  ([path, create]) => {
    if (
      props.mode !== 'submitted' ||
      path !== '/clob/V1/MyTickets' ||
      create !== '1'
    )
      return;
    createOpen.value = true;
    void router.replace({
      path: route.path,
      query: { ...route.query, create: undefined },
      hash: route.hash,
    });
  },
  { immediate: true },
);
</script>

<template>
  <div class="ticket-workbench">
    <div class="ticket-workbench__toolbar ticket-workbench__primary-toolbar">
      <SupportScopeSelector
        class="ticket-workbench__scope"
        :model-value="scope"
        placeholder="选择当前组织"
        @change="changeScope"
      />
      <Button
        v-if="mode === 'submitted' && allowed('createInternal')"
        type="primary"
        @click="openBlankTicket"
        >发起工单</Button
      >
      <Button :loading="loading" @click="refresh">刷新</Button>
      <Input.Search
        class="ticket-workbench__search"
        v-model:value="tagFilterDraft"
        placeholder="按标签筛选"
        :maxlength="32"
        enter-button="筛选"
        @search="applyTagFilter"
      />
      <Select
        :value="categoryFilter"
        :options="categoryOptions"
        placeholder="全部分类"
        not-found-content="暂无分类，请联系管理员配置"
        allow-clear
        style="width: 160px"
        @focus="loadCategories"
        @change="applyCategoryFilter"
      />
    </div>
    <div class="ticket-workbench__columns">
      <section class="ticket-workbench__list" aria-label="工单列表">
        <h3>{{ mode === 'submitted' ? '我提交的工单' : '待我处理的工单' }}</h3>
        <Empty
          v-if="list.length === 0"
          :description="queryScope ? '暂无工单' : '请选择当前组织'"
        />
        <button
          v-for="item in list"
          :key="item.id"
          class="ticket-workbench__row"
          :class="{ 'is-active': selectedId === item.id }"
          @click="selectTicket(item)"
        >
          <span class="ticket-workbench__list-avatar" aria-hidden="true">{{
            Array.from(item.title || '工')[0]
          }}</span>
          <span class="ticket-workbench__row-content">
            <span class="ticket-workbench__row-heading">
              <strong
                ><span
                  v-if="(unreadCounts[item.id] || 0) > 0"
                  class="ticket-workbench__unread"
                  :aria-label="`${unreadCounts[item.id]} 条未读消息`"
                  >{{
                    (unreadCounts[item.id] || 0) > 99
                      ? '99+'
                      : unreadCounts[item.id]
                  }}</span
                >{{ item.title }}</strong
              >
              <Tag :color="statusColors[item.status]">{{
                labels[item.status] || item.status
              }}</Tag>
            </span>
            <small v-if="item.lastActivityTime"
              >最近活动 {{ messageTime(item.lastActivityTime) }}</small
            >
            <small v-if="item.category"
              >分类：{{ categoryName(item.category) }}</small
            >
            <span v-if="item.tags?.length" class="ticket-workbench__tags">
              <Tag v-for="tag in item.tags" :key="tag">{{ tag }}</Tag>
            </span>
          </span>
        </button>
        <Pagination
          v-if="total > 20"
          v-model:current="pageIndex"
          :total="total"
          :page-size="20"
          size="small"
        />
      </section>
      <section class="ticket-workbench__conversation" aria-label="工单交流">
        <template v-if="current">
          <header>
            <div class="ticket-workbench__heading">
              <Tag :color="statusColors[current.status]">{{
                labels[current.status] || current.status
              }}</Tag>
              <span>分类：</span>
              <Select
                v-if="allowed('updateCategory')"
                :value="current.category || undefined"
                :options="categoryOptions"
                placeholder="未分类"
                not-found-content="暂无分类，请联系管理员配置"
                allow-clear
                style="width: 150px"
                @focus="loadCategories"
                @change="changeCategory"
              />
              <span v-else>{{ categoryName(current.category) }}</span>
              <Tag v-for="tag in current.tags || []" :key="tag">{{ tag }}</Tag>
              <Button
                v-if="allowed('updateTags')"
                type="link"
                size="small"
                @click="openTagEditor"
                >编辑标签</Button
              >
            </div>
            <div
              v-if="current.sourcePageTitle || current.sourcePagePath"
              class="ticket-workbench__source"
            >
              来源：{{ current.sourcePageTitle || current.sourcePagePath }}
            </div>
          </header>
          <div v-if="mode === 'handling'" class="ticket-workbench__toolbar">
            <template v-for="action in actions" :key="action.method">
              <Button
                v-if="
                  current.supportEventsByCurrentStatus?.includes(
                    action.event,
                  ) && allowed(action.method)
                "
                size="small"
                :loading="sending"
                @click="confirmAction(action)"
                >{{
                  action.method === 'assign' && current.assigneeId
                    ? '转派'
                    : action.label
                }}</Button
              >
            </template>
          </div>
          <div ref="messageViewport" class="ticket-workbench__messages">
            <article
              v-for="item in messages"
              :key="item.id"
              class="ticket-workbench__message"
              :class="{
                'is-mine': isMine(item),
                'is-note': item.direction === 'InternalNote',
              }"
              :aria-label="isMine(item) ? '我方消息' : '对方消息'"
            >
              <div class="ticket-workbench__avatar" aria-hidden="true">
                {{ senderAvatar(item) }}
              </div>
              <div class="ticket-workbench__message-content">
                <div class="ticket-workbench__message-meta">
                  <Tooltip
                    v-if="item.authorUserId"
                    :title="`租户：${item.authorTenantName || '不可用'}；组织：${item.authorOrgName || '未授权或不可用'}`"
                  >
                    <strong tabindex="0">{{ senderName(item) }}</strong>
                  </Tooltip>
                  <strong v-else>{{ senderName(item) }}</strong>
                  <span>用户 ID：{{ item.authorUserId || '—' }}</span>
                  <time>{{ messageTime(item.occurredTime) }}</time>
                  <span
                    v-if="item.direction === 'InternalNote'"
                    class="ticket-workbench__note-label"
                    >内部备注</span
                  >
                </div>
                <div class="ticket-workbench__bubble">
                  <p>{{ item.body }}</p>
                  <Button
                    v-if="item.bodyTruncated && allowed('message')"
                    type="link"
                    size="small"
                    @click="showFullMessage(item)"
                    >查看全文</Button
                  >
                  <template
                    v-if="
                      !item.sourceInboxId &&
                      !item.outboundIntentId &&
                      allowed('screenshot')
                    "
                  >
                    <Button
                      v-for="(blobId, index) in item.attachmentFileIds || []"
                      :key="blobId"
                      type="link"
                      size="small"
                      @click="viewScreenshot(blobId)"
                      >查看图片 {{ index + 1 }}</Button
                    >
                  </template>
                  <template
                    v-else-if="
                      (item.sourceInboxId || item.outboundIntentId) &&
                      allowed('attachmentDownload')
                    "
                  >
                    <Button
                      v-for="(blobId, index) in item.attachmentFileIds || []"
                      :key="blobId"
                      type="link"
                      size="small"
                      @click="downloadMailAttachment(blobId)"
                      >下载附件 {{ index + 1 }}</Button
                    >
                  </template>
                </div>
              </div>
            </article>
            <Empty v-if="messages.length === 0" description="暂无交流消息" />
          </div>
          <Pagination
            v-if="messageTotal > 100"
            v-model:current="messagePage"
            :total="messageTotal"
            :page-size="100"
            size="small"
          />
          <Input.TextArea
            v-model:value="body"
            :rows="3"
            :maxlength="100000"
            :disabled="replyUnavailable"
            :placeholder="
              replyUnavailable
                ? '工单已解决或关闭，受理人重开后可继续交流'
                : '输入回复内容'
            "
          />
          <div class="ticket-workbench__send">
            <label v-if="mode === 'handling'"
              ><input v-model="note" type="checkbox" />
              内部备注，仅受理人员可见</label
            >
            <Button
              type="primary"
              :disabled="
                replyUnavailable || !body.trim() || !allowed('replyInternal')
              "
              :loading="sending"
              @click="sendReply"
              >发送</Button
            >
          </div>
        </template>
        <Empty v-else description="请选择工单查看交流过程" />
      </section>
    </div>
    <Modal
      v-model:open="editTagsOpen"
      title="编辑工单标签"
      :confirm-loading="sending"
      @ok="saveTags"
    >
      <Form
        id="ticket-workbench-tags"
        name="ticketWorkbenchTags"
        data-form-id="ticket-workbench-tags"
        data-form-name="编辑工单标签"
        layout="vertical"
      >
        <Form.Item
          label="标签"
          extra="可选择系统标签或输入自定义标签，最多10个，每个最多32个字符。"
        >
          <Select
            v-model:value="editTags"
            mode="tags"
            :options="configuredTagOptions"
            :max-count="10"
            placeholder="选择或输入标签"
            @focus="loadTagOptions"
          />
        </Form.Item>
      </Form>
    </Modal>
    <Modal
      v-model:open="assignOpen"
      :title="current?.assigneeId ? '转派工单' : '分派工单'"
      :confirm-loading="sending"
      @ok="performAction('assign')"
    >
      <Form
        id="ticket-workbench-assign"
        name="ticketWorkbenchAssign"
        data-form-id="ticket-workbench-assign"
        data-form-name="分派工单"
        layout="vertical"
      >
        <Form.Item label="目标处理人" required>
          <SupportUserSelector
            :model-value="assigneeId"
            :scope="queryScope"
            @update:model-value="
              assigneeId = typeof $event === 'string' ? $event : undefined
            "
          />
        </Form.Item>
      </Form>
    </Modal>
    <Modal
      v-model:open="createOpen"
      title="发起工单"
      :width="960"
      :confirm-loading="sending || imageBusy"
      @ok="createTicket"
    >
      <Form
        id="ticket-workbench-create"
        class="ticket-workbench__create-form"
        name="ticketWorkbenchCreate"
        data-form-id="ticket-workbench-create"
        data-form-name="发起工单"
        layout="vertical"
      >
        <div class="ticket-workbench__create-column">
          <Form.Item
            class="ticket-workbench__form-wide"
            label="发起组织"
            required
            ><SupportScopeSelector
              :model-value="scope"
              placeholder="选择发起组织"
              @change="changeScope"
          /></Form.Item>
          <div class="ticket-workbench__category-row">
            <Form.Item label="工单分类">
              <Select
                v-model:value="createCategory"
                :options="categoryOptions"
                placeholder="选择分类（可留空）"
                not-found-content="暂无分类，请联系管理员配置"
                allow-clear
                @focus="loadCategories"
                @change="changeCreateCategory"
              />
            </Form.Item>
            <Form.Item label="受理小组" required
              ><Select
                v-model:value="queueId"
                show-search
                :filter-option="false"
                :options="queueOptions"
                placeholder="搜索受理小组"
                :not-found-content="
                  createCategory ? '暂无支持该分类的受理小组' : '暂无受理小组'
                "
                @focus="searchQueues()"
                @search="searchQueues"
            /></Form.Item>
          </div>
          <Form.Item
            class="ticket-workbench__form-wide"
            label="工单标题"
            required
            ><Input v-model:value="title" :maxlength="512"
          /></Form.Item>
          <Form.Item
            class="ticket-workbench__form-wide"
            label="工单标签"
            extra="可选择系统标签或输入自定义标签，最多10个，每个最多32个字符。"
          >
            <Select
              v-model:value="createTags"
              mode="tags"
              :options="configuredTagOptions"
              :max-count="10"
              placeholder="选择或输入标签"
              @focus="loadTagOptions"
            />
          </Form.Item>
        </div>
        <div class="ticket-workbench__create-column">
          <Form.Item
            class="ticket-workbench__form-wide"
            label="问题描述"
            required
            ><Input.TextArea
              v-model:value="description"
              :rows="5"
              :maxlength="100000"
          /></Form.Item>
          <Form.Item
            v-if="ticketHelpContext?.path"
            class="ticket-workbench__form-wide"
            label="来源页面"
          >
            {{ ticketHelpContext.title }}（{{ ticketHelpContext.path }}）
          </Form.Item>
          <Form.Item
            class="ticket-workbench__form-wide"
            label="问题截图"
            extra="最多 5 张，每张转换后不超过 2 MB；点击图片查看大图。"
          >
            <TicketImagePicker
              v-model="createImages"
              :active="createOpen"
              @busy-change="imageBusy = $event"
            />
          </Form.Item>
          <p
            v-if="ticketHelpContext?.captureError"
            class="ticket-workbench__form-wide"
          >
            {{ ticketHelpContext.captureError }}
          </p>
        </div>
      </Form>
    </Modal>
    <Modal
      :open="Boolean(screenshotUrl)"
      title="工单截图"
      :footer="null"
      @cancel="closeScreenshot"
    >
      <img
        v-if="screenshotUrl"
        class="ticket-workbench__preview"
        :src="screenshotUrl"
        alt="工单截图"
      />
    </Modal>
    <Modal
      :open="Boolean(expandedMessage)"
      title="完整消息"
      :footer="null"
      @cancel="expandedMessage = undefined"
    >
      <p class="ticket-workbench__full-message">{{ expandedMessage?.body }}</p>
    </Modal>
  </div>
</template>

<style scoped>
.ticket-workbench__create-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.ticket-workbench__create-column {
  min-width: 0;
}

.ticket-workbench__category-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ticket-workbench__form-wide {
  grid-column: 1 / -1;
}

.ticket-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 500px;
  gap: 12px;
  padding: 16px;
  color: hsl(var(--foreground));
}
.ticket-workbench__toolbar,
.ticket-workbench__send {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ticket-workbench__primary-toolbar {
  flex-wrap: wrap;
}
.ticket-workbench__scope {
  width: 380px;
  min-width: 0;
  max-width: 100%;
  flex: 0 1 380px;
}
.ticket-workbench__search {
  width: 220px;
  max-width: 100%;
}
.ticket-workbench__columns {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  background: hsl(var(--card));
}
.ticket-workbench__list {
  width: 320px;
  flex: 0 0 320px;
  overflow: auto;
  padding: 16px 10px;
  border-right: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}
.ticket-workbench__list h3 {
  margin: 0 0 4px;
  padding: 0 8px 14px;
  border-bottom: 1px solid hsl(var(--border));
  font-size: 15px;
  font-weight: 600;
}
.ticket-workbench__row {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 0;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  background: transparent;
}
.ticket-workbench__row:hover {
  background: hsl(var(--muted) / 0.6);
}
.ticket-workbench__row.is-active {
  background: hsl(var(--primary) / 0.1);
}
.ticket-workbench__list-avatar,
.ticket-workbench__avatar {
  display: grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 10px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.12);
  font-weight: 600;
}
.ticket-workbench__row-content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}
.ticket-workbench__row-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}
.ticket-workbench__row-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
.ticket-workbench__row-content small {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
.ticket-workbench__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ticket-workbench__unread {
  display: inline-flex;
  min-width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  margin-right: 6px;
  border-radius: 10px;
  color: #fff;
  background: var(--color-error, #d9363e);
  font-size: 12px;
  line-height: 20px;
  vertical-align: middle;
}
.ticket-workbench__conversation {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  background: hsl(var(--card));
}
.ticket-workbench__conversation header {
  padding-bottom: 12px;
  border-bottom: 1px solid hsl(var(--border));
}
.ticket-workbench__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.ticket-workbench__source {
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
.ticket-workbench__messages {
  flex: 1;
  min-height: 200px;
  overflow: auto;
  padding: 16px;
  border-radius: 10px;
  background: hsl(var(--muted) / 0.48);
}
.ticket-workbench__message {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 0 20px;
}
.ticket-workbench__message.is-mine {
  flex-direction: row-reverse;
}
.ticket-workbench__message.is-mine .ticket-workbench__avatar {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}
.ticket-workbench__message-content {
  display: flex;
  max-width: min(78%, 680px);
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}
.ticket-workbench__message.is-mine .ticket-workbench__message-content {
  align-items: flex-end;
}
.ticket-workbench__message-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  overflow-wrap: anywhere;
}
.ticket-workbench__message-meta strong {
  color: hsl(var(--foreground));
  font-weight: 600;
}
.ticket-workbench__message.is-mine .ticket-workbench__message-meta {
  justify-content: flex-end;
}
.ticket-workbench__bubble {
  max-width: 100%;
  padding: 10px 13px;
  border: 1px solid hsl(var(--border) / 0.65);
  border-radius: 4px 12px 12px;
  background: hsl(var(--card));
  box-shadow: 0 1px 3px hsl(var(--foreground) / 0.05);
}
.ticket-workbench__message.is-mine .ticket-workbench__bubble {
  border-color: hsl(var(--primary) / 0.2);
  border-radius: 12px 4px 12px 12px;
  background: hsl(var(--primary) / 0.12);
}
.ticket-workbench__message.is-note .ticket-workbench__bubble {
  border-style: dashed;
}
.ticket-workbench__note-label {
  color: hsl(var(--primary));
  font-weight: 600;
}
.ticket-workbench__bubble p,
.ticket-workbench__full-message {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ticket-workbench__send {
  justify-content: flex-end;
  padding-right: 88px;
}
.ticket-workbench__send label {
  margin-right: auto;
}
.ticket-workbench__preview {
  display: block;
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
}
@media (max-width: 600px) {
  .ticket-workbench__create-form {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}
@media (max-width: 700px) {
  .ticket-workbench__columns {
    flex-direction: column;
  }
  .ticket-workbench__list {
    width: 100%;
    flex: 0 0 auto;
    max-height: 220px;
    border-right: 0;
    border-bottom: 1px solid hsl(var(--border));
  }
  .ticket-workbench__message-content {
    max-width: 85%;
  }
}
</style>
