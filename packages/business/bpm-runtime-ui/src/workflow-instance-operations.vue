<script setup lang="ts">
import type {
  WorkflowInstanceOperation as InstanceOperation,
  WorkflowInstanceOperationCommand as InstanceOperationCommand,
  WorkflowBusinessReference,
} from './types';

import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import { Alert, Button, Input } from 'ant-design-vue';

// 操作目录必须由服务端提供，宿主同时提供每个真实API方法的当前权限。
const props = defineProps<{
  allowedActions?: string[];
  businessReference: WorkflowBusinessReference;
  dispatchId?: string;
  execute: (
    action: InstanceOperation,
    command: InstanceOperationCommand,
  ) => Promise<unknown>;
  instanceId: string;
  permissions: Partial<Record<InstanceOperation, boolean>>;
}>();
const emit = defineEmits<{ completed: []; error: [error: unknown] }>();
const labels: Record<InstanceOperation, string> = {
  withdraw: '撤回流程',
  terminate: '终止流程',
  recover: '接管并恢复',
};
const available = computed(() =>
  (['withdraw', 'terminate', 'recover'] as InstanceOperation[]).filter(
    (action) =>
      props.permissions[action] === true &&
      props.allowedActions?.includes(action) &&
      (action !== 'recover' || Boolean(props.dispatchId)),
  ),
);
const action = ref<InstanceOperation>();
const reason = ref('');
const busy = ref(false);
const error = ref('');
const pending = shallowRef<{
  action: InstanceOperation;
  command: InstanceOperationCommand;
}>();
let generation = 0;

// 实例切换或离开页面清空本地草稿；晚响应不能刷新另一实例。
watch(
  () =>
    JSON.stringify([
      props.instanceId,
      props.businessReference,
      props.dispatchId,
    ]),
  () => {
    generation++;
    action.value = undefined;
    reason.value = '';
    error.value = '';
    pending.value = undefined;
    busy.value = false;
  },
  { flush: 'sync' },
);
onBeforeUnmount(() => generation++);

function open(value: InstanceOperation) {
  if (busy.value || !available.value.includes(value)) return;
  if (pending.value && pending.value.action !== value) return;
  action.value = value;
  reason.value = pending.value?.command.reason ?? '';
  error.value = '';
}

// 请求失败保留完整原命令；重试不换去重标识、不更换原因或实例。
async function submit() {
  const selected = action.value;
  if (!selected || busy.value || !available.value.includes(selected)) return;
  const message = reason.value.trim();
  if (!message || message.length > 500) {
    error.value = '请填写1至500字操作原因。';
    return;
  }
  if (!pending.value)
    pending.value = {
      action: selected,
      command: {
        ...props.businessReference,
        dispatchId: props.dispatchId,
        instanceId: props.instanceId,
        reason: message,
        requestId: crypto.randomUUID(),
      },
    };
  const request = pending.value;
  if (
    request.action !== selected ||
    request.command.instanceId !== props.instanceId
  )
    return;
  const current = generation;
  busy.value = true;
  error.value = '';
  try {
    await props.execute(request.action, { ...request.command });
    if (current !== generation) return;
    pending.value = undefined;
    action.value = undefined;
    reason.value = '';
    emit('completed');
  } catch (error_) {
    if (current !== generation) return;
    error.value =
      error_ instanceof Error
        ? error_.message
        : '流程操作失败，请重试原命令或刷新实例确认结果。';
    emit('error', error_);
  } finally {
    if (current === generation) busy.value = false;
  }
}
</script>

<template>
  <section
    v-if="available.length > 0"
    class="workflow-instance-operations"
    aria-label="流程运行操作"
  >
    <div class="workflow-instance-operations__buttons">
      <Button
        v-for="item in available"
        :key="item"
        :disabled="busy || (!!pending && pending.action !== item)"
        @click="open(item)"
      >
        {{ labels[item] }}
      </Button>
    </div>
    <div
      v-if="action"
      class="mt-3"
      data-form-id="workflowInstanceOperation"
      data-form-name="流程运行操作原因"
    >
      <Alert
        type="warning"
        show-icon
        :message="
          action === 'recover'
            ? '将以当前授权主体接管并恢复原失败处理，保持固定版本和参数；不重发结果待核验的外部操作。'
            : '将关闭该实例的全部活动任务并记录审计，不执行通过结果。请确认业务对象和操作原因。'
        "
      />
      <label class="mt-3 block">操作原因（必填）</label>
      <Input.TextArea
        v-model:value="reason"
        aria-label="操作原因"
        :maxlength="500"
        :disabled="busy || !!pending"
        :rows="3"
      />
      <Alert
        v-if="error"
        class="mt-3"
        type="error"
        :message="error"
        show-icon
      />
      <p v-if="pending && !busy" class="my-2">
        重试将提交同一原命令；也可刷新实例确认当前结果。
      </p>
      <div class="workflow-instance-operations__buttons mt-3">
        <Button
          type="primary"
          :loading="busy"
          :disabled="busy || !reason.trim() || !available.includes(action)"
          @click="submit"
        >
          {{ pending && !busy ? '重试原命令' : `确认${labels[action]}` }}
        </Button>
        <Button :disabled="busy" @click="action = undefined">关闭</Button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.workflow-instance-operations__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
