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
    inlineMinHeight: 'min(62vh, 640px)',
    modalWidth: 'min(80vw, 1280px)',
    title: 'JSON',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const editorMode = 'text' as any;
const open = ref(false);
const draftValue = ref<any>({});

function cloneJsonValue(value: any) {
  if (value === undefined || value === null || value === '') {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

const previewText = computed(() => {
  const value = props.modelValue;

  if (value === undefined || value === null || value === '') {
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
  open.value = true;
}

function handleOk() {
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
  ...(props.modalStyle || {}),
}));

const editorStyle = computed(() => ({
  height: props.inline ? props.inlineMinHeight : 'min(62vh, 640px)',
  maxHeight: props.inline ? props.inlineMinHeight : 'min(62vh, 640px)',
  minHeight: props.inline ? props.inlineMinHeight : 'min(62vh, 640px)',
}));

watch(
  draftValue,
  (nextValue) => {
    if (props.inline) {
      emit('update:modelValue', nextValue);
    }
  },
  { deep: true },
);
</script>

<template>
  <div
    v-if="inline"
    class="crud-json-editor-dialog crud-json-editor-inline"
    :style="editorStyle"
  >
    <JsonEditorVue
      v-model="draftValue"
      :debounce="300"
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
      :style="contentModalStyle"
      :title="modalTitle"
      :width="modalWidth"
      @ok="handleOk"
    >
      <div class="crud-json-editor-dialog" :style="editorStyle">
        <JsonEditorVue
          v-model="draftValue"
          :debounce="300"
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
