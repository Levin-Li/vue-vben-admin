<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import WorkflowProcessDiagram from './workflow-process-diagram.vue';
import { WorkflowRuntimeService } from './workflow-runtime-service';
import WorkflowTaskPanel from './workflow-task-panel.vue';
import type { WorkflowInstanceView, WorkflowTaskSubmitPayload, WorkflowTaskView } from './types';

const props = defineProps<{ service?: WorkflowRuntimeService; loadCopied?: () => Promise<WorkflowTaskView[]> }>();
const emit = defineEmits<{ completed: [task: WorkflowTaskView]; error: [error: unknown] }>();
const service = computed(() => props.service ?? new WorkflowRuntimeService());
const activeKey = ref('todo');
const loading = ref(false);
const todo = ref<WorkflowTaskView[]>([]);
const done = ref<WorkflowTaskView[]>([]);
const copied = ref<WorkflowTaskView[]>([]);
const started = ref<WorkflowInstanceView[]>([]);
const selectedTask = ref<WorkflowTaskView>();

async function refresh() {
  loading.value = true;
  try {
    const [todoResult, doneResult, startedResult, copiedResult] = await Promise.all([
      service.value.todo(), service.value.done(), service.value.started(), props.loadCopied?.() ?? Promise.resolve([]),
    ]);
    todo.value = todoResult; done.value = doneResult; started.value = startedResult; copied.value = copiedResult;
    if (selectedTask.value) selectedTask.value = [...todo.value, ...done.value, ...copied.value].find((task) => task.taskId === selectedTask.value?.taskId);
  } catch (error) { emit('error', error); } finally { loading.value = false; }
}

async function complete(payload: WorkflowTaskSubmitPayload) {
  if (!selectedTask.value) return;
  try {
    const result = await service.value.complete({ actionCode: payload.action.code, formData: payload.formData, taskId: selectedTask.value.taskId, verificationCode: payload.verificationCode, verificationType: payload.verificationType });
    emit('completed', result); await refresh();
  } catch (error) { emit('error', error); }
}
async function prepareVerification(payload: { action: { code: string }; formData: Record<string, unknown>; verificationType: string }) {
  if (!selectedTask.value) return;
  try {
    await service.value.prepareStepUpAuth({ actionCode: payload.action.code, formSummary: JSON.stringify(payload.formData), taskId: selectedTask.value.taskId, verificationType: payload.verificationType });
  } catch (error) { emit('error', error); }
}
onMounted(refresh);
</script>

<template>
  <section class="levin-workflow-runtime-workbench">
    <a-card title="工作流中心" size="small">
      <template #extra><a-button :loading="loading" @click="refresh">刷新</a-button></template>
      <a-tabs v-model:active-key="activeKey">
        <a-tab-pane key="todo" :tab="`待办 ${todo.length}`"><a-list :data-source="todo" item-layout="horizontal"><template #renderItem="{ item }"><a-list-item class="cursor-pointer" @click="selectedTask = item"><a-list-item-meta :description="item.processInstanceId"><template #title>{{ item.taskName || item.taskId }}</template></a-list-item-meta><a-tag color="processing">待处理</a-tag></a-list-item></template></a-list></a-tab-pane>
        <a-tab-pane key="done" :tab="`已办 ${done.length}`"><a-list :data-source="done"><template #renderItem="{ item }"><a-list-item class="cursor-pointer" @click="selectedTask = item">{{ item.taskName || item.taskId }}</a-list-item></template></a-list></a-tab-pane>
        <a-tab-pane key="started" :tab="`我发起 ${started.length}`"><a-list :data-source="started"><template #renderItem="{ item }"><a-list-item><a-list-item-meta :description="item.instanceId"><template #title>流程版本 {{ item.definitionVersionId || '-' }}</template></a-list-item-meta><a-tag>{{ item.status }}</a-tag></a-list-item></template></a-list></a-tab-pane>
        <a-tab-pane key="copied" :tab="`抄送 ${copied.length}`"><a-empty v-if="!loadCopied" description="宿主未提供抄送数据连接器" /><a-list v-else :data-source="copied"><template #renderItem="{ item }"><a-list-item class="cursor-pointer" @click="selectedTask = item">{{ item.taskName || item.taskId }}</a-list-item></template></a-list></a-tab-pane>
      </a-tabs>
    </a-card>
    <a-row v-if="selectedTask" class="mt-4" :gutter="16"><a-col :lg="15" :span="24"><WorkflowTaskPanel :task="selectedTask" @prepare-verification="prepareVerification" @submit="complete" /></a-col><a-col :lg="9" :span="24"><a-card size="small" title="流程图"><WorkflowProcessDiagram :task="selectedTask" /></a-card></a-col></a-row>
  </section>
</template>
