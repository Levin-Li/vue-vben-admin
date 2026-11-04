<script lang="ts" setup>
import type { ProviderOnboardingGuidance } from './provider-onboarding-guidance';

import { computed, ref, watch } from 'vue';

import { oauthService } from '@levin/admin-framework/framework-commons/app/api/oauth-service';
import { Button, Drawer, message } from 'ant-design-vue';

import { buildProviderCallbackUrl } from './provider-onboarding-guidance';
import { renderSafeMarkdown } from './safe-markdown';

const props = defineProps<{
  guidance?: ProviderOnboardingGuidance;
  providerCode?: string;
}>();
const open = ref(false);
const guideHost = ref<HTMLElement | null>(null);

// 将抽屉挂在当前配置弹窗内，遮盖范围只限于该弹窗。
function getGuideContainer(): HTMLElement {
  return (
    guideHost.value?.closest<HTMLElement>('.ant-modal-content') || document.body
  );
}

// 地址占位符只使用当前站点、应用真实 API 路径和安全的供应商编码。
const callbackUrls = computed(() => {
  const code = props.providerCode || '';
  if (!/^[\w-]+$/.test(code)) return { callbackUrl: '', inAppCallbackUrl: '' };
  return {
    callbackUrl: buildProviderCallbackUrl(
      window.location.origin,
      oauthService.buildRequestPath(`callback/${code}`),
    ),
    inAppCallbackUrl: buildProviderCallbackUrl(
      window.location.origin,
      oauthService.buildRequestPath(`inApp/callback/${code}`),
    ),
  };
});
// 结构化元数据先展示可信入口和操作步骤，Markdown 仅作为补充说明。
function safeExternalUrl(value?: string): string {
  try {
    const url = new URL(value || '');
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    const host = url.hostname.toLowerCase();
    if (
      /^(?:localhost|.*\.localhost|.*\.local|.*\.internal)$/.test(host) ||
      /^[\d.]+$/.test(host) ||
      host.includes(':')
    )
      return '';
    return url.href;
  } catch {
    return '';
  }
}
const applicationUrl = computed(() =>
  safeExternalUrl(props.guidance?.applicationUrl),
);
const documentationUrl = computed(() =>
  safeExternalUrl(props.guidance?.documentationUrl),
);
const prerequisites = computed(() => props.guidance?.prerequisites || []);
const steps = computed(() => props.guidance?.steps || []);
const guide = computed(() => props.guidance?.markdown?.trim() || '');
const html = computed(() => {
  const markdown = guide.value.replaceAll(
    /\{\{(callbackUrl|inAppCallbackUrl)\}\}/g,
    (_, key: 'callbackUrl' | 'inAppCallbackUrl') => callbackUrls.value[key],
  );
  return renderSafeMarkdown(markdown);
});
const shownCallbacks = computed(() =>
  (['callbackUrl', 'inAppCallbackUrl'] as const).filter(
    (key) => guide.value.includes(`{{${key}}}`) && callbackUrls.value[key],
  ),
);

// 切换供应商时关闭旧指南，避免继续展示上一供应商内容。
watch(
  () => props.providerCode,
  () => {
    open.value = false;
  },
);

async function copyCallback(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    message.success('回调地址已复制');
  } catch {
    message.warning('无法访问剪贴板，请选择并手动复制回调地址');
  }
}
</script>

<template>
  <!-- 所有插件均可打开指南；右侧阅读面板叠在当前配置弹窗内部。 -->
  <span ref="guideHost" class="inline-flex">
    <Button size="small" @click="open = true">配置指南</Button>
  </span>
  <Drawer
    v-model:open="open"
    :get-container="getGuideContainer"
    :mask="false"
    :root-style="{ position: 'absolute', inset: '0' }"
    :z-index="1"
    placement="right"
    title="配置指南"
    width="min(58%, 560px)"
  >
    <div class="space-y-3">
      <section v-if="applicationUrl || documentationUrl">
        <h3 class="font-semibold">服务与配置入口</h3>
        <div v-if="applicationUrl" class="mt-2">
          <div>供应商主站或服务入口</div>
          <a :href="applicationUrl" target="_blank" rel="noopener noreferrer">{{
            applicationUrl
          }}</a>
        </div>
        <div v-if="documentationUrl" class="mt-2">
          <div>配置入口或官方文档</div>
          <a :href="documentationUrl" rel="noopener noreferrer" target="_blank">
            {{ documentationUrl }}
          </a>
        </div>
      </section>
      <p v-else>
        当前插件没有可核实的外部配置链接，请按本页面字段和下方步骤完成配置。
      </p>
      <section v-if="prerequisites.length > 0">
        <h3 class="font-semibold">配置前准备</h3>
        <ul class="mt-2 list-disc pl-5">
          <li v-for="item in prerequisites" :key="item">{{ item }}</li>
        </ul>
      </section>
      <section v-if="steps.length > 0">
        <h3 class="font-semibold">配置步骤</h3>
        <ol class="mt-2 list-decimal pl-5">
          <li v-for="item in steps" :key="item">{{ item }}</li>
        </ol>
      </section>
      <p v-else>按当前表单填写所需参数，保存后再启用并验证服务。</p>
      <!-- 安全渲染器先转义所有原始 HTML，只生成白名单 Markdown 标签。 -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="guide" class="provider-guide-markdown" v-html="html"></div>
      <div
        v-for="key in shownCallbacks"
        :key="key"
        class="flex items-center gap-2"
      >
        <Button size="small" @click="copyCallback(callbackUrls[key])">
          {{
            key === 'callbackUrl' ? '复制登录回调地址' : '复制 App 内回调地址'
          }}
        </Button>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.provider-guide-markdown :deep(h1),
.provider-guide-markdown :deep(h2),
.provider-guide-markdown :deep(h3) {
  margin: 1em 0 0.5em;
  font-weight: 600;
}
.provider-guide-markdown :deep(h1) {
  font-size: 1.5em;
}
.provider-guide-markdown :deep(h2) {
  font-size: 1.25em;
}
.provider-guide-markdown :deep(p),
.provider-guide-markdown :deep(ul),
.provider-guide-markdown :deep(ol) {
  margin: 0.6em 0;
}
.provider-guide-markdown :deep(ul) {
  list-style: disc;
  padding-left: 1.5em;
}
.provider-guide-markdown :deep(ol) {
  list-style: decimal;
  padding-left: 1.5em;
}
.provider-guide-markdown :deep(code) {
  overflow-wrap: anywhere;
  background: #f3f4f6;
  padding: 0.1em 0.3em;
}
.provider-guide-markdown :deep(pre) {
  overflow-x: auto;
  background: #f3f4f6;
  padding: 0.8em;
}
.provider-guide-markdown :deep(a) {
  color: #1677ff;
  text-decoration: underline;
}
section a {
  color: #1677ff;
  overflow-wrap: anywhere;
  text-decoration: underline;
}
</style>
