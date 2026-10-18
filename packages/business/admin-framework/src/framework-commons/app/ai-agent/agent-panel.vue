<script lang="ts" setup>
import type {
  AgentAvailableProvider,
  AgentExecutionTrace,
  AgentMessage,
  AgentTurnResult,
  AgentWriteContinuation,
} from './chat';
import type { PendingAgentWrite } from './skills';

import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { loadAgentProviders, runAgentTurn } from './chat';
import { confirmAgentWrite } from './skills';

const props = defineProps<{
  accessToken?: null | string;
  currentPath?: string;
  scopeKey?: string;
  superAdmin?: boolean;
  userId?: string;
}>();
const open = ref(false);
const draft = ref('');
const providerCode = ref('');
const availableProviders = ref<AgentAvailableProvider[]>([]);
const providerStatus = ref('');
const busy = ref(false);
const progress = ref('');
const messages = ref<AgentMessage[]>([]);
const pendingWrite = ref<PendingAgentWrite>();
const continuation = shallowRef<AgentWriteContinuation>();
const traces = ref<AgentExecutionTrace[]>([]);
let turnController: AbortController | undefined;
const pendingWriteStatus = ref<'preview' | 'uncertain'>('preview');
const scrollArea = ref<HTMLElement>();
let turnSequence = 0;
let contextController = new AbortController();

onBeforeUnmount(() => {
  contextController.abort();
  turnController?.abort();
});

// 停止只阻止模型和后续技能，不宣称撤销已发出的业务请求。
function stop() {
  turnController?.abort();
  progress.value = '已请求停止，正在收拢已完成结果…';
}

function clearConversation() {
  contextController.abort();
  turnController?.abort();
  contextController = new AbortController();
  turnSequence += 1;
  messages.value = [];
  traces.value = [];
  continuation.value = undefined;
  pendingWrite.value = undefined;
  pendingWriteStatus.value = 'preview';
  draft.value = '';
  availableProviders.value = [];
  providerCode.value = '';
  providerStatus.value = '';
  progress.value = '';
  busy.value = false;
  open.value = false;
}

async function refreshProviders() {
  const identity = activeContextKey();
  providerStatus.value = '正在读取可用模型…';
  try {
    const providers = await loadAgentProviders(contextController.signal);
    if (identity !== activeContextKey()) return;
    availableProviders.value = providers;
    providerStatus.value =
      availableProviders.value.length > 0
        ? ''
        : '当前租户没有可用的网页直连配置';
    if (
      !availableProviders.value.some(
        (item) => item.providerCode === providerCode.value,
      )
    ) {
      providerCode.value = availableProviders.value[0]?.providerCode || '';
    }
  } catch {
    if (identity !== activeContextKey()) return;
    availableProviders.value = [];
    providerCode.value = '';
    providerStatus.value = '网页直连配置查询失败';
  }
}

function activeContextKey() {
  return JSON.stringify([
    props.accessToken || '',
    props.userId || '',
    props.scopeKey || '',
    props.superAdmin === true,
  ]);
}

onMounted(() => {
  if (props.accessToken) void refreshProviders();
});

// 身份或租户/域变化时清除旧范围数据，并重新读取可用供应商。
watch(activeContextKey, (identity, previousIdentity) => {
  if (identity !== previousIdentity) {
    clearConversation();
    if (props.accessToken) void refreshProviders();
  }
});

defineExpose({ clearConversation });

async function scrollToLatest() {
  await nextTick();
  scrollArea.value?.scrollTo({
    top: scrollArea.value.scrollHeight,
    behavior: 'smooth',
  });
}

