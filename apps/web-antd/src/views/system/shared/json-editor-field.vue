<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { Button, Input, Modal } from 'ant-design-vue';
import JsonEditorVue from 'json-editor-vue';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modalStyle?: Record<string, any>;
    modalWidth?: number | string;
    modelValue?: any;
    title?: string;
  }>(),
  {
    disabled: false,
    modalWidth: 'min(70vw, 1280px)',
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
  paddingTop: '12px',
};

const editorStyle = computed(() => ({
  minHeight: 'min(62vh, 640px)',
}));
</script>

<template>
  <div class="crud-json-editor-field">
    <Input
      :disabled="disabled"
      placeholder="点击编辑 JSON"
      readonly
      :value="previewText"
      @click="openEditor"
    />
    <Button :disabled="disabled" @click="openEditor">编辑</Button>

    <Modal
      v-model:open="open"
      :body-style="modalBodyStyle"
      destroy-on-close
      :style="modalStyle"
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
  display: flex;
  width: 100%;
  gap: 8px;
}

.crud-json-editor-field :deep(.ant-input) {
  cursor: pointer;
}

.crud-json-editor-dialog {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.crud-json-editor-dialog :deep(.jse-main) {
  min-height: inherit;
}

.crud-json-editor-dialog :deep(.jse-contents) {
  min-height: calc(min(62vh, 640px) - 48px);
}
</style>
