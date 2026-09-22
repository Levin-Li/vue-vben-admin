<script lang="ts" setup>
import { computed } from 'vue';

import { Alert, Empty } from 'ant-design-vue';

interface Props {
  content?: string;
  contentType?: string;
}

defineOptions({ name: 'NoticeContentViewer' });

const props = withDefaults(defineProps<Props>(), {
  content: '',
  contentType: 'Text',
});

const normalizedType = computed(() => String(props.contentType || 'Text'));
const normalizedContent = computed(() => String(props.content || '').trim());

const contentUrl = computed(() => {
  // 媒体与文件只允许 HTTP(S) 地址，避免通知载荷触发本地或脚本协议。
  try {
    const url = new URL(normalizedContent.value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
});

const parsedJson = computed(() => {
  // JSON 类通知只解析为数据，不把其中的表达式、组件配置或脚本作为可执行内容。
  if (!['AmisJsonView', 'JsonSchema'].includes(normalizedType.value)) {
    return undefined;
  }

  try {
    return JSON.parse(normalizedContent.value);
  } catch {
    return undefined;
  }
});

const formattedJson = computed(() =>
  parsedJson.value === undefined
    ? ''
    : JSON.stringify(parsedJson.value, null, 2),
);
</script>

<template>
  <Empty v-if="!normalizedContent" description="通知未提供内容" />

  <div v-else class="notice-content-viewer">
    <!-- 文本与 Markdown 保持原始换行，防止未经解析的标记被当作 HTML 执行。 -->
    <div
      v-if="normalizedType === 'Text' || normalizedType === 'Markdown'"
      class="notice-content-viewer__text"
    >
      <pre>{{ normalizedContent }}</pre>
    </div>

    <!-- 网页内容隔离在无脚本权限的 iframe 中，通知内容不能访问宿主应用。 -->
    <iframe
      v-else-if="normalizedType === 'Html'"
      class="notice-content-viewer__iframe"
      referrerpolicy="no-referrer"
      sandbox=""
      :srcdoc="normalizedContent"
      title="通知网页内容"
    ></iframe>

    <!-- JSON Schema 与 Amis 配置只读展示，避免执行动态动作、表达式或远程资源。 -->
    <div
      v-else-if="
        (normalizedType === 'JsonSchema' ||
          normalizedType === 'AmisJsonView') &&
        parsedJson !== undefined
      "
      class="notice-content-viewer__json"
    >
      <pre>{{ formattedJson }}</pre>
    </div>
    <Alert
      v-else-if="
        normalizedType === 'JsonSchema' || normalizedType === 'AmisJsonView'
      "
      message="通知内容不是有效的 JSON，无法安全展示。"
      show-icon
      type="warning"
    />

    <!-- 图片、音视频和文件统一校验 URL 协议后再交给浏览器加载或下载。 -->
    <img
      v-else-if="normalizedType === 'Pic' && contentUrl"
      :src="contentUrl"
      alt="通知图片"
      class="notice-content-viewer__image"
    />
    <video
      v-else-if="normalizedType === 'Video' && contentUrl"
      class="notice-content-viewer__media"
      controls
      :src="contentUrl"
    ></video>
    <audio
      v-else-if="normalizedType === 'Audio' && contentUrl"
      class="notice-content-viewer__media"
      controls
      :src="contentUrl"
    ></audio>
    <div v-else-if="normalizedType === 'File' && contentUrl">
      <a :href="contentUrl" rel="noopener noreferrer" target="_blank">
        下载通知附件
      </a>
    </div>
    <Alert
      v-else
      message="通知内容地址无效或不支持该内容类型。"
      show-icon
      type="warning"
    />
  </div>
</template>

<style scoped>
.notice-content-viewer__text,
.notice-content-viewer__json {
  max-height: 50vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.notice-content-viewer__iframe,
.notice-content-viewer__image,
.notice-content-viewer__media {
  width: 100%;
  max-height: 50vh;
  border: 0;
  border-radius: 0.375rem;
}

.notice-content-viewer__iframe {
  min-height: 320px;
}

.notice-content-viewer__image,
.notice-content-viewer__media {
  object-fit: contain;
}
</style>
