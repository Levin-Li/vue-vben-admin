<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { Button, Input, Modal } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    language?: string;
    modalStyle?: Record<string, any>;
    modalWidth?: number | string;
    modelValue?: string;
    title?: string;
  }>(),
  {
    disabled: false,
    language: 'text',
    modalWidth: 'min(70vw, 1280px)',
    title: '内容',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const open = ref(false);
const draftValue = ref('');

const previewText = computed(() => props.modelValue || '');
const modalTitle = computed(() => `编辑${props.title}`);
const editorClass = computed(() => ({
  'font-mono': props.language !== 'rich-text',
}));

function openEditor() {
  if (props.disabled) {
    return;
  }

  draftValue.value = props.modelValue || '';
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
      draftValue.value = nextValue || '';
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="crud-code-editor-field">
    <Input
      :disabled="disabled"
      placeholder="点击编辑内容"
      readonly
      :value="previewText"
      @click="openEditor"
    />
    <Button :disabled="disabled" @click="openEditor">编辑</Button>

    <Modal
      v-model:open="open"
      destroy-on-close
      :style="modalStyle"
      :title="modalTitle"
      :width="modalWidth"
      @ok="handleOk"
    >
      <Input.TextArea
        v-model:value="draftValue"
        :auto-size="{ minRows: 18, maxRows: 28 }"
        :class="editorClass"
      />
    </Modal>
  </div>
</template>

<style scoped>
.crud-code-editor-field {
  display: flex;
  width: 100%;
  gap: 8px;
}

.crud-code-editor-field :deep(.ant-input[readonly]) {
  cursor: pointer;
}
</style>
