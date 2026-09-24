<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';

import type { WorkflowTaskAction, WorkflowTaskSubmitPayload, WorkflowTaskView } from './types';

const props = defineProps<{
  task: WorkflowTaskView;
}>();

const emit = defineEmits<{
  action: [action: WorkflowTaskAction];
  prepareVerification: [payload: { action: WorkflowTaskAction; formData: Record<string, unknown>; verificationType: string }];
  submit: [payload: WorkflowTaskSubmitPayload];
}>();

const formData = reactive<Record<string, unknown>>({});
const verificationCode = ref('');
const verificationType = ref<string>();
const selectedAction = ref<WorkflowTaskAction>();
const displayFormItems = computed(() => props.task.formItems || props.task.requiredFields?.map((key) => ({ key, label: key, required: true })) || []);

function chooseAction(action: WorkflowTaskAction) { selectedAction.value = action; emit('action', action); }
function prepareVerification() {
  if (!selectedAction.value || !verificationType.value) return;
  emit('prepareVerification', { action: selectedAction.value, formData, verificationType: verificationType.value });
}
function submit() {
  if (!selectedAction.value) return;
  const missing = displayFormItems.value.filter((item) => item.required && !formData[item.key]);
  if (missing.length) return;
  if (props.task.verificationTypes?.length && (!verificationType.value || !verificationCode.value)) return;
  emit('submit', { action: selectedAction.value, formData, verificationCode: verificationCode.value || undefined, verificationType: verificationType.value });
}
</script>

<template>
  <section class="levin-workflow-task-panel">
    <a-card :title="task.businessTitle || task.taskName || '流程待办'" size="small">
      <template #extra><a-tag>{{ task.status === 'Completed' ? '已处理' : '待处理' }}</a-tag></template>
      <a-descriptions :column="1" bordered size="small">
        <a-descriptions-item label="流程实例">{{ task.processInstanceId || '-' }}</a-descriptions-item>
        <a-descriptions-item label="节点">{{ task.taskName || task.taskDefinitionKey || '-' }}</a-descriptions-item>
      </a-descriptions>
      <a-divider orientation="left">审批表单</a-divider>
      <a-form layout="vertical">
        <a-form-item v-for="item in displayFormItems" :key="item.key" :label="item.label" :required="item.required">
          <a-textarea v-if="item.type === 'textarea'" v-model:value="formData[item.key]" :disabled="task.status === 'Completed'" />
          <a-input v-else v-model:value="formData[item.key]" :disabled="task.status === 'Completed'" />
        </a-form-item>
      </a-form>
      <a-alert v-if="displayFormItems.some((item) => item.required && !formData[item.key])" class="mb-3" message="请填写节点要求的表单字段后再提交。" type="warning" />
      <slot name="form" />
      <a-divider orientation="left">审批动作</a-divider>
      <a-space wrap>
        <a-button
          v-for="action in task.actions || [{ code: 'approve', label: '通过' }]"
          :key="action.code"
          :type="selectedAction?.code === action.code ? 'primary' : 'default'"
          :disabled="task.status === 'Completed'"
          @click="chooseAction(action)"
        >
          {{ action.label }}
        </a-button>
      </a-space>
      <a-form v-if="selectedAction && task.verificationTypes?.length" class="mt-4" layout="inline">
        <a-form-item label="二次验证"><a-select v-model:value="verificationType" :options="task.verificationTypes.map((type) => ({ label: type, value: type }))" placeholder="选择验证方式" style="min-width: 9rem" /></a-form-item>
        <a-form-item label="验证码"><a-input v-model:value="verificationCode" autocomplete="one-time-code" /></a-form-item>
        <a-form-item><a-button :disabled="!verificationType" @click="prepareVerification">获取验证码</a-button></a-form-item>
      </a-form>
      <a-button v-if="selectedAction" class="mt-4" type="primary" @click="submit">确认{{ selectedAction.label }}</a-button>
      <a-divider orientation="left">流程轨迹</a-divider>
      <a-timeline v-if="task.timeline?.length"><a-timeline-item v-for="item in task.timeline" :key="`${item.name}-${item.time}`"><strong>{{ item.name }}</strong><span class="ml-2 text-muted-foreground">{{ item.time }}</span><div v-if="item.actor || item.comment">{{ item.actor }} {{ item.comment }}</div></a-timeline-item></a-timeline>
      <a-empty v-else description="暂无可展示的流程轨迹" :image-style="{ height: '48px' }" />
      <slot name="timeline" />
      <template v-if="task.notifications?.length"><a-divider orientation="left">通知</a-divider><a-list :data-source="task.notifications" size="small"><template #renderItem="{ item }"><a-list-item><a-list-item-meta :description="item.content"><template #title>{{ item.title || item.channel }}<a-tag class="ml-2">{{ item.channel }}</a-tag></template></a-list-item-meta></a-list-item></template></a-list></template>
    </a-card>
  </section>
</template>
