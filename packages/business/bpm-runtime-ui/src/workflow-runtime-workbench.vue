<script lang="ts" setup>
import type { Component } from 'vue';

import type {
  WorkflowActionInput,
  WorkflowAttachmentMeta,
  WorkflowInstanceView,
  WorkflowOption,
  WorkflowRuntimePage,
  WorkflowTaskSubmitPayload,
  WorkflowTaskView,
  WorkflowVerificationChallenge,
} from './types';

import { computed, nextTick, onMounted, ref, watch } from 'vue';

// 待办列表和具名槽依赖真实组件，不能退化为未注册的自定义DOM标签。
import {
  Alert as AAlert,
  Button as AButton,
  Card as ACard,
  Col as ACol,
  Empty as AEmpty,
  List as AList,
  ListItem as AListItem,
  ListItemMeta as AListItemMeta,
  Row as ARow,
  Select as ASelect,
  Space as ASpace,
  TabPane as ATabPane,
  Tabs as ATabs,
  Tag as ATag,
  Timeline as ATimeline,
  TimelineItem as ATimelineItem,
} from 'ant-design-vue';

import WorkflowProcessDiagram from './workflow-process-diagram.vue';
import { WorkflowRuntimeService } from './workflow-runtime-service';
import { workflowStatusLabel } from './workflow-task-form';
import WorkflowTaskPanel from './workflow-task-panel.vue';

const props = withDefaults(
  defineProps<{
    canDeletePendingAttachment?: boolean;
    canDownloadAttachment?: boolean;
    canLoadCopyRecipients?: boolean;
    canRetry?: boolean;
    canSendCopy?: boolean;
    canUploadAttachment?: boolean;
    canViewAttachments?: boolean;
    canViewCopied?: boolean;
    canViewDone?: boolean;
    canViewPendingAttachments?: boolean;
    canViewStarted?: boolean;
    canViewTodo?: boolean;
    detailComponents?: Record<string, Component>;
    loadCopyRecipients?: (
      instanceId: string,
      keyword: string,
    ) => Promise<WorkflowOption[]>;
    service?: WorkflowRuntimeService;
  }>(),
  {
    canDownloadAttachment: false,
    canDeletePendingAttachment: false,
    canUploadAttachment: false,
    canViewPendingAttachments: false,
    canViewAttachments: false,
    canViewDone: true,
    canViewStarted: true,
    canViewTodo: true,
    detailComponents: undefined,
    canViewCopied: true,
    canSendCopy: false,
    canLoadCopyRecipients: false,
    loadCopyRecipients: undefined,
    service: undefined,
  },
);
const emit = defineEmits<{
  completed: [task: WorkflowTaskView];
  error: [error: unknown];
  retried: [instanceId: string];
}>();
// 默认连接器只创建一次，避免响应式刷新导致重复初始化。
const defaultService = new WorkflowRuntimeService();
const service = computed(() => props.service ?? defaultService);
// 独立包默认保留全部分栏；宿主必须按当前 API 方法权限显式关闭无权分栏。
const canViewTodo = computed(() => props.canViewTodo !== false);
const canViewDone = computed(() => props.canViewDone !== false);
const canViewStarted = computed(() => props.canViewStarted !== false);
const canViewCopied = computed(() => props.canViewCopied !== false);
const activeKey = ref('todo');
const loading = ref(false);
const todo = ref<WorkflowTaskView[]>([]);
const done = ref<WorkflowTaskView[]>([]);
const copied = ref<WorkflowInstanceView[]>([]);
const started = ref<WorkflowInstanceView[]>([]);
type TabKey = 'copied' | 'done' | 'started' | 'todo';
type PageState = {
  cursors: (string | undefined)[];
  hasMore: boolean;
  index: number;
  nextCursor?: string;
};
const makePageState = (): PageState => ({
  cursors: [undefined],
  hasMore: false,
  index: 0,
});
const pages = ref<Record<TabKey, PageState>>({
  todo: makePageState(),
  done: makePageState(),
  started: makePageState(),
  copied: makePageState(),
});
const currentPage = computed(() => pages.value[activeKey.value as TabKey]);
const currentPageCount = computed(() => {
  switch (activeKey.value) {
    case 'copied': {
      return copied.value.length;
    }
    case 'done': {
      return done.value.length;
    }
    case 'started': {
      return started.value.length;
    }
    case 'todo': {
      return todo.value.length;
    }
    default: {
      return 0;
    }
  }
});
const pageSummary = computed(() =>
  currentPage.value
    ? `第 ${currentPage.value.index + 1} 页 · 本页 ${currentPageCount.value} 条`
    : '',
);
const selectedTask = ref<WorkflowTaskView>();
const selectedInstance = ref<WorkflowInstanceView>();
const attachedFiles = ref<WorkflowAttachmentMeta[]>([]);
const pendingFiles = ref<WorkflowAttachmentMeta[]>([]);
const instanceFiles = ref<WorkflowAttachmentMeta[]>([]);
const uploadingFile = ref(false);
const downloadingFile = ref<string>();
const deletingFile = ref<string>();
const instanceDetail = ref<HTMLElement>();
const submitting = ref(false);
const retrying = ref<string>();
const sendingCopy = ref(false);
const copyRecipients = ref<string[]>([]);
const copyOptions = ref<WorkflowOption[]>([]);
const loadingCopyOptions = ref(false);
let copyOptionsVersion = 0;
const errorMessage = ref('');
const verificationMessage = ref('');
const verificationChallenge = ref<WorkflowVerificationChallenge>();
let refreshVersion = 0;
let attachmentVersion = 0;
let pendingVersion = 0;
let verificationVersion = 0;

