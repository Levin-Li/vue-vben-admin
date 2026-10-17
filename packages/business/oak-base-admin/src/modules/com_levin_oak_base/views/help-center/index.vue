<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Button, Empty, Input, Select, Tag } from 'ant-design-vue';

import {
  findHelpDocument,
  HELP_CENTER_PATH,
  helpCenterVersion,
  helpDocuments,
  helpDocumentUrl,
} from '../../help-center';
import { renderHelpMarkdown } from '../../help-markdown';

// 目录只做阅读用途筛选；静态文档的公开边界在构建登记时决定。
const route = useRoute();
const router = useRouter();
const keyword = ref('');
const audience = ref<string>();
const moduleName = ref<string>();
const selectedId = computed(() =>
  typeof route.query.doc === 'string' ? route.query.doc : '',
);
const selectedDocument = computed(() => findHelpDocument(selectedId.value));
const renderedBody = computed(() =>
  selectedDocument.value
    ? renderHelpMarkdown(selectedDocument.value.content)
    : '',
);
const moduleOptions = [
  ...new Set(helpDocuments.map((document) => document.module)),
].map((value) => ({ label: value, value }));
const audienceOptions = ['用户', '管理员', '开发者'].map((value) => ({
  label: value,
  value,
}));
const matchingDocuments = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  return helpDocuments.filter(
    (document) =>
      (!audience.value || document.audience === audience.value) &&
      (!moduleName.value || document.module === moduleName.value) &&
      (!query ||
        `${document.title} ${document.module} ${document.content}`
          .toLocaleLowerCase()
          .includes(query)),
  );
});

// 文档切换和直接打开章节链接时，在正文完成渲染后定位稳定标题 ID。
watch(
  [selectedId, () => route.hash],
  async () => {
    await nextTick();
    const hash = route.hash.slice(1);
    if (hash)
      document
        .querySelector(`#${CSS.escape(decodeURIComponent(hash))}`)
        ?.scrollIntoView({ block: 'start' });
  },
  { immediate: true },
);

function openDocument(id: string) {
  return router.push(helpDocumentUrl(id));
}

function followDocumentLink(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a');
  const href = anchor?.getAttribute('href');
  if (!href?.startsWith('?doc=')) return;
  event.preventDefault();
  const url = new URL(href, window.location.href);
  const id = url.searchParams.get('doc');
  if (!id || !findHelpDocument(id)) return;
  void router.push({
    path: HELP_CENTER_PATH,
    query: { doc: id },
    hash: url.hash,
  });
}
</script>

<template>
  <Page title="文档中心">
    <!-- 页面左侧是统一目录；同一稳定地址也可由业务页面直接打开。 -->
    <div class="help-center grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="bg-card rounded-lg border p-4">
        <div class="text-muted-foreground mb-3 text-sm">
          随前端版本 {{ helpCenterVersion }} 发布
        </div>
        <Input
          v-model:value="keyword"
          allow-clear
          placeholder="搜索标题或正文"
          aria-label="搜索文档"
        />
        <div class="mt-3 grid gap-2">
          <Select
            v-model:value="audience"
            allow-clear
            :options="audienceOptions"
            placeholder="按读者筛选"
          />
          <Select
            v-model:value="moduleName"
            allow-clear
            :options="moduleOptions"
            placeholder="按模块筛选"
          />
        </div>
        <div class="mt-4 grid gap-1">
          <Button
            v-for="item in matchingDocuments"
            :key="item.id"
            class="help-center__item h-auto w-full text-left"
            :type="item.id === selectedId ? 'primary' : 'text'"
            @click="openDocument(item.id)"
          >
            <span class="block whitespace-normal">{{ item.title }}</span>
            <span class="block text-xs opacity-70">
              {{ item.module }}
              <span aria-hidden="true"> · </span>
              {{ item.audience }}
            </span>
          </Button>
          <Empty
            v-if="matchingDocuments.length === 0"
            description="没有匹配的文档"
          />
        </div>
      </aside>

      <!-- 原始 HTML 已在渲染器转义，正文中的站内链接仅指向登记过的文档 ID。 -->
      <main class="bg-card min-w-0 rounded-lg border p-5 lg:p-8">
        <template v-if="selectedDocument">
          <div class="mb-5 flex flex-wrap items-center gap-2">
            <Tag>{{ selectedDocument.module }}</Tag>
            <Tag>{{ selectedDocument.audience }}</Tag>
            <Tag>{{ selectedDocument.type }}</Tag>
          </div>
          <h1 class="mb-2 text-2xl font-semibold">
            {{ selectedDocument.title }}
          </h1>
          <p class="text-muted-foreground mb-6 text-sm">
            来源：{{ selectedDocument.source }}
          </p>
          <!-- eslint-disable vue/no-v-html -->
          <article
            class="help-center__body"
            v-html="renderedBody"
            @click="followDocumentLink"
          ></article>
          <!-- eslint-enable vue/no-v-html -->
        </template>
        <Empty
          v-else
          :description="
            selectedId
              ? '文档不存在或未随当前版本发布'
              : '请选择左侧文档开始阅读'
          "
        />
      </main>
    </div>
  </Page>
</template>

<style scoped>
.help-center__item {
  justify-content: flex-start;
  padding: 0.6rem 0.75rem;
}
.help-center__body {
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.help-center__body :deep(h1),
.help-center__body :deep(h2),
.help-center__body :deep(h3) {
  font-weight: 650;
  margin: 1.4em 0 0.6em;
  scroll-margin-top: 5rem;
}
.help-center__body :deep(h1) {
  font-size: 1.6rem;
}
.help-center__body :deep(h2) {
  font-size: 1.3rem;
}
.help-center__body :deep(h3) {
  font-size: 1.12rem;
}
.help-center__body :deep(p),
.help-center__body :deep(ul),
.help-center__body :deep(ol) {
  margin: 0.75rem 0;
}
.help-center__body :deep(ul),
.help-center__body :deep(ol) {
  padding-left: 1.5rem;
}
.help-center__body :deep(li) {
  margin: 0.3rem 0;
}
.help-center__body :deep(a) {
  color: var(--primary, #2563eb);
  text-decoration: underline;
}
.help-center__body :deep(code) {
  border-radius: 0.25rem;
  background: rgba(127, 127, 127, 0.12);
  padding: 0.1rem 0.25rem;
}
.help-center__body :deep(pre) {
  margin: 1rem 0;
  overflow-x: auto;
  border-radius: 0.5rem;
  background: rgba(127, 127, 127, 0.1);
  padding: 1rem;
}
.help-center__body :deep(pre code) {
  background: none;
  padding: 0;
}
.help-center__body :deep(blockquote) {
  border-left: 3px solid #94a3b8;
  padding-left: 1rem;
  color: #64748b;
}
.help-center__body :deep(.help-table-scroll) {
  overflow-x: auto;
}
.help-center__body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}
.help-center__body :deep(th),
.help-center__body :deep(td) {
  border: 1px solid #d1d5db;
  padding: 0.5rem 0.75rem;
  text-align: left;
  vertical-align: top;
}
</style>
