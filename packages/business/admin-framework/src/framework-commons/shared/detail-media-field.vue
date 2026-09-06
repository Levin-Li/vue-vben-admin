<script setup lang="ts">
import type { DetailMediaResource } from './detail-media';

import { computed, reactive } from 'vue';

import { downloadFileFromBlob } from '@vben/utils';

import { Button, Image, ImagePreviewGroup, message } from 'ant-design-vue';

import { getDetailMediaResources } from './detail-media';

const props = defineProps<{
  label: string;
  type: 'file' | 'image';
  value: unknown;
}>();

const resources = computed(() =>
  getDetailMediaResources(props.value, window.location.href),
);
const downloading = reactive(new Set<string>());

async function download(resource: DetailMediaResource) {
  const url = resource.url;
  if (!url || downloading.has(url)) return;
  downloading.add(url);
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    downloadFileFromBlob({
      fileName: resource.name,
      source: await response.blob(),
    });
  } catch {
    message.error('下载失败，请重试或通过打开入口访问文件');
  } finally {
    downloading.delete(url);
  }
}
</script>

<template>
  <div v-if="type === 'image'" class="detail-images" data-test="detail-images">
    <ImagePreviewGroup>
      <template
        v-for="(resource, index) in resources"
        :key="`${index}-${resource.url}`"
      >
        <Image
          v-if="resource.url"
          :src="resource.url"
          :alt="`${label} · 第 ${index + 1} 张`"
          :width="88"
          :height="88"
          class="detail-thumbnail"
        >
          <template #previewMask>查看大图</template>
        </Image>
        <span v-else class="detail-resource-unavailable">资源地址不可用</span>
      </template>
    </ImagePreviewGroup>
    <div v-if="resources.length === 0" class="detail-resource-unavailable">
      暂无图片
    </div>
  </div>
  <ul v-else class="detail-files" data-test="detail-files">
    <li
      v-for="(resource, index) in resources"
      :key="`${index}-${resource.url}`"
      class="detail-file"
    >
      <template v-if="resource.url">
        <span class="detail-file-name">{{ resource.name }}</span>
        <span class="detail-file-actions">
          <a
            :href="resource.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${resource.pdf ? '预览' : '打开'}：${resource.name}`"
          >
            {{ resource.pdf ? '预览' : '打开' }}
          </a>
          <Button
            type="link"
            size="small"
            :loading="downloading.has(resource.url)"
            :aria-label="`下载：${resource.name}`"
            data-test="detail-file-download"
            @click="download(resource)"
          >
            下载
          </Button>
        </span>
      </template>
      <span v-else class="detail-resource-unavailable">资源地址不可用</span>
    </li>
    <li v-if="resources.length === 0" class="detail-resource-unavailable">
      暂无附件
    </li>
  </ul>
</template>

<style scoped>
.detail-images {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.detail-images :deep(.ant-image) {
  max-width: 100%;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.detail-images :deep(.ant-image-img) {
  height: 100%;
  object-fit: cover;
}

.detail-files {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.detail-file {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: baseline;
}

.detail-file-name {
  flex: 1 1 140px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.detail-file-actions {
  display: inline-flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
}

.detail-file-actions a {
  color: hsl(var(--primary));
}

.detail-file-actions a:hover {
  text-decoration: underline;
}

.detail-file-actions :deep(.ant-btn) {
  height: auto;
  padding: 0;
}

.detail-resource-unavailable {
  color: hsl(var(--muted-foreground));
}
</style>
