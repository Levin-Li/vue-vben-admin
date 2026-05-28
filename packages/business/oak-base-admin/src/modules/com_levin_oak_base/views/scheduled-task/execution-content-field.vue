<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import CodeEditorField from '@levin/admin-framework/framework-commons/shared/code-editor-field.vue';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Tabs,
  message,
} from 'ant-design-vue';

import { scheduledTaskService } from '../../api/scheduled-task-service';

interface CandidateOption {
  className?: string;
  label: string;
  value: string;
}

const props = defineProps<{
  disabled?: boolean;
  editingRecord?: Record<string, any> | null;
  executionContentType?: string;
  groovyAllowed?: boolean;
  modelValue?: string;
  task?: Record<string, any>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const options = ref<CandidateOption[]>([]);
const loading = ref(false);
const loadError = ref('');
const groovyEditorOpen = ref(false);
const groovyEditorTab = ref('code');
const groovyDraftValue = ref('');
const groovyDebugLoading = ref(false);
const groovyDebugParamsText = ref('{}');
const groovyDebugResult = ref('');
const groovyDebugTab = ref('input');
const groovyDebugTimeoutSeconds = ref<number>();

const normalizedType = computed(() => String(props.executionContentType || ''));
const isGroovy = computed(() => normalizedType.value === 'GroovyScript');
const canEditGroovy = computed(() => !isGroovy.value || props.groovyAllowed === true);
const isSpringBean = computed(
  () =>
    normalizedType.value === 'SpringBeanName' ||
    normalizedType.value === 'SpringBeanClassName',
);
const taskId = computed(() => props.task?.id || props.editingRecord?.id);

const placeholder = computed(() => {
  if (normalizedType.value === 'SpringBeanName') {
    return '请选择 Spring Bean 名称';
  }
  if (normalizedType.value === 'SpringBeanClassName') {
    return '请选择 Spring Bean 类名';
  }
  if (isGroovy.value) {
    return canEditGroovy.value ? '点击编辑 Groovy 脚本' : '只有超级管理员可以编辑 Groovy 脚本';
  }
  return '请先选择执行内容类型';
});

const helpText = computed(() => {
  if (isGroovy.value) {
    if (!canEditGroovy.value) {
      return 'Groovy 属于可执行代码，只有超级管理员可以编辑、修改和调试。';
    }
    return '可用变量：_ctx、_task、_runParams、_spring。在线调试只执行服务端已保存脚本，不携带当前未保存代码。';
  }
  if (isSpringBean.value) {
    return '候选项已按 Callable、Runnable、Function、Consumer 或 execute(context) 方法过滤。';
  }
  return '';
});
const groovyPreviewText = computed(() => {
  const value = String(props.modelValue || '').trim();
  if (!value) {
    return '';
  }
  const firstLine = value.split(/\r?\n/)[0] || '';
  return value.includes('\n') ? `${firstLine} ...` : firstLine;
});
const groovyVariableGroups = [
  {
    items: [
      '_ctx',
      '_ctx.cycleId',
      '_ctx.schedulerType',
      '_ctx.scheduledExecutionTime',
      '_ctx.actualExecutionTime',
      '_ctx.retryIndex',
    ],
    title: '调度上下文',
  },
  {
    items: ['_task', '_task.id', '_task.name', '_runParams'],
    title: '任务与参数',
  },
  {
    items: [
      "_spring.get('beanName')",
      '_spring.byTypeName("className")',
      '_spring.names()',
    ],
    title: 'Spring 容器',
  },
];
const groovyHelpSections = [
  {
    items: [
      '可以直接返回执行结果，也可以在脚本中访问上下文变量完成业务处理。',
      '脚本在服务端调度执行时运行，保存后会随定时任务配置一起生效。',
      '执行异常、超时、重试和触发结果会记录到调度任务日志。',
    ],
    title: '脚本约定',
  },
  {
    items: [
      '_ctx：当前调度执行上下文。',
      '_task：当前定时任务配置。',
      '_runParams：单次触发或调度传入的运行参数。',
      '_spring：Spring Bean 访问器，可通过 _spring.get("beanName") 或 _spring.byTypeName("className") 获取 Bean。',
      '脚本运行时只注入下划线变量，不再注入历史别名。',
    ],
    title: '可用变量',
  },
];
const groovyHelpExample = `def cycleId = _ctx?.cycleId
def params = _runParams ?: [:]

return [
  success: true,
  cycleId: cycleId,
  taskId: _task?.id,
  params: params
]`;

function toPrettyJson(value: any) {
  return JSON.stringify(value ?? {}, null, 2);
}

function normalizeCandidates(response: any): CandidateOption[] {
  const payload = response?.data ?? response;
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.resultList)
        ? payload.resultList
        : [];

  return items
    .map((item: any) => ({
      className: String(item?.className || ''),
      label: String(item?.label || item?.value || ''),
      value: String(item?.value || ''),
    }))
    .filter((item: CandidateOption) => item.value && item.label);
}