// 分栏切换后移除旧分栏详情，防止我发起实例在抄送分栏继续展示。
watch(activeKey, () => {
  selectedTask.value = undefined;
  selectedInstance.value = undefined;
  copyRecipients.value = [];
  copyOptions.value = [];
  ++copyOptionsVersion;
  void loadPage();
});

async function loadPendingAttachments(taskId: string) {
  const version = ++pendingVersion;
  if (!props.canViewPendingAttachments) return;
  try {
    const result = await service.value.pendingAttachments(taskId);
    if (version === pendingVersion && selectedTask.value?.taskId === taskId)
      pendingFiles.value = result;
  } catch (error) {
    if (version !== pendingVersion) return;
    pendingFiles.value = [];
    emit('error', error);
  }
}

async function loadAttachments(
  instanceId: string,
  target: 'instance' | 'task',
) {
  const version = ++attachmentVersion;
  if (!props.canViewAttachments) {
    attachedFiles.value = [];
    instanceFiles.value = [];
    return;
  }
  try {
    // 列表只通过服务端当前授权入口取得；迟到响应不能落入另一任务或实例。
    const result = await service.value.attachments(instanceId);
    if (version !== attachmentVersion) return;
    if (
      target === 'task' &&
      selectedTask.value?.processInstanceId === instanceId
    )
      attachedFiles.value = result;
    if (
      target === 'instance' &&
      selectedInstance.value?.instanceId === instanceId
    )
      instanceFiles.value = result;
  } catch (error) {
    if (version !== attachmentVersion) return;
    if (target === 'task') attachedFiles.value = [];
    else instanceFiles.value = [];
    emit('error', error);
  }
}

watch(
  () => selectedTask.value?.taskId,
  () => {
    ++pendingVersion;
    ++attachmentVersion;
    ++verificationVersion;
    pendingFiles.value = [];
    attachedFiles.value = [];
    verificationMessage.value = '';
    verificationChallenge.value = undefined;
    const taskId = selectedTask.value?.taskId;
    if (taskId) void loadPendingAttachments(taskId);
    const instanceId = selectedTask.value?.processInstanceId;
    if (instanceId) void loadAttachments(instanceId, 'task');
  },
);

watch(
  () => props.canViewPendingAttachments,
  () => {
    const taskId = selectedTask.value?.taskId;
    if (taskId) void loadPendingAttachments(taskId);
  },
);

watch(
  () => selectedInstance.value?.instanceId,
  () => {
    instanceFiles.value = [];
    const instanceId = selectedInstance.value?.instanceId;
    if (instanceId && activeKey.value === 'started')
      void loadAttachments(instanceId, 'instance');
  },
);

