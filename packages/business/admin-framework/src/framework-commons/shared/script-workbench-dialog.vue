<script lang="ts" setup>
import { Button, Input, Modal, Tag } from 'ant-design-vue';
import { computed, reactive, ref, watch } from 'vue';

import JavaScriptCodeEditor from './javascript-code-editor.vue';
import { evaluateJavaScriptExpression } from './javascript-expression';

export interface ScriptWorkbenchVariable {
  defaultValue?: any;
  label?: string;
  name: string;
  type?: 'boolean' | 'json' | 'number' | 'text';
}

export interface ScriptWorkbenchVariableGroup {
  label: string;
  variables: ScriptWorkbenchVariable[];
}

const props = withDefaults(defineProps<{
  modelValue?: string;
  open?: boolean;
  title?: string;
  variableGroups: ScriptWorkbenchVariableGroup[];
}>(), { modelValue: '', open: false, title: '脚本工作台' });

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:open': [value: boolean];
  test: [payload: { script: string; variables: Record<string, any> }];
}>();

const editor = ref<InstanceType<typeof JavaScriptCodeEditor>>();
const script = ref('');
const search = ref('');
const testValues = reactive<Record<string, string>>({});
const result = ref('');
const error = ref('');
const modalBodyStyle = {
  height: 'calc(80vh - 140px)',
  overflow: 'hidden',
};
const workbenchPaneHeight = 'calc(80vh - 188px)';
const sidebarPaneStyle = {
  flex: '0 0 30%',
  height: workbenchPaneHeight,
  minWidth: '400px',
};
const editorPaneStyle = {
  height: `calc((${workbenchPaneHeight}) * 0.7)`,
};
const outputPaneStyle = {
  height: `calc((${workbenchPaneHeight}) * 0.3)`,
};
const variableRowStyle = {
  gridTemplateColumns: 'minmax(0, 1fr) 220px',
};

const filteredGroups = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return props.variableGroups;
  return props.variableGroups.map((group) => ({
    ...group,
    variables: group.variables.filter((variable) =>
      `${variable.label || variable.name} ${variable.name}`.toLowerCase().includes(keyword),
    ),
  })).filter((group) => group.variables.length > 0);
});

function variableLabel(variable: ScriptWorkbenchVariable) {
  return variable.label || variable.name;
}

function insertVariable(variable: ScriptWorkbenchVariable) {
  editor.value?.insertText(variable.name);
}

function resetTestValues() {
  for (const group of props.variableGroups) {
    for (const variable of group.variables) {
      testValues[variable.name] = variable.defaultValue == null
        ? ''
        : typeof variable.defaultValue === 'string'
          ? variable.defaultValue
          : JSON.stringify(variable.defaultValue);
    }
  }
}

function clearTestValues() {
  for (const variable of Object.keys(testValues)) {
    testValues[variable] = '';
  }
  result.value = '';
  error.value = '';
}

function buildTestValues() {
  return Object.fromEntries(Object.entries(testValues).map(([key, value]) => {
    try { return [key, JSON.parse(value)]; } catch { return [key, value]; }
  }));
}

function buildTestContext() {
  const context: Record<string, any> = {};
  for (const [path, value] of Object.entries(buildTestValues())) {
    const parts = path.split('.');
    let target = context;
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    target[parts.at(-1)!] = value;
  }
  return context;
}

function runTest() {
  result.value = '';
  error.value = '';
  try {
    const variables = buildTestValues();
    const value = evaluateJavaScriptExpression(script.value, buildTestContext());
    result.value = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    emit('test', { script: script.value, variables });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

function close() { emit('update:open', false); }
function save() { emit('update:modelValue', script.value); close(); }

watch(() => props.open, (open) => {
  if (open) { script.value = props.modelValue || ''; resetTestValues(); result.value = ''; error.value = ''; }
});

defineExpose({ setTestError: (value: string) => error.value = value, setTestResult: (value: any) => result.value = typeof value === 'string' ? value : JSON.stringify(value, null, 2) });
</script>

<template>
  <Modal
    :open="open"
    :title="`${title} - 编辑`"
    :width="'80vw'"
    :style="{ top: '10vh' }"
    :body-style="modalBodyStyle"
    :mask-closable="false"
    wrap-class-name="script-workbench-dialog"
    @cancel="close"
    @ok="save"
  >
    <div class="flex h-full min-h-0 w-full gap-4">
      <aside class="flex min-h-0 flex-col rounded border border-border p-3" :style="sidebarPaneStyle">
        <div class="min-h-0 flex-1 overflow-auto">
          <Input v-model:value="search" placeholder="搜索变量" class="mb-3" />
          <section v-for="group in filteredGroups" :key="group.label" class="mb-4">
            <h4 class="mb-2 text-sm font-medium">{{ group.label }}</h4>
            <div
              v-for="variable in group.variables"
              :key="variable.name"
              class="mb-1 grid gap-2"
              :style="variableRowStyle"
            >
              <Button class="min-w-0 text-left" @click="insertVariable(variable)">
                <span class="truncate">{{ variableLabel(variable) }}</span>
                <Tag class="ml-2" :title="variable.name">{{ variable.name }}</Tag>
              </Button>
              <Input v-model:value="testValues[variable.name]" :placeholder="variable.type === 'json' ? '输入 JSON 测试值' : '输入测试值'" />
            </div>
          </section>
        </div>
        <div class="mt-3 flex justify-end gap-2 border-t border-border pt-3">
          <Button @click="clearTestValues">清空</Button>
          <Button type="primary" @click="runTest">运行测试</Button>
        </div>
      </aside>
      <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden" :style="{ height: workbenchPaneHeight }">
        <div class="min-h-0 overflow-hidden" :style="editorPaneStyle">
          <JavaScriptCodeEditor ref="editor" v-model="script" class="h-full w-full" />
        </div>
        <section
          aria-label="运行输出控制台"
          aria-live="polite"
          class="min-h-0 overflow-auto rounded border border-border bg-muted px-3 py-2 font-mono text-sm"
          :style="outputPaneStyle"
        >
          <div v-if="!result && !error" class="text-muted-foreground">运行测试后将在此显示结果或错误信息。</div>
          <pre v-if="result" class="m-0 whitespace-pre-wrap text-green-600 dark:text-green-400">{{ result }}</pre>
          <pre v-if="error" class="m-0 whitespace-pre-wrap text-red-600 dark:text-red-400">{{ error }}</pre>
        </section>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
:global(.script-workbench-dialog .ant-modal) {
  max-width: 80vw;
  width: min(80vw, 1600px) !important;
}

:global(.script-workbench-dialog .ant-modal-content) {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  overflow: hidden;
}

:global(.script-workbench-dialog .ant-modal-body) {
  flex: 1;
  min-height: 0;
}
</style>
