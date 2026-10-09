<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import { Button } from 'ant-design-vue';

import { isSafeRichTextLink, sanitizeRichText } from './safe-rich-text';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modelValue?: string;
    placeholder?: string;
  }>(),
  {
    disabled: false,
    modelValue: '',
    placeholder: '请输入富文本内容',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editor = ref<HTMLElement>();

function updateValue() {
  const value = sanitizeRichText(editor.value?.innerHTML || '');
  if (editor.value && editor.value.innerHTML !== value) {
    editor.value.innerHTML = value;
  }
  emit('update:modelValue', value);
}

function executeCommand(command: string, value?: string) {
  if (props.disabled || !editor.value) return;
  editor.value.focus();
  document.execCommand(command, false, value);
  updateValue();
}

function createLink() {
  // 保留原通知编辑器的同步选区提示；异步弹窗会丢失当前文字选区。
  // eslint-disable-next-line no-alert
  const url = window.prompt('请输入链接地址');
  if (url && isSafeRichTextLink(url)) executeCommand('createLink', url.trim());
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') || '';
  executeCommand('insertText', text);
}

watch(
  () => props.modelValue,
  async (value) => {
    await nextTick();
    const safeValue = sanitizeRichText(value || '');
    if (editor.value && editor.value.innerHTML !== safeValue) {
      editor.value.innerHTML = safeValue;
    }
    if (value && safeValue !== value) emit('update:modelValue', safeValue);
  },
  { immediate: true },
);
</script>

<template>
  <div class="crud-rich-text-field">
    <div
      class="crud-rich-text-field__toolbar"
      role="toolbar"
      aria-label="富文本工具栏"
    >
      <Button size="small" :disabled="disabled" @click="executeCommand('bold')">
        加粗
      </Button>
      <Button
        size="small"
        :disabled="disabled"
        @click="executeCommand('italic')"
      >
        斜体
      </Button>
      <Button
        size="small"
        :disabled="disabled"
        @click="executeCommand('insertUnorderedList')"
      >
        无序列表
      </Button>
      <Button
        size="small"
        :disabled="disabled"
        @click="executeCommand('insertOrderedList')"
      >
        有序列表
      </Button>
      <Button size="small" :disabled="disabled" @click="createLink">
        链接
      </Button>
    </div>
    <div
      ref="editor"
      class="crud-rich-text-field__editor"
      :contenteditable="!disabled"
      :data-placeholder="placeholder"
      role="textbox"
      aria-multiline="true"
      @blur="updateValue"
      @input="updateValue"
      @paste="handlePaste"
    ></div>
  </div>
</template>

<style scoped>
.crud-rich-text-field {
  width: 100%;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.crud-rich-text-field__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  background: hsl(var(--muted) / 45%);
  border-bottom: 1px solid hsl(var(--border));
}

.crud-rich-text-field__editor {
  min-height: 220px;
  padding: 12px;
  overflow: auto;
  line-height: 1.7;
  outline: none;
}

.crud-rich-text-field__editor:empty::before {
  color: hsl(var(--muted-foreground));
  content: attr(data-placeholder);
}

.crud-rich-text-field__editor[contenteditable='false'] {
  cursor: not-allowed;
  background: hsl(var(--muted) / 25%);
}
</style>