watch(
  () => props.canViewAttachments,
  () => {
    attachedFiles.value = [];
    instanceFiles.value = [];
    const taskInstance = selectedTask.value?.processInstanceId;
    const startedInstance = selectedInstance.value?.instanceId;
    if (taskInstance) void loadAttachments(taskInstance, 'task');
    else if (startedInstance && activeKey.value === 'started')
      void loadAttachments(startedInstance, 'instance');
  },
);

async function uploadAttachment(file: File) {
  const task = selectedTask.value;
  if (
    !props.canUploadAttachment ||
    task?.status !== 'Todo' ||
    uploadingFile.value
  )
    return;
  if (
    file.size === 0 ||
    file.size > 5 * 1024 * 1024 ||
    pendingFiles.value.length >= 5
  ) {
    errorMessage.value = '附件须非空、单件不超过5 MiB，且同一任务最多五件。';
    return;
  }
  uploadingFile.value = true;
  ++pendingVersion;
  errorMessage.value = '';
  try {
    const uploaded = await service.value.uploadAttachment(task.taskId, file);
    if (selectedTask.value?.taskId !== task.taskId) return;
    pendingFiles.value = [...pendingFiles.value, uploaded];
  } catch (error) {
    errorMessage.value = '私有附件上传失败，已保留当前审批输入。';
    emit('error', error);
  } finally {
    uploadingFile.value = false;
  }
}

async function deletePendingAttachment(item: WorkflowAttachmentMeta) {
  const taskId = selectedTask.value?.taskId;
  if (
    !props.canDeletePendingAttachment ||
    !taskId ||
    item.attached ||
    deletingFile.value
  )
    return;
  deletingFile.value = item.id;
  try {
    await service.value.deletePendingAttachment(taskId, item.id);
    if (selectedTask.value?.taskId === taskId) {
      ++pendingVersion;
      pendingFiles.value = pendingFiles.value.filter(
        (file) => file.id !== item.id,
      );
    }
  } catch (error) {
    errorMessage.value = '撤销待提交附件失败，请检查当前任务和业务权限。';
    emit('error', error);
  } finally {
    deletingFile.value = undefined;
  }
}

async function downloadAttachment(item: WorkflowAttachmentMeta) {
  if (!props.canDownloadAttachment || !item.attached || downloadingFile.value)
    return;
  downloadingFile.value = item.id;
  try {
    const blob = await service.value.downloadAttachment(item.id);
    if (!(blob instanceof Blob)) throw new Error('附件下载未返回二进制内容');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = item.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // 浏览器异步接收 Blob 下载；过早撤销会使点击完成却没有实际下载事件。
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    errorMessage.value = '附件下载未成功，请检查当前业务和流程权限。';
    emit('error', error);
  } finally {
    downloadingFile.value = undefined;
  }
}

function attachmentLabel(item: WorkflowAttachmentMeta) {
  return `${item.fileName}（${item.sizeBytes} 字节）`;
}

function clearSelection() {
  selectedTask.value = undefined;
  selectedInstance.value = undefined;
  attachedFiles.value = [];
  pendingFiles.value = [];
  instanceFiles.value = [];
  copyRecipients.value = [];
  copyOptions.value = [];
  verificationMessage.value = '';
  verificationChallenge.value = undefined;
  ++attachmentVersion;
  ++pendingVersion;
  ++verificationVersion;
  ++copyOptionsVersion;
}

function clearPages() {
  pages.value = {
    todo: makePageState(),
    done: makePageState(),
    started: makePageState(),
    copied: makePageState(),
  };
  todo.value = [];
  done.value = [];
  started.value = [];
  copied.value = [];
}

