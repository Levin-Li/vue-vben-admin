<script setup lang="ts">
import type { WorkflowOption, WorkflowStateEventCommand } from './types';

import { computed, ref, watch } from 'vue';

import { Alert, Button, Popconfirm, Space } from 'ant-design-vue';

// 动作和访问标识全部来自当前授权响应，客户端不提交目标状态或条件值。
const props = defineProps<{
  events?: WorkflowOption[];
  execute: (command: WorkflowStateEventCommand) => Promise<unknown>;
  instanceId?: string;
  visitId?: string;
}>();
const emit = defineEmits<{ completed: []; error: [error: unknown] }>();
const pendingEvent = ref('');
const errorMessage = ref('');
const commandKeys = new Map<string, string>();
const identity = computed(
  () => `${props.instanceId || ''}:${props.visitId || ''}`,
);
let generation = 0;
watch(
  identity,
  () => {
    ++generation;
    commandKeys.clear();
    errorMessage.value = '';
  },
  { flush: 'sync' },
);

async function trigger(eventId: string) {
  if (
    !props.instanceId ||
    !props.visitId ||
    pendingEvent.value ||
    !props.events?.some((event) => event.value === eventId)
  )
    return;

  // 同一次访问中失败重试沿用命令键，避免网络超时后重复流转。
  let key = commandKeys.get(eventId);
  if (!key) {
    key = crypto.randomUUID();
    commandKeys.set(eventId, key);
  }
  const requestGeneration = generation;
  pendingEvent.value = eventId;
  errorMessage.value = '';
  try {
    await props.execute({
      instanceId: props.instanceId,
      eventId,
      expectedVisitId: props.visitId,
      idempotencyKey: key,
    });
    if (requestGeneration === generation) emit('completed');
  } catch (error) {
    if (requestGeneration === generation) {
      errorMessage.value =
        error instanceof Error ? error.message : '流程操作失败，请刷新后重试';
      emit('error', error);
    }
  } finally {
    pendingEvent.value = '';
  }
}
</script>

<template>
  <!-- 抄送只读实例或无权执行时，服务端不给动作，此处不推导额外按钮。 -->
  <section
    v-if="instanceId && visitId && events?.length"
    class="my-3"
    aria-label="当前状态可执行操作"
  >
    <Space wrap>
      <Popconfirm
        v-for="event in events"
        :key="event.value"
        :title="`确认「${event.label}」吗？`"
        :disabled="Boolean(pendingEvent)"
        @confirm="trigger(event.value)"
      >
        <Button
          :loading="pendingEvent === event.value"
          :disabled="Boolean(pendingEvent)"
        >
          {{ event.label }}
        </Button>
      </Popconfirm>
    </Space>
    <Alert
      v-if="errorMessage"
      class="mt-2"
      type="error"
      :message="errorMessage"
    />
  </section>
</template>
