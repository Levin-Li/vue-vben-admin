<script lang="ts" setup>
import { ref, watch } from 'vue';

import { Alert, Button } from 'ant-design-vue';

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
const fileInput = ref<HTMLInputElement>();

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

function uploadErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : '';
  if (message.includes('缺少身份或归属范围')) {
    return '请先选择使用租户和使用组织，再上传 Word 文件';
  }
  if (message.includes('上传者与文件归属不匹配')) {
    return '当前账号无权为所选组织上传，请重新选择使用范围';
  }
  return message || 'Word 文件上传失败';
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
    error.value = '使用范围已变更，请重新上传 Word 文件';
  },
);

// 仅接受 DOCX，使用业务上传接口返回的受控文件元数据填充新增请求。
async function uploadTemplate(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';
  clearUploadedFile();
  error.value = '';
  if (!/\.docx$/i.test(file.name)) {
    error.value = '请选择 Word 的 .docx 文件';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    error.value = 'Word 文件不能超过 8 MB';
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
      throw new Error('使用范围已变更，请重新上传 Word 文件');
    }
    const uploaded =
      response && typeof response === 'object' && 'data' in response
        ? (response.data as UploadedTemplate)
        : (response as UploadedTemplate);
    if (!uploaded?.fileResId || !uploaded.fileName || !uploaded.fileUrl) {
      throw new Error('上传未返回受控文件资源');
    }
    // 上传控件临时保存完整结果；提交转换再拆成后端需要的字符串字段。
    emit('update', { ...uploaded, fileResId: uploaded });
  } catch (error_) {
    error.value = uploadErrorMessage(error_);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div
    class="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4"
  >
    <!-- 用户只需要选 Word 文件；资源 ID、路径和哈希由受控上传自动写入表单。 -->
    <p class="text-sm text-slate-700">上传已写好的合同，文件信息由系统保存。</p>
    <input
      ref="fileInput"
      accept=".docx"
      aria-label="上传 Word 模板"
      class="sr-only"
      :disabled="disabled || busy"
      type="file"
      @change="uploadTemplate"
    />
    <Button :disabled="disabled || busy" @click="fileInput?.click()">
      {{
        busy
          ? '上传中…'
          : formState.fileName
            ? '更换 Word 文件'
            : '选择 Word 文件'
      }}
    </Button>
    <span class="ml-3 text-sm text-slate-500">仅支持 .docx，最大 8 MB</span>
    <Alert
      v-if="formState.fileName && !error"
      :message="`已上传：${formState.fileName}`"
      show-icon
      type="success"
    />
    <Alert v-if="error" :message="error" show-icon type="error" />
  </div>
</template>