async function loadPage() {
  const key = activeKey.value as TabKey;
  const allowed = () => ({
    todo: canViewTodo.value,
    done: canViewDone.value,
    started: canViewStarted.value,
    copied: canViewCopied.value,
  });
  const version = ++refreshVersion;
  if (!allowed()[key]) {
    loading.value = false;
    return;
  }
  const page = pages.value[key];
  const query = { cursor: page.cursors[page.index], size: 20 };
  loading.value = true;
  errorMessage.value = '';
  clearSelection();
  // 请求期间不呈现旧页或另一用户的结果。
  switch (key) {
    case 'done': {
      done.value = [];
      break;
    }
    case 'started': {
      started.value = [];
      break;
    }
    case 'todo': {
      todo.value = [];
      break;
    }
    default: {
      copied.value = [];
    }
  }
  try {
    let result: WorkflowRuntimePage<WorkflowInstanceView | WorkflowTaskView>;
    switch (key) {
      case 'done': {
        result = await service.value.done(query);
        break;
      }
      case 'started': {
        result = await service.value.started(query);
        break;
      }
      case 'todo': {
        result = await service.value.todo(query);
        break;
      }
      default: {
        result = await service.value.copied(query);
      }
    }
    if (
      version !== refreshVersion ||
      activeKey.value !== key ||
      !allowed()[key]
    )
      return;
    page.hasMore = result.hasMore;
    page.nextCursor = result.nextCursor;
    switch (key) {
      case 'done': {
        done.value = result.items as WorkflowTaskView[];
        break;
      }
      case 'started': {
        started.value = result.items as WorkflowInstanceView[];
        break;
      }
      case 'todo': {
        todo.value = result.items as WorkflowTaskView[];
        break;
      }
      default: {
        copied.value = result.items as WorkflowInstanceView[];
      }
    }
  } catch (error) {
    if (version !== refreshVersion) return;
    errorMessage.value = '流程列表加载失败，请重试。';
    emit('error', error);
  } finally {
    if (version === refreshVersion) loading.value = false;
  }
}

function refresh() {
  ++refreshVersion;
  clearSelection();
  clearPages();
  // 当前分栏撤权后只进入仍获授权的第一个分栏。
  const visibleKeys: TabKey[] = [
    ...(canViewTodo.value ? ['todo' as const] : []),
    ...(canViewDone.value ? ['done' as const] : []),
    ...(canViewStarted.value ? ['started' as const] : []),
    ...(canViewCopied.value ? ['copied' as const] : []),
  ];
  const nextKey = visibleKeys.includes(activeKey.value as TabKey)
    ? activeKey.value
    : (visibleKeys[0] ?? '');
  if (nextKey === activeKey.value) {
    void loadPage();
  } else {
    activeKey.value = nextKey;
  }
}

function nextPage() {
  const page = currentPage.value;
  if (!page || loading.value || !page.hasMore || !page.nextCursor) return;
  page.cursors[page.index + 1] = page.nextCursor;
  page.cursors.length = page.index + 2;
  ++page.index;
  void loadPage();
}

function previousPage() {
  const page = currentPage.value;
  if (!page || loading.value || page.index === 0) return;
  --page.index;
  void loadPage();
}

// 当前用户权限重新载入或撤销时丢弃旧详情，并重新按最新授权加载列表。
watch([canViewTodo, canViewDone, canViewStarted, canViewCopied], () => {
  refresh();
});

// 候选查询或发送权限撤销时立即清空选择，不保留可再次提交的旧命令。
watch(
  () => [props.canSendCopy, props.canLoadCopyRecipients],
  () => {
    if (props.canSendCopy && props.canLoadCopyRecipients) return;
    copyRecipients.value = [];
    copyOptions.value = [];
    ++copyOptionsVersion;
  },
);

async function selectInstance(instance: WorkflowInstanceView) {
  // 只从当前已授权列表选取实例，避免把旧任务详情与实例详情同时保留。
  selectedTask.value = undefined;
  selectedInstance.value = instance;
  copyRecipients.value = [];
  copyOptions.value = [];

  // 列表可能很长，详情挂载后将其带入视口，避免点击后看起来没有反应。
  await nextTick();
  instanceDetail.value?.scrollIntoView?.({ block: 'start' });
}