function filterOption(input: string, option?: CandidateOption) {
  const keyword = String(input || '').toLowerCase();
  const label = String(option?.label || '').toLowerCase();
  const value = String(option?.value || '').toLowerCase();
  const className = String(option?.className || '').toLowerCase();
  return (
    label.includes(keyword) ||
    value.includes(keyword) ||
    className.includes(keyword)
  );
}

function openGroovyEditor() {
  if (props.disabled || !canEditGroovy.value) {
    return;
  }
  groovyDraftValue.value = props.modelValue || '';
  groovyDebugParamsText.value = toPrettyJson(props.task?.runParams || {});
  groovyDebugTimeoutSeconds.value =
    props.task?.timeoutSeconds == null ? undefined : Number(props.task.timeoutSeconds);
  groovyEditorTab.value = 'code';
  groovyDebugTab.value = 'input';
  groovyEditorOpen.value = true;
}

function closeGroovyEditor() {
  groovyEditorOpen.value = false;
}

function submitGroovyEditor() {
  emit('update:modelValue', groovyDraftValue.value);
  groovyEditorOpen.value = false;
}

function normalizeResponsePayload(response: any) {
  return response?.data ?? response;
}

async function runGroovyDebug() {
  if (!taskId.value) {
    message.warning('新增任务保存后才能在线调试');
    return;
  }
  if (!String(groovyDraftValue.value || '').trim()) {
    message.warning('请先填写 Groovy 脚本');
    return;
  }

  let runParams: Record<string, any>;
  try {
    runParams = JSON.parse(groovyDebugParamsText.value || '{}');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    groovyDebugResult.value = toPrettyJson({
      success: false,
      message: `调试参数JSON格式不正确：${reason}`,
    });
    groovyDebugTab.value = 'result';
    message.error(`调试参数JSON格式不正确：${reason}`);
    return;
  }

  groovyDebugLoading.value = true;
  try {
    const response = await scheduledTaskService.debugGroovy({
      id: taskId.value,
      runParams,
      timeoutSeconds:
        groovyDebugTimeoutSeconds.value == null
          ? props.task?.timeoutSeconds
          : groovyDebugTimeoutSeconds.value,
    });
    const result = normalizeResponsePayload(response);
    groovyDebugResult.value = toPrettyJson(result);
    groovyDebugTab.value = 'result';

    if (result?.success === false) {
      message.warning('Groovy 调试执行失败');
    } else {
      message.success('Groovy 调试执行完成');
    }
  } catch (error: any) {
    console.error(error);
    groovyDebugResult.value = toPrettyJson(
      normalizeResponsePayload(error) || {
        success: false,
        message: error?.message || 'Groovy 调试执行失败',
      },
    );
    groovyDebugTab.value = 'result';
    message.error(error?.message || 'Groovy 调试执行失败');
  } finally {
    groovyDebugLoading.value = false;
  }
}

