<script lang="ts" setup>
import { computed } from 'vue';

import { Alert, Empty } from 'ant-design-vue';

import { renderSafeMarkdown } from '../safe-markdown';

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
// 白名单解析器转义原始 HTML，并且不生成图片、iframe 或脚本。
const markdownHtml = computed(() =>
  renderSafeMarkdown(normalizedContent.value),
);

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
    <!-- Markdown 仅展示安全解析器生成的标签，原始模板不能作为 HTML 注入。 -->
    <!-- eslint-disable vue/no-v-html -->
    <div
      v-if="normalizedType === 'Markdown'"
      class="notice-content-viewer__markdown"
      v-html="markdownHtml"
    ></div>
    <!-- eslint-enable vue/no-v-html -->

    <!-- 普通文本保持换行，不执行标记。 -->
    <div
      v-else-if="normalizedType === 'Text'"
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

<style scoped>
/* Markdown 排版使用语义色并限制宽度，链接不会自动加载远程资源。 */
.notice-content-viewer__markdown {
  overflow-wrap: anywhere;
}
.notice-content-viewer__markdown :deep(h1),
.notice-content-viewer__markdown :deep(h2),
.notice-content-viewer__markdown :deep(h3) {
  font-weight: 600;
  margin-block: 0.75rem;
}
.notice-content-viewer__markdown :deep(h1) {
  font-size: 1.5rem;
}
.notice-content-viewer__markdown :deep(h2) {
  font-size: 1.25rem;
}
.notice-content-viewer__markdown :deep(p) {
  margin-block: 0.5rem;
}
.notice-content-viewer__markdown :deep(ul) {
  list-style: disc;
  padding-left: 1.5rem;
}
.notice-content-viewer__markdown :deep(ol) {
  list-style: decimal;
  padding-left: 1.5rem;
}
.notice-content-viewer__markdown :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}
.notice-content-viewer__markdown :deep(pre) {
  white-space: pre-wrap;
  padding: 0.5rem;
  background: hsl(var(--muted));
}
.notice-content-viewer__markdown :deep(blockquote) {
  border-left: 2px solid hsl(var(--border));
  padding-left: 0.75rem;
}
</style>