async function searchCopyRecipients(keyword = '') {
  const instanceId = selectedInstance.value?.instanceId;
  if (
    !props.canSendCopy ||
    !props.canLoadCopyRecipients ||
    !props.loadCopyRecipients ||
    !instanceId ||
    activeKey.value !== 'started'
  )
    return;
  const version = ++copyOptionsVersion;
  const searchText = keyword.trim();
  // 服务端只接受2至32字符的姓名片段；短词不发请求，也不清除已选人员。
  if (searchText.length < 2 || searchText.length > 32) {
    copyOptions.value = copyOptions.value.filter((item) =>
      copyRecipients.value.includes(item.value),
    );
    loadingCopyOptions.value = false;
    return;
  }
  loadingCopyOptions.value = true;
  try {
    const options = await props.loadCopyRecipients(instanceId, searchText);
    if (
      version === copyOptionsVersion &&
      props.canSendCopy &&
      props.canLoadCopyRecipients &&
      selectedInstance.value?.instanceId === instanceId
    ) {
      const selectedOptions = copyOptions.value.filter((item) =>
        copyRecipients.value.includes(item.value),
      );
      copyOptions.value = [
        ...new Map(
          [...selectedOptions, ...options].map((item) => [item.value, item]),
        ).values(),
      ];
    }
  } catch (error) {
    if (version !== copyOptionsVersion) return;
    copyOptions.value = [];
    emit('error', error);
  } finally {
    if (version === copyOptionsVersion) loadingCopyOptions.value = false;
  }
}

async function sendCopy() {
  const instance = selectedInstance.value;
  if (
    !props.canSendCopy ||
    !props.canLoadCopyRecipients ||
    !instance ||
    activeKey.value !== 'started' ||
    instance.status !== 'Running' ||
    sendingCopy.value
  )
    return;
  // 只提交当前授权目录给出的选项；不可由自由文本制造用户标识。
  const allowedIds = new Set(copyOptions.value.map((item) => item.value));
  const recipientUserIds = [...new Set(copyRecipients.value)];
  if (
    recipientUserIds.length === 0 ||
    recipientUserIds.some((id) => !allowedIds.has(id))
  )
    return;
  sendingCopy.value = true;
  errorMessage.value = '';
  try {
    await service.value.copy({
      instanceId: instance.instanceId,
      recipientUserIds,
    });
    copyRecipients.value = [];
    await refresh();
  } catch (error) {
    errorMessage.value = '发送抄送失败，请检查当前实例及接收人权限。';
    emit('error', error);
  } finally {
    sendingCopy.value = false;
  }
}

async function complete(payload: WorkflowTaskSubmitPayload) {
  if (!selectedTask.value || submitting.value) return;
  const taskId = selectedTask.value.taskId;
  submitting.value = true;
  errorMessage.value = '';
  verificationMessage.value = '';
  verificationChallenge.value = undefined;
  try {
    // 移除仅供界面展示的action对象，完整传递意见及动作专属参数。
    const { action, ...input } = payload;
    const result = await service.value.complete({
      ...input,
      actionCode: action.code,
      taskId,
    });
    emit('completed', result);

    // 成功命令可能同步取消同一实例的其他任务；旧任务附件读取随后失败不再属于当前选择。
    if (selectedTask.value?.taskId === taskId) {
      ++pendingVersion;
      ++attachmentVersion;
      selectedTask.value = undefined;
      pendingFiles.value = [];
    }
    await refresh();
  } catch (error) {
    errorMessage.value = '任务处理未成功，输入已保留，请根据错误提示重试。';
    emit('error', error);
  } finally {
    submitting.value = false;
  }
}