async function loadCandidates(type: string) {
  if (type !== 'SpringBeanName' && type !== 'SpringBeanClassName') {
    options.value = [];
    return;
  }

  loading.value = true;
  loadError.value = '';

  try {
    const response = await scheduledTaskService.executionContentCandidates({
      executionContentType: type,
    });
    options.value = normalizeCandidates(response);
  } catch (error: any) {
    console.error(error);
    loadError.value = error?.message || '执行内容候选项加载失败';
    options.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  normalizedType,
  (type, oldType) => {
    if (oldType && type !== oldType) {
      emit('update:modelValue', '');
    }
    loadCandidates(type);
  },
  { immediate: true },
);

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!groovyEditorOpen.value) {
      groovyDraftValue.value = nextValue || '';
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="scheduled-task-execution-content-field">
    <template v-if="isGroovy">
      <Input
        class="scheduled-task-groovy-launcher"
        :disabled="disabled || !canEditGroovy"
        :placeholder="placeholder"
        readonly
        :value="groovyPreviewText"
        @click="openGroovyEditor"
      />

      <Modal
        :body-style="{ maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }"
        destroy-on-close
        :open="groovyEditorOpen"
        ok-text="保存"
        title="编辑 Groovy 脚本"
        width="min(86vw, 1480px)"
        @cancel="closeGroovyEditor"
        @ok="submitGroovyEditor"
      >
        <div class="scheduled-task-script-workbench">
          <aside class="scheduled-task-script-variable-panel">
            <div
              v-for="group in groovyVariableGroups"
              :key="group.title"
              class="scheduled-task-script-variable-group"
            >
              <div class="scheduled-task-script-variable-title">
                {{ group.title }}
              </div>
              <code
                v-for="item in group.items"
                :key="item"
                class="scheduled-task-script-variable-item"
              >
                {{ item }}
              </code>
            </div>
          </aside>

          <section class="scheduled-task-script-editor-panel">
            <Tabs
              v-model:active-key="groovyEditorTab"
              class="scheduled-task-script-editor-tabs"
              size="small"
            >
              <Tabs.TabPane key="code" tab="代码">
                <CodeEditorField
                  v-model="groovyDraftValue"
                  inline
                  language="groovy"
                  title="Groovy 脚本"
                />
              </Tabs.TabPane>
              <Tabs.TabPane key="debug" tab="调试">
                <section class="scheduled-task-script-debug-panel">
                  <Space class="mb-3 w-full" :size="8">
                    <InputNumber
                      v-model:value="groovyDebugTimeoutSeconds"
                      class="scheduled-task-debug-timeout"
                      :min="1"
                      placeholder="超时秒"
                    />
                    <Button
                      :disabled="!taskId"
                      :loading="groovyDebugLoading"
                      type="primary"
                      @click="runGroovyDebug"
                    >
                      运行调试
                    </Button>
                  </Space>
                  <div class="scheduled-task-script-debug-tip">
                    在线调试只引用服务端已保存脚本，不会携带当前未保存代码；新增任务请先保存后再调试。
                  </div>

                  <Tabs v-model:active-key="groovyDebugTab" size="small">
                    <Tabs.TabPane key="input" tab="调试输入">
                      <div class="scheduled-task-script-test-label">
                        运行参数 _runParams JSON
                      </div>
                      <Input.TextArea
                        v-model:value="groovyDebugParamsText"
                        class="scheduled-task-script-test-textarea"
                        :auto-size="{ minRows: 6, maxRows: 12 }"
                      />
                    </Tabs.TabPane>
                    <Tabs.TabPane key="result" tab="控制台输出">
                      <pre class="scheduled-task-script-test-result">{{
                        groovyDebugResult || '暂无控制台输出'
                      }}</pre>
                    </Tabs.TabPane>
                  </Tabs>
                </section>
              </Tabs.TabPane>
              <Tabs.TabPane key="help" tab="帮助">
                <div class="scheduled-task-script-help">
                  <section
                    v-for="section in groovyHelpSections"
                    :key="section.title"
                    class="scheduled-task-script-help-section"
                  >
                    <h4>{{ section.title }}</h4>
                    <ul>
                      <li v-for="item in section.items" :key="item">
                        {{ item }}
                      </li>
                    </ul>
                  </section>
                  <section class="scheduled-task-script-help-section">
                    <h4>示例</h4>
                    <pre class="scheduled-task-script-help-code">{{ groovyHelpExample }}</pre>
                  </section>
                </div>
              </Tabs.TabPane>
            </Tabs>
          </section>
        </div>
      </Modal>
    </template>

    <Spin v-else-if="isSpringBean" :spinning="loading">
      <Select
        :allow-clear="true"
        class="w-full"
        :disabled="disabled"
        :filter-option="filterOption"
        :loading="loading"
        :not-found-content="loading ? '加载中...' : undefined"
        :options="options"
        :placeholder="placeholder"
        show-search
        :value="modelValue || undefined"
        @update:value="emit('update:modelValue', String($event || ''))"
      />
    </Spin>

    <Alert
      v-else
      :message="helpText || placeholder"
      show-icon
      type="warning"
    />

    <div v-if="helpText" class="execution-content-help">
      {{ helpText }}
    </div>
    <Alert v-if="loadError" :message="loadError" show-icon type="error" />
  </div>
</template>

<style scoped>
.scheduled-task-execution-content-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.execution-content-help {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 1.6;
}

.scheduled-task-groovy-launcher :deep(.ant-input[readonly]),
.scheduled-task-groovy-launcher[readonly] {
  cursor: pointer;
}

.scheduled-task-script-workbench {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
}

.scheduled-task-script-variable-panel,
.scheduled-task-script-editor-panel {
  min-width: 0;
}

.scheduled-task-script-variable-panel {
  max-height: min(70vh, 760px);
  padding-right: 12px;
  overflow: auto;
  border-right: 1px solid hsl(var(--border));
}

.scheduled-task-script-variable-group + .scheduled-task-script-variable-group {
  margin-top: 14px;
}

.scheduled-task-script-variable-title {
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
}

.scheduled-task-script-variable-item {
  display: block;
  padding: 5px 8px;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.scheduled-task-script-variable-item + .scheduled-task-script-variable-item {
  margin-top: 6px;
}

.scheduled-task-script-editor-panel {
  min-height: 360px;
}

.scheduled-task-script-editor-tabs {
  min-width: 0;
}

.scheduled-task-script-help {
  max-height: min(62vh, 680px);
  padding: 4px 6px 12px;
  overflow: auto;
}

.scheduled-task-script-help-section + .scheduled-task-script-help-section {
  margin-top: 16px;
}

.scheduled-task-script-help-section h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.scheduled-task-script-help-section ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 1.6;
}

.scheduled-task-script-help-code {
  max-height: 260px;
  padding: 12px;
  overflow: auto;
  color: hsl(var(--foreground));
  font-size: 12px;
  line-height: 1.55;
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.scheduled-task-script-debug-panel {
  min-width: 0;
  max-height: min(62vh, 680px);
  overflow: auto;
}

.scheduled-task-debug-timeout {
  width: 140px;
}

.scheduled-task-script-test-label {
  margin-bottom: 6px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
}

.scheduled-task-script-debug-tip {
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.6;
}

.scheduled-task-script-test-textarea {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}

.scheduled-task-script-test-result {
  min-height: 180px;
  max-height: 360px;
  padding: 12px;
  overflow: auto;
  color: hsl(var(--foreground));
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}
</style>
