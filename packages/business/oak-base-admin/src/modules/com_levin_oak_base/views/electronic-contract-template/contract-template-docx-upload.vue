<script lang="ts" setup>
import { ref, watch } from 'vue';

import { Alert } from 'ant-design-vue';

import { electronicContractTemplateService } from '../../api/electronic-contract-template-service';

type UploadedTemplate = {
  fileHash?: string;
  fileName: string;
  fileResId: string;
  fileUrl: string;
  mimeType: string;
};

const props = defineProps<{
  disabled?: boolean;
  formState: Record<string, any>;
}>();
const emit = defineEmits<{ update: [values: Record<string, any>] }>();
const busy = ref(false);
const error = ref('');

function clearUploadedFile() {
  const cleared: Record<string, undefined> = {};
  for (const key of [
    'fileResId',
    'fileName',
    'fileUrl',
    'fileHash',
    'mimeType',
  ]) {
    cleared[key] = undefined;
  }
  emit('update', cleared);
}

// 上传文件与模板归属必须一致；变更归属后要求重新上传。
watch(
  () => [
    props.formState.tenantId,
    props.formState.orgId,
    props.formState.ownerId,
  ],
  (_scope, previousScope) => {
    if (!previousScope || !props.formState.fileResId) return;
    clearUploadedFile();
    error.value = '归属已变更，请重新上传 Word 模板';
  },
);

// 仅接受 DOCX，使用业务上传接口返回的受控文件元数据填充新增请求。
async function uploadTemplate(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  clearUploadedFile();
  error.value = '';
  if (!/\.docx$/i.test(file.name)) {
    error.value = '请选择 .docx 模板文件';
    return;
  }

  const scope = {
    tenantId: props.formState.tenantId || undefined,
    orgId: props.formState.orgId || undefined,
    ownerId: props.formState.ownerId || undefined,
  };
  busy.value = true;
  try {
    const response = await electronicContractTemplateService.uploadTemplateDocx(
      file,
      scope,
    );
    if (
      scope.tenantId !== (props.formState.tenantId || undefined) ||
      scope.orgId !== (props.formState.orgId || undefined) ||
      scope.ownerId !== (props.formState.ownerId || undefined)
    ) {
      throw new Error('归属已变更，请重新上传 Word 模板');
    }
    const uploaded =
      response && typeof response === 'object' && 'data' in response
        ? (response.data as UploadedTemplate)
        : (response as UploadedTemplate);
    if (!uploaded?.fileResId || !uploaded.fileName || !uploaded.fileUrl) {
      throw new Error('上传未返回受控文件资源');
    }
    emit('update', uploaded);
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : '模板上传失败';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="contract-template-docx-upload">
    <input
      accept=".docx"
      aria-label="上传 Word 模板"
      :disabled="disabled || busy"
      type="file"
      @change="uploadTemplate"
    />
    <span v-if="formState.fileName">已上传：{{ formState.fileName }}</span>
    <Alert v-if="error" :message="error" show-icon type="error" />
  </div>
</template>
