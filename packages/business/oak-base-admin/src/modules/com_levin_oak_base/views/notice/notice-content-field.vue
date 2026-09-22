<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';

import { uploadFileByFileStorageController } from '@levin/admin-framework/framework-commons/app/api/file-storage-service';
import CodeEditorField from '@levin/admin-framework/framework-commons/shared/code-editor-field.vue';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import { Button, Input, Upload, message } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    contentType?: string;
    disabled?: boolean;
    modelValue?: string;
  }>(),
  {
    contentType: 'Text',
    disabled: false,
    modelValue: '',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const richTextEditor = ref<HTMLElement>();
const uploading = ref(false);

// 内容类型由后端枚举返回，未选择时保持为普通文本输入，避免出现不可编辑的空白区域。
const normalizedType = computed(() => String(props.contentType || 'Text'));
const isRichText = computed(() => normalizedType.value === 'Html');
const isJson = computed(() =>
  ['AmisJsonView', 'JsonSchema'].includes(normalizedType.value),
);
const isUpload = computed(() =>
  ['Pic', 'Video', 'Audio', 'File'].includes(normalizedType.value),
);
const isImage = computed(() => normalizedType.value === 'Pic');
const uploadLabel = computed(() => {
  const labels: Record<string, string> = {
    Audio: '音频',
    File: '文件',
    Pic: '图片',
    Video: '视频',
  };
  return labels[normalizedType.value] || '文件';
});
const uploadAccept = computed(() => (isImage.value ? 'image/*' : undefined));
const uploadFileList = computed(() => {
  const url = String(props.modelValue || '').trim();
  if (!url) return [];
  return [
    {
      name: url.split('/').pop() || uploadLabel.value,
      status: 'done' as const,
      uid: `notice-content-${url}`,
      url,
    },
  ];
});

// 富文本仅保留展示所需标签和安全属性，避免编辑器本身成为脚本执行入口。
function sanitizeRichText(value: string) {
  const documentNode = new DOMParser().parseFromString(value, 'text/html');
  const allowedTags = new Set([
    'a',
    'blockquote',
    'br',
    'code',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'li',
    'ol',
    'p',
    'pre',
    'span',
    'strong',
    'ul',
  ]);

  // 先删除不允许的元素，再限制链接协议与可保留属性。
  documentNode.body.querySelectorAll('*').forEach((element) => {
    if (!allowedTags.has(element.tagName.toLowerCase())) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const isSafeLink =
        element.tagName.toLowerCase() === 'a' &&
        name === 'href' &&
        /^(https?:|mailto:|#|\/)/i.test(attribute.value.trim());
      if (name !== 'class' && !isSafeLink) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return documentNode.body.innerHTML;
}

// 工具栏只修改当前编辑选区，随后统一从编辑区域取值，保证表单状态与所见内容一致。
function executeRichTextCommand(command: string, value?: string) {
  if (props.disabled || !richTextEditor.value) return;
  richTextEditor.value.focus();
  document.execCommand(command, false, value);
  updateRichTextValue();
}

function createLink() {
  const url = window.prompt('请输入链接地址');
  if (url && /^(https?:|mailto:|#|\/)/i.test(url.trim())) {
    executeRichTextCommand('createLink', url.trim());
  }
}

function updateRichTextValue() {
  const value = sanitizeRichText(richTextEditor.value?.innerHTML || '');
  if (richTextEditor.value && richTextEditor.value.innerHTML !== value) {
    richTextEditor.value.innerHTML = value;
  }
  emit('update:modelValue', value);
}

function handleRichTextPaste(event: ClipboardEvent) {
  // 粘贴为纯文本，既保留内容又避免外部网页携带样式、事件或脚本进入编辑区。
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') || '';
  executeRichTextCommand('insertText', text);
}

async function uploadNoticeContent(options: any) {
  const file = options.file as File;
  if (!file) return;

  // 上传统一走文件存储服务，服务端返回的地址才允许写回通知内容。
  uploading.value = true;
  try {
    const url = await uploadFileByFileStorageController(file);
    emit('update:modelValue', url);
    options.onSuccess?.(url);
    message.success(`${uploadLabel.value}上传成功`);
  } catch (error) {
    console.error(error);
    options.onError?.(error);
    message.error(`${uploadLabel.value}上传失败`);
  } finally {
    uploading.value = false;
  }
}

function removeNoticeContent() {
  emit('update:modelValue', '');
  return true;
}

// 外部加载编辑记录或切换记录时同步富文本画布；类型切换不改变表单值，避免误操作丢失内容。
watch(
  () => [props.modelValue, isRichText.value] as const,
  async ([value, richText]) => {
    if (!richText) return;
    await nextTick();
    if (richTextEditor.value) {
      const sanitizedValue = sanitizeRichText(value || '');
      if (richTextEditor.value.innerHTML !== sanitizedValue) {
        richTextEditor.value.innerHTML = sanitizedValue;
      }
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="notice-content-field">
    <!-- 网页通知使用所见即所得编辑，保存 HTML 由接收端的 sandbox iframe 隔离展示。 -->
    <div v-if="isRichText" class="notice-content-field__rich-text">
      <div
        class="notice-content-field__toolbar"
        role="toolbar"
        aria-label="富文本工具栏"
      >
        <Button
          size="small"
          :disabled="disabled"
          @click="executeRichTextCommand('bold')"
          >加粗</Button
        >
        <Button
          size="small"
          :disabled="disabled"
          @click="executeRichTextCommand('italic')"
          >斜体</Button
        >
        <Button
          size="small"
          :disabled="disabled"
          @click="executeRichTextCommand('insertUnorderedList')"
          >无序列表</Button
        >
        <Button
          size="small"
          :disabled="disabled"
          @click="executeRichTextCommand('insertOrderedList')"
          >有序列表</Button
        >
        <Button size="small" :disabled="disabled" @click="createLink"
          >链接</Button
        >
      </div>
      <div
        ref="richTextEditor"
        class="notice-content-field__editor"
        :contenteditable="!disabled"
        data-placeholder="请输入网页通知内容"
        role="textbox"
        aria-multiline="true"
        @blur="updateRichTextValue"
        @input="updateRichTextValue"
        @paste="handleRichTextPaste"
      ></div>
    </div>

    <!-- JSON 类内容使用结构化编辑器，保留格式校验和可读的缩进编辑体验。 -->
    <JsonEditorField
      v-else-if="isJson"
      inline
      :disabled="disabled"
      :model-value="modelValue"
      title="通知内容"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <!-- 图片、音视频和附件共用文件存储上传，图片额外限制为图片文件并支持预览。 -->
    <Upload
      v-else-if="isUpload"
      :accept="uploadAccept"
      :custom-request="uploadNoticeContent"
      :disabled="disabled"
      :file-list="uploadFileList"
      :list-type="isImage ? 'picture-card' : 'text'"
      :max-count="1"
      :show-upload-list="true"
      @remove="removeNoticeContent"
    >
      <Button v-if="!modelValue" :disabled="disabled" :loading="uploading">
        上传{{ uploadLabel }}
      </Button>
    </Upload>

    <!-- Markdown 保持源码输入；普通文本保留多行文本输入。 -->
    <CodeEditorField
      v-else-if="normalizedType === 'Markdown'"
      inline
      :disabled="disabled"
      language="markdown"
      :model-value="modelValue"
      title="通知内容"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <Input.TextArea
      v-else
      :auto-size="{ minRows: 6, maxRows: 16 }"
      :disabled="disabled"
      :value="modelValue"
      placeholder="请输入通知内容"
      @update:value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.notice-content-field {
  width: 100%;
}

.notice-content-field__rich-text {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.notice-content-field__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  background: hsl(var(--muted) / 45%);
  border-bottom: 1px solid hsl(var(--border));
}

.notice-content-field__editor {
  min-height: 220px;
  padding: 12px;
  overflow: auto;
  line-height: 1.7;
  outline: none;
}

.notice-content-field__editor:empty::before {
  color: hsl(var(--muted-foreground));
  content: attr(data-placeholder);
}

.notice-content-field__editor[contenteditable='false'] {
  cursor: not-allowed;
  background: hsl(var(--muted) / 25%);
}
</style>
