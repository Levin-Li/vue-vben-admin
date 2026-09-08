<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { Input, Modal } from 'ant-design-vue';
import JsonEditorVue from 'json-editor-vue';

import {
  DEFAULT_CONTENT_MODAL_BODY_STYLE,
  DEFAULT_CONTENT_MODAL_MAX_HEIGHT,
} from './config-helpers';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    inline?: boolean;
    inlineMinHeight?: string;
    modalStyle?: Record<string, any>;
    modalWidth?: number | string;
    modelValue?: any;
    title?: string;
  }>(),
  {
    disabled: false,
    inline: false,
    modalStyle: undefined,
    modelValue: undefined,
    inlineMinHeight: 'min(62vh, 640px)',
    modalWidth: 'min(80vw, 1280px)',
    title: 'JSON',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: any];
  validity: [valid: boolean];
}>();

const editorMode = 'text' as any;
const open = ref(false);
const draftValue = ref<any>({});
const jsonValid = ref(true);
watch(jsonValid, (valid) => emit('validity', valid), { immediate: true });

function cloneJsonValue(value: any) {
  if (value === undefined || value === '') {
    return {};
  }

  try {
    // Vue响应式代理不能直接structuredClone；这里按JSON值语义复制。
    // eslint-disable-next-line unicorn/prefer-structured-clone
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

const previewText = computed(() => {
  const value = props.modelValue;

  if (value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
});

const modalTitle = computed(() => `编辑${props.title}`);

function openEditor() {
  if (props.disabled) {
    return;
  }

  draftValue.value = cloneJsonValue(props.modelValue);
  jsonValid.value = true;
  open.value = true;
}

function handleOk() {
  if (!jsonValid.value) return;
  emit('update:modelValue', draftValue.value);
  open.value = false;
}

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!open.value) {
      draftValue.value = cloneJsonValue(nextValue);
    }
  },
  { immediate: true },
);

const modalBodyStyle = {
  ...DEFAULT_CONTENT_MODAL_BODY_STYLE,
  paddingTop: '12px',
};

const contentModalStyle = computed(() => ({
  maxHeight: DEFAULT_CONTENT_MODAL_MAX_HEIGHT,
  ...props.modalStyle,
}));

const editorStyle = computed(() => ({
  height: props.inline ? props.inlineMinHeight : 'min(62vh, 640px)',
  maxHeight: props.inline ? props.inlineMinHeight : 'min(62vh, 640px)',
  minHeight: props.inline ? props.inlineMinHeight : 'min(62vh, 640px)',
}));

/** onChange立即校验和传播，避免模型防抖期间保存旧值。 */
function handleJsonContentChange(content: { json?: any; text?: string }) {
  try {
    const value =
      typeof content.text === 'string'
        ? JSON.parse(content.text)
        : content.json;
    if (value === undefined) throw new Error('JSON内容不能为空');
    jsonValid.value = true;
    draftValue.value = cloneJsonValue(value);
    if (props.inline) emit('update:modelValue', draftValue.value);
  } catch {
    jsonValid.value = false;
  }
}
</script>

<template>
  <div
    v-if="inline"
    class="crud-json-editor-dialog crud-json-editor-inline"
    :style="editorStyle"
  >
    <JsonEditorVue
      v-model="draftValue"
      :debounce="0"
      :on-change="handleJsonContentChange"
      :main-menu-bar="true"
      :mode="editorMode"
      :navigation-bar="false"
      :read-only="disabled"
      :status-bar="true"
      :stringified="false"
    />
  </div>

  <div v-else class="crud-json-editor-field">
    <Input
      :disabled="disabled"
      placeholder="点击编辑 JSON"
      readonly
      :value="previewText"
      @click="openEditor"
      @keydown.enter.prevent="openEditor"
    />

    <Modal
      v-model:open="open"
      :body-style="modalBodyStyle"
      destroy-on-close
      :mask-closable="false"
      ok-text="保存"
      :ok-button-props="{ disabled: !jsonValid }"
      :style="contentModalStyle"
      :title="modalTitle"
      :width="modalWidth"
      @ok="handleOk"
    >
      <div class="crud-json-editor-dialog" :style="editorStyle">
        <JsonEditorVue
          v-model="draftValue"
          :debounce="0"
          :on-change="handleJsonContentChange"
          :main-menu-bar="true"
          :mode="editorMode"
          :navigation-bar="false"
          :status-bar="true"
          :stringified="false"
        />
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.crud-json-editor-field {
  width: 100%;
}

.crud-json-editor-field :deep(.ant-input) {
  cursor: pointer;
}

.crud-json-editor-dialog {
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.crud-json-editor-dialog :deep(.jse-main) {
  height: 100%;
  max-height: inherit;
  min-height: inherit;
}

.crud-json-editor-dialog :deep(.jse-contents) {
  height: calc(100% - 48px);
  min-height: 0;
  overflow: auto;
}

.crud-json-editor-inline :deep(.jse-contents) {
  min-height: 0;
}
</style>
