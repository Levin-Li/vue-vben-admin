<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, Empty, Pagination, Spin } from 'ant-design-vue';
import { renderAsync } from 'docx-preview';

import {
  getPageSealPositions,
  getSealPositionStyle,
  getSealSourceLabel,
  hasValidSealPosition,
  type ContractSealPosition,
} from './contract-document-preview-utils';

defineOptions({
  name: 'ElectronicContractDocumentPreview',
});

const props = withDefaults(
  defineProps<{
    documentName?: string;
    documentUrl: string;
    positions?: ContractSealPosition[];
    withCredentials?: boolean;
  }>(),
  {
    documentName: '合同文档',
    positions: () => [],
    withCredentials: false,
  },
);

const emit = defineEmits<{
  loadError: [message: string];
  pageChange: [pageNo: number];
}>();

const documentContentRef = ref<HTMLElement>();
const currentPage = ref(1);
const errorMessage = ref('');
const loading = ref(false);
const pageCount = ref(0);
const sealStyles = ref<Record<string, Record<string, string>>>({});

const validPositions = computed(() => props.positions.filter(hasValidSealPosition));
const currentPagePositions = computed(() =>
  getPageSealPositions(validPositions.value, currentPage.value),
);
const hasDocument = computed(() => pageCount.value > 0);

async function loadDocument() {
  errorMessage.value = '';
  pageCount.value = 0;
  currentPage.value = 1;
  documentContentRef.value?.replaceChildren();

  if (!props.documentUrl) {
    setLoadError('未提供可预览的 Word 文件地址。');
    return;
  }

  loading.value = true;
  try {
    const response = await fetch(props.documentUrl, {
      credentials: props.withCredentials ? 'include' : 'omit',
    });
    if (!response.ok) {
      throw new Error(`文件下载失败（HTTP ${response.status}）`);
    }
    const blob = await response.blob();
    if (!documentContentRef.value) {
      return;
    }
    await renderAsync(blob, documentContentRef.value, undefined, {
      breakPages: true,
      inWrapper: true,
    });
    await nextTick();
    pageCount.value = getDocumentPages().length;
    if (pageCount.value === 0) {
      throw new Error('未识别到可展示的 Word 页面。');
    }
    updateVisiblePage();
    updateSealStyles();
  } catch (error) {
    setLoadError(
      error instanceof Error
        ? `无法加载 Word 文档：${error.message}。请确认链接可被当前浏览器安全读取，并已配置同源、CORS 或受控下载授权。`
        : '无法加载 Word 文档，请检查受控下载地址。',
    );
  } finally {
    loading.value = false;
  }
}

function getDocumentPages(): HTMLElement[] {
  return Array.from(
    documentContentRef.value?.querySelectorAll<HTMLElement>('.docx-wrapper > section.docx') || [],
  );
}

function updateVisiblePage() {
  const pages = getDocumentPages();
  pages.forEach((page, index) => {
    page.hidden = index + 1 !== currentPage.value;
  });
}

function updateSealStyles() {
  const page = getDocumentPages()[currentPage.value - 1];
  if (!page) {
    sealStyles.value = {};
    return;
  }
  sealStyles.value = Object.fromEntries(
    currentPagePositions.value.map((position) => {
      const key = getPositionKey(position);
      return [
        key,
        {
          ...getSealPositionStyle(position),
          left: `${page.offsetLeft + page.offsetWidth * position.x}px`,
          top: `${page.offsetTop + page.offsetHeight * position.y}px`,
          width: `${page.offsetWidth * position.width}px`,
          height: `${page.offsetHeight * position.height}px`,
        },
      ];
    }),
  );
}

function getPositionKey(position: ContractSealPosition): string {
  return `${position.pageNo}-${position.signerLabel}-${position.x}-${position.y}`;
}

function handlePageChange(pageNo: number) {
  currentPage.value = pageNo;
  updateVisiblePage();
  void nextTick(updateSealStyles);
  emit('pageChange', pageNo);
}

function downloadDocument() {
  window.open(props.documentUrl, '_blank', 'noopener,noreferrer');
}

function setLoadError(message: string) {
  errorMessage.value = message;
  emit('loadError', message);
}

watch(
  () => props.documentUrl,
  () => void loadDocument(),
  { immediate: true },
);

watch(currentPagePositions, () => void nextTick(updateSealStyles), { deep: true });

onBeforeUnmount(() => {
  documentContentRef.value?.replaceChildren();
});
</script>

<template>
  <section class="contract-document-preview" :aria-label="`${documentName}预览`">
    <div class="contract-document-preview__toolbar">
      <div>
        <strong>{{ documentName }}</strong>
        <span v-if="hasDocument" class="contract-document-preview__page-status">
          第 {{ currentPage }} / {{ pageCount }} 页
        </span>
      </div>
      <div class="contract-document-preview__actions">
        <Button :disabled="currentPage <= 1" size="small" @click="handlePageChange(currentPage - 1)">
          上一页
        </Button>
        <Button :disabled="currentPage >= pageCount" size="small" @click="handlePageChange(currentPage + 1)">
          下一页
        </Button>
        <Button size="small" @click="downloadDocument">下载原文</Button>
      </div>
    </div>

    <Alert
      v-if="errorMessage"
      class="contract-document-preview__error"
      type="error"
      show-icon
      :message="errorMessage"
    />

    <Spin :spinning="loading">
      <div v-show="hasDocument" class="contract-document-preview__stage">
        <div ref="documentContentRef" class="contract-document-preview__document" />
        <div
          v-for="position in currentPagePositions"
          :key="getPositionKey(position)"
          class="contract-document-preview__seal"
          :style="sealStyles[getPositionKey(position)]"
        >
          <span>模拟签章</span>
          <small>{{ position.signerLabel }}</small>
          <em>{{ getSealSourceLabel(position.source) }}</em>
        </div>
      </div>
    </Spin>

    <Empty v-if="!loading && !errorMessage && !hasDocument" description="暂无可预览的 Word 文档" />

    <Pagination
      v-if="hasDocument && pageCount > 1"
      class="contract-document-preview__pagination"
      :current="currentPage"
      :page-size="1"
      :show-size-changer="false"
      :total="pageCount"
      @change="handlePageChange"
    />
  </section>
</template>

<style scoped>
.contract-document-preview {
  display: grid;
  gap: 12px;
}

.contract-document-preview__toolbar,
.contract-document-preview__actions {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.contract-document-preview__page-status {
  color: var(--ant-color-text-secondary);
  margin-left: 8px;
}

.contract-document-preview__stage {
  background: var(--ant-color-fill-quaternary);
  min-height: 360px;
  overflow: auto;
  padding: 16px;
  position: relative;
}

.contract-document-preview__document :deep(.docx-wrapper) {
  background: transparent;
  margin: 0 auto;
  padding: 0;
}

.contract-document-preview__document :deep(.docx-wrapper > section.docx) {
  box-shadow: 0 1px 6px rgb(0 0 0 / 16%);
  margin: 0 auto;
  position: relative;
}

.contract-document-preview__seal {
  align-items: center;
  background: rgb(204 38 38 / 12%);
  border: 2px dashed #c62828;
  box-sizing: border-box;
  color: #9f1d1d;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  justify-content: center;
  min-height: 34px;
  pointer-events: none;
  position: absolute;
  text-align: center;
}

.contract-document-preview__seal small,
.contract-document-preview__seal em {
  font-size: 10px;
  font-style: normal;
}

.contract-document-preview__pagination {
  justify-self: center;
}
</style>