async function retry(item: WorkflowInstanceView) {
  // 我发起列表中的重试同时要求宿主权限、可信交付标识及完整业务引用。
  if (
    !props.canRetry ||
    !item.pendingDispatchId ||
    !item.businessType ||
    !item.businessId ||
    retrying.value ||
    submitting.value ||
    loading.value
  )
    return;
  retrying.value = item.pendingDispatchId;
  errorMessage.value = '';
  try {
    await service.value.retry({
      businessType: item.businessType,
      businessId: item.businessId,
      tenantId: item.tenantId,
      orgId: item.orgId,
      dispatchId: item.pendingDispatchId,
    });
    emit('retried', item.instanceId);
    await refresh();
  } catch (error) {
    errorMessage.value = '业务处理重试未成功，请根据错误提示处理后重试。';
    emit('error', error);
  } finally {
    retrying.value = undefined;
  }
}
async function prepareVerification(
  payload: WorkflowActionInput & {
    action: { code: string };
    contextVersion?: number;
    verificationType: string;
  },
) {
  const taskId = selectedTask.value?.taskId;
  if (!taskId) return;
  const version = ++verificationVersion;
  verificationMessage.value = '';
  verificationChallenge.value = undefined;
  try {
    // 摘要由服务端规范化计算，不将原始表单伪装成客户端“摘要”。
    const { action, ...input } = payload;
    const challenge = await service.value.prepareStepUpAuth({
      ...input,
      actionCode: action.code,
      taskId,
    });
    if (
      version !== verificationVersion ||
      selectedTask.value?.taskId !== taskId
    )
      return;
    if (challenge.verificationType !== payload.verificationType) {
      verificationMessage.value = '验证类型不匹配，请重新获取挑战。';
      return;
    }
    if (challenge.successful && payload.contextVersion !== undefined) {
      verificationChallenge.value = {
        contextVersion: payload.contextVersion,
        interactionData: challenge.interactionData,
        successful: true,
        taskId,
        verificationType: challenge.verificationType,
      };
    }
    verificationMessage.value =
      challenge.message ||
      (challenge.successful
        ? '验证请求已发送，请完成验证。'
        : '验证请求未成功。');
  } catch (error) {
    if (
      version !== verificationVersion ||
      selectedTask.value?.taskId !== taskId
    )
      return;
    errorMessage.value = '获取验证挑战失败，请重试。';
    emit('error', error);
  }
}
function invalidateVerification() {
  ++verificationVersion;
  verificationMessage.value = '';
  verificationChallenge.value = undefined;
}
onMounted(refresh);
defineExpose({ refresh });
</script>