async function send() {
  const content = draft.value.trim();
  if (!content || busy.value || content.length > 4000) return;
  draft.value = '';
  messages.value.push({ content, role: 'User' });
  busy.value = true;
  const startingIdentity = activeContextKey();
  const currentTurn = ++turnSequence;
  turnController = new AbortController();
  const signal = turnController.signal;
  const reportProgress = (value: string) => {
    if (currentTurn === turnSequence) progress.value = value;
  };
  const reportTrace = (entry: AgentExecutionTrace) => {
    if (currentTurn !== turnSequence) return;
    const previous = traces.value.findIndex(
      (item) => item.id === entry.id && item.skill === entry.skill,
    );
    if (previous === -1) {
      traces.value.push(entry);
    } else {
      traces.value[previous] = entry;
    }
    traces.value = traces.value.slice(-24);
  };
  const acceptResult = (result: AgentTurnResult) => {
    if (currentTurn !== turnSequence || startingIdentity !== activeContextKey())
      return;
    pendingWrite.value = result.pendingWrite;
    continuation.value = result.continueAfterWrite;
    pendingWriteStatus.value = 'preview';
    messages.value.push(result.message);
  };
  await scrollToLatest();

  try {
    if (pendingWrite.value) {
      const pending = pendingWrite.value;
      if (content === '取消') {
        pendingWrite.value = undefined;
        continuation.value = undefined;
        pendingWriteStatus.value = 'preview';
        messages.value.push({
          content: '已取消当前操作跟踪。',
          role: 'Assistant',
        });
      } else if (
        pendingWriteStatus.value === 'uncertain' &&
        content === '复查'
      ) {
        progress.value = '正在只读复查当前状态…';
        const verified = await pending.recheck();
        if (
          currentTurn === turnSequence &&
          startingIdentity === activeContextKey()
        ) {
          if (verified) {
            continuation.value = undefined;
            pendingWrite.value = undefined;
            pendingWriteStatus.value = 'preview';
            messages.value.push({
              content:
                '复查确认当前状态已达到目标；无法仅凭复查判断是否由本次提交完成。',
              role: 'Assistant',
              source: pending.source,
            });
          } else {
            messages.value.push({
              content:
                '复查未观察到目标状态，提交结果仍不确定。不会重复提交；可继续输入“复查”或“取消”。',
              role: 'Assistant',
              source: pending.source,
            });
          }
        }
      } else if (pendingWriteStatus.value === 'preview' && content === '确认') {
        // 发出请求前即锁定为不确定态；异常可能发生在提交前或提交后，均禁止自动重发。
        pendingWriteStatus.value = 'uncertain';
        progress.value = '正在执行并读回核验…';
        const result = await confirmAgentWrite(pending);
        if (
          currentTurn === turnSequence &&
          startingIdentity === activeContextKey()
        ) {
          pendingWrite.value = undefined;
          pendingWriteStatus.value = 'preview';
          messages.value.push({
            content: result,
            role: 'Assistant',
            source: pending.source,
          });
          const writeTrace = traces.value.findLast(
            (entry) => entry.status === 'preview',
          );
          if (writeTrace)
            reportTrace({
              ...writeTrace,
              status: 'completed',
              source: pending.source,
            });
          const resume = continuation.value;
          continuation.value = undefined;
          if (resume && !signal.aborted) {
            acceptResult(
              await resume(result, reportProgress, signal, reportTrace),
            );
          } else if (signal.aborted) {
            messages.value.push({
              role: 'Assistant',
              content: '修改已核验完成；已停止后续分析，停止不等于撤销。',
            });
          }
        }
      } else {
        messages.value.push({
          content:
            pendingWriteStatus.value === 'uncertain'
              ? '本次操作可能已经提交，不能重复确认。请输入“复查”读取当前状态，或输入“取消”结束跟踪。'
              : '操作尚未提交。请输入“确认”执行，或输入“取消”放弃。',
          role: 'Assistant',
        });
      }
    } else {
      traces.value = [];
      const result = await runAgentTurn(
        messages.value,
        props.currentPath || '/',
        props.superAdmin === true,
        providerCode.value,
        reportProgress,
        signal,
        reportTrace,
      );
      acceptResult(result);
    }
  } catch (error) {
    if (
      currentTurn === turnSequence &&
      startingIdentity === activeContextKey()
    ) {
      let errorMessage =
        error instanceof Error ? error.message : '任务执行失败，请稍后重试';
      if (pendingWrite.value && pendingWriteStatus.value === 'uncertain') {
        const writeTrace = traces.value.findLast(
          (entry) => entry.status === 'preview',
        );
        if (writeTrace) reportTrace({ ...writeTrace, status: 'uncertain' });
        errorMessage =
          '本次提交或核验未得到确定结果，系统不会重复提交。请输入“复查”只读检查当前状态，或输入“取消”结束跟踪。';
      }
      messages.value.push({
        content: errorMessage,
        role: 'Assistant',
      });
    }
  } finally {
    if (currentTurn === turnSequence) {
      busy.value = false;
      progress.value = '';
      await scrollToLatest();
    }
  }
}
</script>

