<script lang="ts" setup>
import { computed, ref } from 'vue';

import { uploadFileByFileStorageController } from '@levin/admin-framework/framework-commons/app/api/file-storage-service';
import CodeEditorField from '@levin/admin-framework/framework-commons/shared/code-editor-field.vue';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import RichTextEditorField from '@levin/admin-framework/framework-commons/shared/rich-text-editor-field.vue';
import { Button, Input, message, Upload } from 'ant-design-vue';

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

const uploading = ref(false);

// 内容类型由后端枚举返回，未选择时保持为普通文本输入，避免出现不可编辑的空白区域。
const normalizedType = computed(() => String(props.contentType || 'Text'));
const isRichText = computed(() => normalizedType.value === 'Html');
const isJson = computed(() =>
  ['AmisJsonView', 'JsonSchema'].includes(normalizedType.value),
);
const isUpload = computed(() =>
  ['Audio', 'File', 'Pic', 'Video'].includes(normalizedType.value),
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
</script>

<template>
  <div class="notice-content-field">
    <!-- 网页通知与公共 HTML 字段共用安全富文本编辑区。 -->
    <RichTextEditorField
      v-if="isRichText"
      :disabled="disabled"
      :model-value="modelValue"
      placeholder="请输入网页通知内容"
      @update:model-value="emit('update:modelValue', $event)"
    />

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
</style>
