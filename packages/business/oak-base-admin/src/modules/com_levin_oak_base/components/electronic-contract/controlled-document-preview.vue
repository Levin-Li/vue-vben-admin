<script lang="ts" setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { Alert, Button, Spin } from 'ant-design-vue';

import ContractDocumentPreview from './contract-document-preview.vue';
import { documentPageSource } from './controlled-document-page';

// DOCX使用本地渲染；PDF/PPTX仅接受受控分页PNG，不依赖浏览器PDF插件。
const props = withDefaults(
  defineProps<{
    documentKey: string;
    documentName: string;
    loadDocument?: () => Promise<Blob>;
    loadDocumentPage?: (page: number) => Promise<unknown>;
    mode?: 'docx' | 'pages';
  }>(),
  { mode: 'docx', loadDocument: undefined, loadDocumentPage: undefined },
);
const blob = shallowRef<Blob>();
const imageSource = ref('');
const displayedVersion = ref(0);
const currentPage = ref(1);
const pageCount = ref(0);
const pageStatus = computed(
  () => `第 ${currentPage.value} / ${pageCount.value || '—'} 页`,
);
const error = ref('');
const loading = ref(false);
let requestVersion = 0;

function clearContent() {
  blob.value = undefined;
  imageSource.value = '';
}

// 切页立即隐藏旧内容；引用/修订变化或卸载均令旧响应失效。
async function loadPage(page: number) {
  const current = ++requestVersion;
  currentPage.value = page;
  clearContent();
  error.value = '';
  loading.value = true;
  try {
    // 同一批props更新后再读取回调，避免同步watch调用到上一记录的loader。
    await nextTick();
    if (current !== requestVersion) return;
    if (props.mode === 'pages') {
      if (!props.loadDocumentPage) throw new Error('受控分页预览未配置。');
      const result = await props.loadDocumentPage(page);
      if (current !== requestVersion) return;
      const rendered = documentPageSource(result, page);
      pageCount.value = rendered.pageCount;
      displayedVersion.value = current;
      imageSource.value = rendered.source;
    } else {
      if (!props.loadDocument) throw new Error('受控Word预览未配置。');
      const result = await props.loadDocument();
      if (current !== requestVersion) return;
      if (
        !(result instanceof Blob) ||
        result.size === 0 ||
        result.size > 20 * 1024 * 1024
      )
        throw new Error('文档为空或超过20MB预览上限。');
      if (
        result.type.split(';')[0] !==
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
        throw new Error('当前文档格式不支持Word在线预览。');
      blob.value = result;
    }
  } catch (error_) {
    if (current === requestVersion)
      error.value =
        error_ instanceof Error
          ? error_.message
          : '文档读取失败，请确认当前查看权限并刷新合同。';
  } finally {
    if (current === requestVersion) loading.value = false;
  }
}

// 引用变化重置到第一页；不让旧页码带到另一合同或文件修订。
watch(
  () => [props.documentKey, props.mode],
  () => {
    pageCount.value = 0;
    void loadPage(1);
  },
  { immediate: true, flush: 'sync' },
);
onBeforeUnmount(() => {
  requestVersion++;
  clearContent();
});

// 图片解码失败也须显示明确错误，不能把空白画面当成加载成功。
function imageFailed(event: Event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLImageElement)) return;
  if (Number(target.dataset.previewRequest) !== requestVersion) return;
  imageSource.value = '';
  error.value = '文档分页图片无法显示，请刷新合同后重试。';
}
</script>

<template>
  <section :aria-label="`${documentName}只读预览`">
    <div v-if="mode === 'pages'" class="controlled-document-toolbar">
      <strong>{{ documentName }} · 分页图片预览</strong>
      <span role="status">{{ pageStatus }}</span>
      <Button
        size="small"
        :disabled="loading || currentPage <= 1"
        @click="loadPage(currentPage - 1)"
      >
        上一页
      </Button>
      <Button
        size="small"
        :disabled="loading || !pageCount || currentPage >= pageCount"
        @click="loadPage(currentPage + 1)"
      >
        下一页
      </Button>
      <Button
        v-if="error"
        size="small"
        :disabled="loading"
        @click="loadPage(currentPage)"
      >
        重试当前页
      </Button>
    </div>
    <Spin :spinning="loading">
      <Alert v-if="error" type="error" :message="error" show-icon />
      <img
        v-if="imageSource"
        :key="displayedVersion"
        :data-preview-request="displayedVersion"
        :src="imageSource"
        :alt="`${documentName} 第${currentPage}页`"
        class="controlled-document-page"
        @error="imageFailed"
      />
      <ContractDocumentPreview
        v-else-if="blob"
        :document-name="documentName"
        :document-blob="blob"
      />
    </Spin>
  </section>
</template>

<style scoped>
.controlled-document-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.controlled-document-page {
  border: 1px solid var(--ant-color-border-secondary);
  display: block;
  height: auto;
  max-width: 100%;
}
</style>