<template>
  <!-- 全站入口保持挂载，业务路由变化时不重置聊天记录。 -->
  <div class="agent-host">
    <button
      v-if="!open"
      class="agent-launcher"
      type="button"
      aria-label="展开系统 AI 助手"
      @click="open = true"
    >
      系统 AI
    </button>

    <section v-else class="agent-panel" aria-label="系统 AI 助手">
      <header class="agent-header">
        <div>
          <strong>系统 AI 助手</strong>
          <small>业务处理与故障诊断</small>
        </div>
        <button
          type="button"
          aria-label="收起系统 AI 助手"
          @click="open = false"
        >
          收起
        </button>
      </header>

      <!-- 供应商只是模型引擎选择，是否已配置由后端校验。 -->
      <label class="agent-provider">
        模型接入
        <select
          v-model="providerCode"
          :disabled="busy"
          aria-label="选择模型接入"
        >
          <option value="">系统默认</option>
          <option
            v-for="item in availableProviders"
            :key="item.providerCode"
            :value="item.providerCode"
          >
            {{ item.providerName }}
          </option>
        </select>
        <small v-if="providerStatus">{{ providerStatus }}</small>
      </label>

      <div
        ref="scrollArea"
        class="agent-messages"
        role="log"
        aria-live="polite"
      >
        <p v-if="messages.length === 0" class="agent-hint">
          告诉我你要查询或分析什么。我会通过已授权的系统技能获取数据。
        </p>
        <article
          v-for="(item, index) in messages"
          :key="index"
          class="agent-message"
          :class="item.role === 'User' ? 'from-user' : 'from-agent'"
        >
          <span class="agent-speaker">{{
            item.role === 'User' ? '你' : '系统 AI'
          }}</span>
          <p>{{ item.content }}</p>
          <small v-if="item.source">数据来源：{{ item.source }}</small>
        </article>
        <p v-if="busy" class="agent-progress" role="status">{{ progress }}</p>
      </div>

      <!-- 执行记录只展示技能元数据和来源，不显示参数、原始数据或模型凭据。 -->
      <details v-if="traces.length > 0" class="agent-traces">
        <summary>执行记录（{{ traces.length }}）</summary>
        <ol>
          <li v-for="entry in traces" :key="`${entry.id}:${entry.skill}`">
            {{ entry.skill }} ·
            {{
              {
                running: '执行中',
                completed: '已完成',
                failed: '未完成',
                preview: '待确认',
                stopped: '已停止',
                uncertain: '结果待复查',
              }[entry.status]
            }}
            <small v-if="entry.source">来源：{{ entry.source }}</small>
            <small v-if="entry.count !== undefined">{{ entry.count }} 条</small>
          </li>
        </ol>
      </details>
      <button v-if="busy" class="agent-stop" type="button" @click="stop">
        停止当前任务
      </button>

      <form class="agent-compose" @submit.prevent="send">
        <textarea
          v-model="draft"
          aria-label="输入任务"
          maxlength="4000"
          placeholder="例如：分析今天的后端异常"
          rows="3"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button type="submit" :disabled="busy || !draft.trim()">发送</button>
      </form>
    </section>
  </div>
</template>

<style scoped>
/* 悬浮入口与侧栏始终留在业务布局之上，不占用页面路由。 */
.agent-host {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1100;
}
.agent-launcher {
  border: 0;
  border-radius: 999px;
  background: #2454b5;
  color: white;
  padding: 14px 18px;
  box-shadow: 0 6px 20px #0003;
  cursor: pointer;
}
.agent-panel {
  display: flex;
  flex-direction: column;
  width: min(420px, calc(100vw - 24px));
  height: min(680px, calc(100vh - 48px));
  overflow: hidden;
  border: 1px solid #d8e0ee;
  border-radius: 14px;
  background: white;
  box-shadow: 0 10px 35px #0003;
}
.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e8edf4;
}
.agent-header div {
  display: flex;
  flex-direction: column;
}
.agent-header small,
.agent-message small {
  color: #66748a;
}
.agent-header button {
  border: 0;
  background: transparent;
  color: #2454b5;
  cursor: pointer;
}
.agent-provider {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px 16px;
  font-size: 12px;
  border-bottom: 1px solid #e8edf4;
}
.agent-provider select {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px;
}
.agent-provider small {
  flex-basis: 100%;
  color: #66748a;
}
.agent-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.agent-hint {
  color: #66748a;
}
.agent-message {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f0f4f9;
  overflow-wrap: anywhere;
}
.agent-message.from-user {
  background: #e8f0ff;
}
.agent-message p {
  margin: 4px 0;
  white-space: pre-wrap;
}
.agent-speaker {
  font-size: 12px;
  font-weight: 700;
}
.agent-progress {
  color: #2454b5;
}
.agent-traces {
  max-height: 140px;
  overflow: auto;
  padding: 8px 16px;
  font-size: 12px;
  border-top: 1px solid #e8edf4;
}
.agent-traces small {
  display: block;
  color: #66748a;
}
.agent-stop {
  margin: 4px 16px;
  color: #2454b5;
  background: #f0f4f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
}
.agent-compose {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e8edf4;
}
.agent-compose textarea {
  flex: 1;
  resize: none;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px;
}
.agent-compose button {
  align-self: flex-end;
  border: 0;
  border-radius: 8px;
  background: #2454b5;
  color: white;
  padding: 9px 13px;
  cursor: pointer;
}
.agent-compose button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
@media (max-width: 480px) {
  .agent-host {
    inset: auto 0 0;
  }
  .agent-panel {
    width: 100vw;
    height: 100dvh;
    border-radius: 0;
  }
  .agent-launcher {
    position: fixed;
    right: 16px;
    bottom: 16px;
  }
}
</style>