<template>
  <section class="levin-workflow-runtime-workbench">
    <AAlert
      v-if="errorMessage"
      class="mb-3"
      type="error"
      :message="errorMessage"
    />
    <AAlert
      v-if="verificationMessage"
      class="mb-3"
      type="info"
      :message="verificationMessage"
    />
    <ACard title="工作流中心" size="small">
      <template #extra>
        <AButton :loading="loading" @click="refresh">刷新</AButton>
      </template>
      <ATabs v-model:active-key="activeKey">
        <ATabPane v-if="canViewTodo" key="todo" tab="待办">
          <AList :data-source="todo" item-layout="horizontal">
            <template #renderItem="{ item }">
              <AListItem
                class="cursor-pointer"
                role="button"
                tabindex="0"
                :aria-label="`查看${item.businessTitle || item.taskName || item.taskId}`"
                @click="selectedTask = item"
                @keydown.enter.prevent="selectedTask = item"
                @keydown.space.prevent="selectedTask = item"
              >
                <AListItemMeta
                  :description="`${item.taskName || item.taskId} · ${item.processInstanceId || '—'}`"
                >
                  <template #title>
                    {{ item.businessTitle || item.taskName || item.taskId }}
                  </template>
                </AListItemMeta>
                <ATag color="processing">待处理</ATag>
              </AListItem>
            </template>
          </AList>
        </ATabPane>
        <ATabPane v-if="canViewDone" key="done" tab="已办">
          <AList :data-source="done">
            <template #renderItem="{ item }">
              <AListItem
                class="cursor-pointer"
                role="button"
                tabindex="0"
                :aria-label="`查看${item.businessTitle || item.taskName || item.taskId}`"
                @click="selectedTask = item"
                @keydown.enter.prevent="selectedTask = item"
                @keydown.space.prevent="selectedTask = item"
              >
                <AListItemMeta
                  :title="item.businessTitle || item.taskName || item.taskId"
                  :description="`${item.taskName || item.taskId} · ${item.processInstanceId || '—'}`"
                />
                <ATag>
                  {{
                    item.status === 'Completed'
                      ? '已处理'
                      : workflowStatusLabel(item.status)
                  }}
                </ATag>
              </AListItem>
            </template>
          </AList>
        </ATabPane>
        <ATabPane v-if="canViewStarted" key="started" tab="我发起">
          <AList :data-source="started">
            <template #renderItem="{ item }">
              <AListItem
                class="cursor-pointer"
                role="button"
                tabindex="0"
                :aria-label="`查看${item.businessTitle || item.purposeKey || '流程'}实例`"
                @click="selectInstance(item)"
                @keydown.enter.prevent="selectInstance(item)"
                @keydown.space.prevent="selectInstance(item)"
              >
                <AListItemMeta :description="item.instanceId">
                  <template #title>
                    {{ item.businessTitle || item.purposeKey || '流程实例' }}
                  </template>
                  <template #description>
                    <div>{{ item.instanceId }}</div>
                    <div v-if="item.lastError" class="text-destructive">
                      {{ item.lastError }}
                    </div>
                  </template>
                </AListItemMeta>
                <ASpace wrap>
                  <ATag>
                    执行：{{
                      workflowStatusLabel(item.executionStatus || item.status)
                    }}
                  </ATag>
                  <ATag v-if="item.outcome">
                    结果：{{ workflowStatusLabel(item.outcome) }}
                  </ATag>
                  <ATag v-if="item.effectStatus">
                    业务处理：{{ workflowStatusLabel(item.effectStatus) }}
                  </ATag>
                  <AButton
                    v-if="
                      canRetry &&
                      item.pendingDispatchId &&
                      item.businessType &&
                      item.businessId
                    "
                    :loading="retrying === item.pendingDispatchId"
                    :disabled="!!retrying || submitting || loading"
                    @click.stop="retry(item)"
                  >
                    重试业务处理
                  </AButton>
                </ASpace>
              </AListItem>
            </template>
          </AList>
        </ATabPane>
        <ATabPane v-if="canViewCopied" key="copied" tab="抄送">
          <AEmpty v-if="copied.length === 0" description="暂无抄送记录" />
          <AList v-else :data-source="copied">
            <template #renderItem="{ item }">
              <AListItem
                class="cursor-pointer"
                role="button"
                tabindex="0"
                :aria-label="`查看${item.businessTitle || item.purposeKey || '流程'}抄送实例`"
                @click="selectInstance(item)"
                @keydown.enter.prevent="selectInstance(item)"
                @keydown.space.prevent="selectInstance(item)"
              >
                <AListItemMeta
                  :title="item.businessTitle || item.purposeKey || '流程实例'"
                  :description="item.instanceId"
                />
                <ATag>
                  {{ workflowStatusLabel(item.executionStatus || item.status) }}
                </ATag>
              </AListItem>
            </template>
          </AList>
        </ATabPane>
      </ATabs>
      <!-- 游标页只有继续读取信号，不推断全局条数或最后页码。 -->
      <ASpace v-if="currentPage" class="mt-3" wrap>
        <span>{{ pageSummary }}</span>
        <AButton
          :disabled="loading || currentPage.index === 0"
          @click="previousPage"
        >
          上一页
        </AButton>
        <AButton
          :disabled="loading || !currentPage.hasMore || !currentPage.nextCursor"
          @click="nextPage"
        >
          下一页
        </AButton>
      </ASpace>
    </ACard>
    <ARow
      v-if="selectedTask && (activeKey === 'todo' || activeKey === 'done')"
      class="mt-4"
      :gutter="16"
    >
      <ACol :lg="15" :span="24">
        <WorkflowTaskPanel
          :task="selectedTask"
          :submitting="submitting"
          :detail-components="detailComponents"
          :attachments="[...attachedFiles, ...pendingFiles]"
          :can-upload-attachment="canUploadAttachment"
          :can-download-attachment="canDownloadAttachment"
          :can-delete-pending-attachment="canDeletePendingAttachment"
          :uploading-attachment="uploadingFile"
          :downloading-attachment-id="downloadingFile"
          :deleting-attachment-id="deletingFile"
          :verification-challenge="verificationChallenge"
          @prepare-verification="prepareVerification"
          @verification-invalidated="invalidateVerification"
          @submit="complete"
          @upload-attachment="uploadAttachment"
          @download-attachment="downloadAttachment"
          @delete-pending-attachment="deletePendingAttachment"
        />
      </ACol>
      <ACol :lg="9" :span="24">
        <ACard size="small" title="流程图">
          <WorkflowProcessDiagram :task="selectedTask" />
        </ACard>
      </ACol>
    </ARow>
    <div
      v-if="
        selectedInstance && (activeKey === 'started' || activeKey === 'copied')
      "
      ref="instanceDetail"
      class="levin-workflow-instance-detail mt-4"
    >
      <ARow :gutter="16">
        <ACol :span="24">
          <ACard size="small" title="流程图">
            <WorkflowProcessDiagram :task="selectedInstance" />
          </ACard>
        </ACol>
        <ACol :span="24" class="mt-4">
          <ACard
            size="small"
            :title="activeKey === 'copied' ? '抄送实例详情' : '流程实例详情'"
          >
            <!-- 实例只读详情只呈现服务端授权的固定事实，不补造任务动作。 -->
            <h3>
              {{
                selectedInstance.businessTitle || selectedInstance.purposeKey
              }}
            </h3>
            <p>实例：{{ selectedInstance.instanceId }}</p>
            <p>
              执行：{{
                workflowStatusLabel(
                  selectedInstance.executionStatus || selectedInstance.status,
                )
              }}
            </p>
            <p v-if="selectedInstance.outcome">
              结果：{{ workflowStatusLabel(selectedInstance.outcome) }}
            </p>
            <p v-if="selectedInstance.effectStatus">
              业务处理：{{ workflowStatusLabel(selectedInstance.effectStatus) }}
            </p>
            <!-- 仅发起人可在运行实例上明确发送抄送，候选由当前实例的服务端授权接口返回。 -->
            <div
              v-if="
                activeKey === 'started' &&
                canSendCopy &&
                canLoadCopyRecipients &&
                loadCopyRecipients &&
                selectedInstance.status === 'Running'
              "
              class="mb-4"
            >
              <h4>发送抄送</h4>
              <ASpace wrap>
                <ASelect
                  v-model:value="copyRecipients"
                  mode="multiple"
                  show-search
                  :filter-option="false"
                  :options="copyOptions"
                  :loading="loadingCopyOptions"
                  style="min-width: 240px"
                  placeholder="输入至少2字搜索接收人"
                  @search="searchCopyRecipients"
                />
                <AButton
                  :loading="sendingCopy"
                  :disabled="copyRecipients.length === 0"
                  @click="sendCopy"
                >
                  发送抄送
                </AButton>
              </ASpace>
            </div>
            <!-- 实例附件只来自当前授权的最小元数据，下载再次调用独立鉴权入口。 -->
            <template
              v-if="
                activeKey === 'started' &&
                canViewAttachments &&
                instanceFiles.length > 0
              "
            >
              <h4>流程附件</h4>
              <AList :data-source="instanceFiles" size="small">
                <template #renderItem="{ item }">
                  <AListItem>
                    <ASpace wrap>
                      <span>{{ attachmentLabel(item) }}</span>
                      <AButton
                        v-if="canDownloadAttachment"
                        size="small"
                        :loading="downloadingFile === item.id"
                        @click="downloadAttachment(item)"
                      >
                        下载附件
                      </AButton>
                    </ASpace>
                  </AListItem>
                </template>
              </AList>
            </template>
            <h4>流程轨迹</h4>
            <AAlert
              v-if="selectedInstance.timelineTruncated"
              type="info"
              message="仅展示最近1000条记录，原始历史仍保留。"
            />
            <ATimeline v-if="selectedInstance.timeline?.length">
              <ATimelineItem
                v-for="(item, index) in selectedInstance.timeline"
                :key="item.id || index"
              >
                <div>{{ item.time }}</div>
                <strong>{{ item.name }}</strong>
                <div v-if="item.actor || item.comment">
                  {{ item.actor }} {{ item.comment }}
                </div>
              </ATimelineItem>
            </ATimeline>
            <AEmpty v-else description="暂无可展示的流程轨迹" />
          </ACard>
        </ACol>
      </ARow>
    </div>
  </section>
</template>
