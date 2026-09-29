<script lang="ts" setup>
import type { Component } from 'vue';

import type {
  WorkflowActionInput,
  WorkflowInstanceView,
  WorkflowTaskSubmitPayload,
  WorkflowTaskView,
} from './types';

import { computed, onMounted, ref, watch } from 'vue';

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
  Space as ASpace,
  TabPane as ATabPane,
  Tabs as ATabs,
  Tag as ATag,
} from 'ant-design-vue';

import WorkflowProcessDiagram from './workflow-process-diagram.vue';
import { WorkflowRuntimeService } from './workflow-runtime-service';
import { workflowStatusLabel } from './workflow-task-form';
import WorkflowTaskPanel from './workflow-task-panel.vue';

const props = withDefaults(
  defineProps<{
    canRetry?: boolean;
    canViewDone?: boolean;
    canViewStarted?: boolean;
    canViewTodo?: boolean;
    detailComponents?: Record<string, Component>;
    loadCopied?: () => Promise<WorkflowTaskView[]>;
    service?: WorkflowRuntimeService;
  }>(),
  {
    canViewDone: true,
    canViewStarted: true,
    canViewTodo: true,
    detailComponents: undefined,
    loadCopied: undefined,
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
const activeKey = ref('todo');
const loading = ref(false);
const todo = ref<WorkflowTaskView[]>([]);
const done = ref<WorkflowTaskView[]>([]);
const copied = ref<WorkflowTaskView[]>([]);
const started = ref<WorkflowInstanceView[]>([]);
const selectedTask = ref<WorkflowTaskView>();
const submitting = ref(false);
const retrying = ref<string>();
const errorMessage = ref('');
const verificationMessage = ref('');
let refreshVersion = 0;

async function refresh() {
  const version = ++refreshVersion;
  loading.value = true;
  try {
    // 权限变化后切换到仍可读取的分栏；不让无权请求的403吞掉合法待办。
    const visibleKeys = [
      canViewTodo.value && 'todo',
      canViewDone.value && 'done',
      canViewStarted.value && 'started',
      'copied',
    ].filter(Boolean) as string[];
    if (!visibleKeys.includes(activeKey.value))
      activeKey.value = visibleKeys[0] || 'copied';

    const [todoResult, doneResult, startedResult, copiedResult] =
      await Promise.allSettled([
        canViewTodo.value ? service.value.todo() : Promise.resolve([]),
        canViewDone.value ? service.value.done() : Promise.resolve([]),
        canViewStarted.value ? service.value.started() : Promise.resolve([]),
        props.loadCopied?.() ?? Promise.resolve([]),
      ]);
    if (version !== refreshVersion) return;

    // 某分栏在请求期间撤权或故障时只丢弃该分栏结果，保留其它已授权列表。
    const results = [todoResult, doneResult, startedResult, copiedResult];
    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    todo.value = todoResult.status === 'fulfilled' ? todoResult.value : [];
    done.value = doneResult.status === 'fulfilled' ? doneResult.value : [];
    started.value =
      startedResult.status === 'fulfilled' ? startedResult.value : [];
    copied.value =
      copiedResult.status === 'fulfilled' ? copiedResult.value : [];
    errorMessage.value = firstFailure
      ? '部分流程列表加载失败，请检查权限或稍后重试。'
      : '';
    if (firstFailure) emit('error', firstFailure.reason);
    if (selectedTask.value)
      selectedTask.value = [...todo.value, ...done.value, ...copied.value].find(
        (task) => task.taskId === selectedTask.value?.taskId,
      );
  } catch (error) {
    if (version !== refreshVersion) return;
    errorMessage.value = '流程列表加载失败，请重试。';
    emit('error', error);
  } finally {
    if (version === refreshVersion) loading.value = false;
  }
}

// 当前用户权限重新载入或撤销时丢弃旧详情，并重新按最新授权加载列表。
watch([canViewTodo, canViewDone, canViewStarted], () => {
  selectedTask.value = undefined;
  void refresh();
});

async function complete(payload: WorkflowTaskSubmitPayload) {
  if (!selectedTask.value || submitting.value) return;
  submitting.value = true;
  errorMessage.value = '';
  verificationMessage.value = '';
  try {
    // 移除仅供界面展示的action对象，完整传递意见及动作专属参数。
    const { action, ...input } = payload;
    const result = await service.value.complete({
      ...input,
      actionCode: action.code,
      taskId: selectedTask.value.taskId,
    });
    emit('completed', result);
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
    verificationType: string;
  },
) {
  if (!selectedTask.value) return;
  try {
    // 摘要由服务端规范化计算，不将原始表单伪装成客户端“摘要”。
    const { action, ...input } = payload;
    const challenge = await service.value.prepareStepUpAuth({
      ...input,
      actionCode: action.code,
      taskId: selectedTask.value.taskId,
    });
    verificationMessage.value =
      challenge.message ||
      (challenge.successful
        ? '验证请求已发送，请完成验证。'
        : '验证请求未成功。');
  } catch (error) {
    errorMessage.value = '获取验证挑战失败，请重试。';
    emit('error', error);
  }
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
        <ATabPane v-if="canViewTodo" key="todo" :tab="`待办 ${todo.length}`">
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
        <ATabPane v-if="canViewDone" key="done" :tab="`已办 ${done.length}`">
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
        <ATabPane
          v-if="canViewStarted"
          key="started"
          :tab="`我发起 ${started.length}`"
        >
          <AList :data-source="started">
            <template #renderItem="{ item }">
              <AListItem>
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
                    @click="retry(item)"
                  >
                    重试业务处理
                  </AButton>
                </ASpace>
              </AListItem>
            </template>
          </AList>
        </ATabPane>
        <ATabPane key="copied" :tab="`抄送 ${copied.length}`">
          <AEmpty
            v-if="!loadCopied"
            description="宿主未提供抄送数据连接器"
          /><AList v-else :data-source="copied">
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
              </AListItem>
            </template>
          </AList>
        </ATabPane>
      </ATabs>
    </ACard>
    <ARow v-if="selectedTask" class="mt-4" :gutter="16">
      <ACol :lg="15" :span="24">
        <WorkflowTaskPanel
          :task="selectedTask"
          :submitting="submitting"
          :detail-components="detailComponents"
          @prepare-verification="prepareVerification"
          @submit="complete"
        />
      </ACol>
      <ACol :lg="9" :span="24">
        <ACard size="small" title="流程图">
          <WorkflowProcessDiagram :task="selectedTask" />
        </ACard>
      </ACol>
    </ARow>
  </section>
</template>
