<script lang="ts" setup>
import type { ProviderOnboardingGuidance } from './provider-onboarding-guidance';

import { computed } from 'vue';

import { oauthService } from '@levin/admin-framework/framework-commons/app/api/oauth-service';
import { Alert, Button, message } from 'ant-design-vue';

import {
  buildProviderCallbackUrl,
  checkProviderRedirectUri,
  isSafeGuidanceUrl,
} from './provider-onboarding-guidance';

// 两个配置入口消费当前供应商与当前编辑值，切换后自动更新说明。
const props = defineProps<{
  configuration?: unknown;
  guidance?: ProviderOnboardingGuidance;
  loginProvider?: boolean;
  providerCode?: string;
}>();
const enterpriseProviders = new Set([
  'DINGTALK_V2',
  'FEISHU',
  'WECHAT_ENTERPRISE_V2',
]);
const callbackUrl = computed(() => {
  if (
    !props.loginProvider ||
    !enterpriseProviders.has(props.providerCode || '')
  )
    return '';
  return buildProviderCallbackUrl(
    window.location.origin,
    oauthService.buildRequestPath(`callback/${props.providerCode}`),
  );
});
const callbackStatus = computed(() => {
  const config = props.configuration;
  const redirectUri =
    config && typeof config === 'object'
      ? (config as Record<string, unknown>).redirectUri
      : undefined;
  return checkProviderRedirectUri(redirectUri, callbackUrl.value);
});

// 飞书和企微使用独立的端内回调；钉钉仅通过容器 JSAPI 返回授权码。
const inAppCallbackUrl = computed(() => {
  if (!callbackUrl.value || props.providerCode === 'DINGTALK_V2') return '';
  return buildProviderCallbackUrl(
    window.location.origin,
    oauthService.buildRequestPath(`inApp/callback/${props.providerCode}`),
  );
});
const inAppCallbackStatus = computed(() => {
  const config = props.configuration;
  return checkProviderRedirectUri(
    config && typeof config === 'object'
      ? (config as Record<string, unknown>).inAppRedirectUri
      : undefined,
    inAppCallbackUrl.value,
    'inAppRedirectUri',
  );
});

// 只提示必要字段是否填写，不读取或展示密钥内容。
const configurationHints = computed(() => {
  if (!callbackUrl.value) return [];
  const config =
    props.configuration && typeof props.configuration === 'object'
      ? (props.configuration as Record<string, unknown>)
      : {};
  const hints: string[] = [];
  if (!config.clientId) hints.push('请填写平台应用标识 clientId。');
  if (!config.clientSecretRef)
    hints.push('请填写机密配置引用 clientSecretRef。');
  if (!config.companyRootOrgId)
    hints.push('请选择当前租户中该公司的独立根组织 companyRootOrgId。');
  if (props.providerCode === 'WECHAT_ENTERPRISE_V2' && !config.agentId)
    hints.push('企微登录需填写应用 Agent ID。');
  if (config.enable !== true) hints.push('当前配置尚未启用登录。');
  if (config.enableInAppLogin !== true)
    hints.push('App 内网页免登默认关闭，完成平台配置后可单独启用。');
  if (
    config.enableInAppLogin === true &&
    props.providerCode === 'DINGTALK_V2' &&
    !config.corpId
  )
    hints.push('钉钉 App 内免登需填写企业 corpId，不能用应用 clientId 代替。');
  return hints;
});

// 复制当前公开回调地址，失败时保留可选中的原文。
async function copyCallback(value = callbackUrl.value) {
  try {
    await navigator.clipboard.writeText(value);
    message.success('回调地址已复制');
  } catch {
    message.warning('无法访问剪贴板，请选择并手动复制回调地址');
  }
}
</script>

<template>
  <!-- 指导步骤和官方入口来自后端，适用于登录和组织同步各自的权限范围。 -->
  <Alert
    v-if="guidance"
    class="my-3"
    message="供应商申请与配置准备"
    show-icon
    type="info"
  >
    <template #description>
      <div class="space-y-3 pt-2">
        <div v-if="guidance.prerequisites?.length">
          <div class="text-foreground font-medium">前置条件</div>
          <ul class="mb-0 mt-1 list-disc pl-5">
            <li v-for="item in guidance.prerequisites" :key="item">
              {{ item }}
            </li>
          </ul>
        </div>
        <div v-if="guidance.steps?.length">
          <div class="text-foreground font-medium">配置步骤</div>
          <ol class="mb-0 mt-1 list-decimal pl-5">
            <li v-for="item in guidance.steps" :key="item">{{ item }}</li>
          </ol>
        </div>
        <div class="flex flex-wrap gap-3">
          <a
            v-if="isSafeGuidanceUrl(guidance.applicationUrl)"
            :href="guidance.applicationUrl"
            rel="noopener noreferrer"
            target="_blank"
          >
            前往申请/注册
          </a>
          <a
            v-if="isSafeGuidanceUrl(guidance.documentationUrl)"
            :href="guidance.documentationUrl"
            rel="noopener noreferrer"
            target="_blank"
          >
            查看官方配置文档
          </a>
        </div>
      </div>
    </template>
  </Alert>

  <!-- 浏览器实际使用的 API 路径生成地址，只做本地一致性核对。 -->
  <Alert
    v-if="callbackUrl"
    class="my-3"
    message="登录回调地址"
    show-icon
    type="info"
  >
    <template #description>
      <div class="space-y-2 pt-2">
        <div class="flex flex-wrap items-center gap-2 break-all">
          <code class="break-all" data-testid="enterprise-callback-url">{{
            callbackUrl
          }}</code>
          <Button size="small" @click="copyCallback()">复制回调地址</Button>
        </div>
        <div role="status">{{ callbackStatus }}</div>
        <!-- 单独显示端内地址，防止覆盖既有浏览器登录回调。 -->
        <div v-if="inAppCallbackUrl" class="space-y-2">
          <div class="font-medium">App 内网页授权回调</div>
          <div class="flex flex-wrap items-center gap-2 break-all">
            <code data-testid="enterprise-inapp-callback-url">{{
              inAppCallbackUrl
            }}</code>
            <Button size="small" @click="copyCallback(inAppCallbackUrl)">
              复制 App 内回调地址
            </Button>
          </div>
          <div role="status">{{ inAppCallbackStatus }}</div>
        </div>
        <div v-else-if="providerCode === 'DINGTALK_V2'">
          钉钉 App 内免登使用 JSAPI 授权码，需配置企业 corpId 和应用安全域名。
        </div>
        <div>
          群消息链接本身不提供用户身份。需在受支持的企业 App
          容器中打开受控站点，并满足应用可用范围；手机号权限单独申请，基础免登不保证返回手机号。
        </div>
        <ul v-if="configurationHints.length > 0" class="mb-0 list-disc pl-5">
          <li v-for="hint in configurationHints" :key="hint">{{ hint }}</li>
        </ul>
        <div>
          此处仅核对地址；平台凭据、应用可用范围和通讯录权限需按上方步骤在对应平台确认。反向代理部署请核对当前站点是企业员工实际访问的公开域名。
        </div>
      </div>
    </template>
  </Alert>
</template>
