<script lang="ts" setup>
import type { WorkflowNode, WorkflowNotification } from './types';

import { computed } from 'vue';

import {
  notificationChannels,
  notificationErrors,
  notificationEvents,
  notificationPlainText,
  notificationPreview,
  notificationVariables,
  supportsTaskCandidates,
} from './workflow-notification';

const props = defineProps<{
  node: WorkflowNode;
  processName: string;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  change: [value: WorkflowNotification[]];
}>();
const items = computed(() => props.node.notifications ?? []);
const available = computed(() =>
  notificationEvents(props.node.type).filter(
    (event) => !items.value.some((item) => item.event === event.value),
  ),
);
const errors = computed(() => notificationErrors(props.node));
function update(index: number, patch: Partial<WorkflowNotification>) {
  if (props.readonly) return;
  emit(
    'change',
    items.value.map((item, current) =>
      current === index ? { ...item, ...patch } : item,
    ),
  );
}
function add() {
  if (props.readonly || !available.value[0] || items.value.length >= 4) return;
  emit('change', [
    ...items.value,
    {
      event: available.value[0].value,
      recipient: 'applicant',
      channels: ['Station'],
      title: '{{process.name}} · {{node.name}}',
      content:
        '# {{process.name}}\n\n**{{node.name}}**：{{event.name}}\n\n业务记录：{{business.id}}',
    },
  ]);
}
function changeEvent(index: number, event: WorkflowNotification['event']) {
  const recipient = items.value[index]?.recipient;
  update(index, {
    event,
    ...(recipient === 'taskCandidates' && !supportsTaskCandidates(event)
      ? { recipient: 'applicant' as const }
      : {}),
  });
}
function channel(
  index: number,
  value: WorkflowNotification['channels'][number],
  checked: boolean,
) {
  const current = items.value[index]?.channels ?? [];
  update(index, {
    channels: checked
      ? [...new Set([value, ...current])]
      : current.filter((entry) => entry !== value),
  });
}
function text(event: Event) {
  return (event.target as HTMLInputElement).value;
}
function remove(index: number) {
  if (!props.readonly)
    emit(
      'change',
      items.value.filter((_, current) => current !== index),
    );
}
</script>

<template>
  <!-- 自动与人工节点共用通知配置，发布版本沿用宿主只读状态。 -->
  <section class="notification-editor" aria-label="步骤通知">
    <h4>步骤通知</h4>
    <p v-if="items.length === 0">此步骤尚未配置通知。</p>
    <article
      v-for="(item, index) in items"
      :key="index"
      class="notification-rule"
    >
      <h5>通知 {{ index + 1 }}</h5>
      <label>
        触发时机
        <select
          :disabled="readonly"
          :value="item.event"
          aria-label="通知触发时机"
          @change="
            changeEvent(index, text($event) as WorkflowNotification['event'])
          "
        >
          <option
            v-for="event in notificationEvents(node.type)"
            :key="event.value"
            :value="event.value"
            :disabled="
              items.some(
                (entry, current) =>
                  current !== index && entry.event === event.value,
              )
            "
          >
            {{ event.label }}
          </option>
        </select>
      </label>
      <label>
        接收人
        <select
          :disabled="readonly"
          :value="item.recipient"
          aria-label="通知接收人"
          @change="
            update(index, {
              recipient: text($event) as WorkflowNotification['recipient'],
            })
          "
        >
          <option value="applicant">业务申请人</option>
          <option value="initiator">流程发起人</option>
          <option
            v-if="supportsTaskCandidates(item.event)"
            value="taskCandidates"
          >
            当前待办候选人
          </option>
        </select>
      </label>
      <fieldset :disabled="readonly">
        <legend>通知渠道</legend>
        <label
          v-for="entry in notificationChannels"
          :key="entry.value"
          class="channel"
        >
          <input
            type="checkbox"
            :checked="item.channels.includes(entry.value)"
            @change="
              channel(
                index,
                entry.value,
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          {{ entry.label }}
        </label>
      </fieldset>
      <p class="hint">收件联系方式和机器人由服务端授权配置解析。</p>
      <label>
        通知标题
        <input
          :readonly="readonly"
          :value="item.title"
          maxlength="120"
          aria-label="通知标题"
          @input="update(index, { title: text($event) })"
        />
      </label>
      <label>
        通知正文（Markdown）
        <textarea
          :readonly="readonly"
          :value="item.content"
          maxlength="4000"
          rows="6"
          aria-label="通知正文"
          @input="update(index, { content: text($event) })"
        ></textarea>
      </label>
      <div v-if="!readonly" class="variables">
        <span>插入正文变量：</span>
        <button
          v-for="variable in notificationVariables"
          :key="variable.key"
          type="button"
          @click="
            update(index, {
              content: `${item.content}{{${variable.key}}}`,
            })
          "
        >
          {{ variable.label }}
        </button>
      </div>
      <details>
        <summary>内容预览（示例数据）</summary>
        <h5>
          {{ notificationPreview(item, processName, node.name, 'title') }}
        </h5>
        <slot
          name="preview"
          :content="notificationPreview(item, processName, node.name)"
        >
          <pre>{{ notificationPreview(item, processName, node.name) }}</pre>
        </slot>
        <template v-if="item.channels.includes('Sms')">
          <h5>短信纯文本预览</h5>
          <pre>{{
            notificationPlainText(
              `${notificationPreview(item, processName, node.name, 'title')}\n\n${notificationPreview(item, processName, node.name)}`,
            )
          }}</pre>
        </template>
      </details>
      <button
        v-if="!readonly"
        type="button"
        class="remove"
        @click="remove(index)"
      >
        删除通知 {{ index + 1 }}
      </button>
    </article>
    <ul v-if="errors.length > 0" class="errors" role="alert">
      <li v-for="error in errors" :key="error">{{ error }}</li>
    </ul>
    <button
      v-if="!readonly"
      type="button"
      :disabled="available.length === 0 || items.length >= 4"
      @click="add"
    >
      添加步骤通知
    </button>
    <p class="hint">
      支持标题、列表、加粗和安全链接；不支持
      HTML、图片与脚本。短信发送纯文本，模拟检查不发送通知。
    </p>
  </section>
</template>

<style scoped>
/* 使用宿主语义色，节点属性窄栏内保持标签与表单自然换行。 */
.notification-editor {
  margin-block: 1rem;
  min-width: 0;
}
.notification-rule {
  margin-block: 0.75rem;
  padding: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-block: 0.75rem;
}
.channel {
  flex-direction: row;
  align-items: center;
}
input:not([type='checkbox']),
select,
textarea {
  width: 100%;
  padding: 0.375rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.25rem;
  background: hsl(var(--background));
}
fieldset {
  border: 0;
  padding: 0;
}
.variables {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
button {
  padding: 0.25rem 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.25rem;
}
button:disabled {
  opacity: 0.5;
}
.hint {
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  margin-block: 0.5rem;
}
.errors,
.remove {
  color: hsl(var(--destructive));
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
