<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { Alert, Radio } from 'ant-design-vue';

import { electronicContractService } from '../../api/electronic-contract-service';
import ControlledDocumentPreview from '../../components/electronic-contract/controlled-document-preview.vue';

// 固定合同文件种类，签章文件和原文保持独立，不依赖不存在的sourceFile字段。
const props = defineProps<{ contract: Record<string, any> }>();
const kind = ref<'original' | 'signed'>('original');
// 最小引用由服务端给出存在标志；管理页完整对象也可表达在线链接或本地资源。
const hasOriginal = computed(() =>
  typeof props.contract.hasOriginal === 'boolean'
    ? props.contract.hasOriginal
    : Boolean(props.contract.fileUrl || props.contract.fileResId),
);
const hasSigned = computed(() =>
  typeof props.contract.hasSigned === 'boolean'
    ? props.contract.hasSigned
    : Boolean(props.contract.signedFileUrl || props.contract.signedFileResId),
);
watch(
  () => [props.contract.id, hasOriginal.value, hasSigned.value],
  () => {
    kind.value = hasOriginal.value || !hasSigned.value ? 'original' : 'signed';
  },
  { immediate: true },
);
const documentName = computed(() =>
  String(
    (kind.value === 'signed'
      ? props.contract.signedFileName
      : props.contract.fileName) ||
      props.contract.name ||
      '合同文档',
  ),
);
const mimeType = computed(() =>
  String(
    (kind.value === 'signed'
      ? props.contract.signedFileMimeType
      : props.contract.mimeType) || '',
  ).toLowerCase(),
);
const presentation = computed(
  () =>
    mimeType.value ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    /\.pptx$/i.test(documentName.value),
);
const wordDocument = computed(
  () =>
    mimeType.value ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.docx$/i.test(documentName.value),
);
const documentKey = computed(() =>
  [
    props.contract.id,
    props.contract.optimisticLock,
    props.contract.tenantId,
    props.contract.orgId,
    kind.value,
    hasOriginal.value,
    hasSigned.value,
    documentName.value,
    mimeType.value,
  ].join(':'),
);

// 只提交业务引用和服务器版本，不使用响应中的fileUrl作为授权下载地址。
function loadDocument() {
  return electronicContractService.document({
    id: props.contract.id,
    kind: kind.value,
    representation: presentation.value ? 'pdf' : 'original',
    revision: props.contract.optimisticLock,
    ...(props.contract.tenantId ? { tenantId: props.contract.tenantId } : {}),
    ...(props.contract.orgId ? { orgId: props.contract.orgId } : {}),
  });
}
// PDF与演示文稿逐页通过受权JSON服务读取，不使用iframe或公开图片地址。
function loadDocumentPage(page: number) {
  return electronicContractService.documentPage({
    id: props.contract.id,
    kind: kind.value,
    revision: props.contract.optimisticLock,
    page,
    ...(props.contract.tenantId ? { tenantId: props.contract.tenantId } : {}),
    ...(props.contract.orgId ? { orgId: props.contract.orgId } : {}),
  });
}
</script>

<template>
  <section aria-label="合同内容">
    <Radio.Group v-model:value="kind" class="mb-3" aria-label="合同文件种类">
      <Radio.Button value="original" :disabled="!hasOriginal">
        合同原文
      </Radio.Button>
      <Radio.Button value="signed" :disabled="!hasSigned">
        已签文件
      </Radio.Button>
    </Radio.Group>
    <Alert
      v-if="!(kind === 'signed' ? hasSigned : hasOriginal)"
      type="info"
      message="当前合同未提供可预览文档，线上链接可能已失效或没有读取权限，请刷新资料后重试。"
    />
    <template v-else>
      <Alert
        v-if="presentation"
        class="mb-3"
        type="info"
        message="当前展示演示文稿转换后的分页图片，原文保持不变。"
      />
      <ControlledDocumentPreview
        :document-key="documentKey"
        :document-name="documentName"
        :load-document="loadDocument"
        :load-document-page="loadDocumentPage"
        :mode="wordDocument ? 'docx' : 'pages'"
      />
    </template>
  </section>
</template>
