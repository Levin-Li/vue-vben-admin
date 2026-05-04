<script lang="ts" setup>
import {
  computed,
  h,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { $t } from '@vben/locales';

import {
  Alert,
  Button,
  Checkbox,
  Input,
  message,
  Modal,
  Tabs,
  Tooltip,
} from 'ant-design-vue';

import { getVerifyCodeApi } from '@levin/admin-framework/framework-commons/app/api';
import { useAuthStore } from '@levin/admin-framework/framework-commons/app/store';

import { useAuthBrand } from './auth-brand';
import {
  extractReturnedVerifyCode,
  resolveContactVerifyCodeType,
} from './login-verify-type';

defineOptions({ name: 'Login' });

type VerifyCodeTab = 'Captcha' | 'Contact';

interface VerifyCodeTabOption {
  description: string;
  key: VerifyCodeTab;
  title: string;
}

interface RequestVerifyCodeOptions {
  autoLogin?: boolean;
  force?: boolean;
}

interface AutoLoginPromptHandle {
  destroy: () => void;
  update: (config: Record<string, unknown>) => void;
}

const REMEMBER_ME_KEY = `REMEMBER_ME_USERNAME_${location.hostname}`;
const AUTO_LOGIN_COUNTDOWN_SECONDS = 5;

const verifyTabs: VerifyCodeTabOption[] = [
  {
    description: '请输入账号、密码和图片验证码完成登录。',
    key: 'Captcha',
    title: '密码登录',
  },
  {
    description: '输入手机号或邮箱后获取验证码，无需输入密码。',
    key: 'Contact',
    title: '验证码登录',
  },
];

const defaultVerifyTab: VerifyCodeTabOption = verifyTabs[0]!;

const authStore = useAuthStore();
const { loadAuthBrand, techSupport } = useAuthBrand();
const rememberedAccount = localStorage.getItem(REMEMBER_ME_KEY) || '';

const activeVerifyType = ref<VerifyCodeTab>('Captcha');
const captchaImage = ref('');
const countdown = ref(0);
const verifyAssetLoading = ref(false);
const rememberMe = ref(!!rememberedAccount);
const lastAutoLoginSignature = ref('');

const formState = reactive({
  account: rememberedAccount || 'sa',
  password: '123456',
  verifyCode: '',
});

let countdownTimer: null | ReturnType<typeof setInterval> = null;
let autoLoginPrompt: AutoLoginPromptHandle | null = null;
let autoLoginPromptTimer: null | ReturnType<typeof setInterval> = null;

const currentTab = computed<VerifyCodeTabOption>(() => {
  return (
    verifyTabs.find((item) => item.key === activeVerifyType.value) ||
    defaultVerifyTab
  );
});

const isContactTab = computed(() => activeVerifyType.value === 'Contact');
const isCaptchaTab = computed(() => activeVerifyType.value === 'Captcha');

const resolvedVerifyCodeType = computed(() =>
  isContactTab.value
    ? resolveContactVerifyCodeType(normalizeAccount())
    : activeVerifyType.value,
);

const actionButtonText = computed(() => {
  if (verifyAssetLoading.value) {
    return '加载中...';
  }

  if (countdown.value > 0) {
    return `${countdown.value}s 后重试`;
  }

  return isCaptchaTab.value ? '刷新验证码' : '获取验证码';
});

const verifyCodeUsageText = computed(() => {
  if (isCaptchaTab.value) {
    return '图片';
  }

  return resolvedVerifyCodeType.value === 'Email' ? '邮箱' : '短信';
});

function normalizeAccount() {
  return formState.account.trim();
}

function resolveAutoLoginSignature(verifyCode: string) {
  return [
    activeVerifyType.value,
    normalizeAccount(),
    isCaptchaTab.value ? formState.password.trim() : '',
    verifyCode,
  ].join('\n');
}

function renderAutoLoginPromptContent(seconds: number) {
  return h('div', { class: 'space-y-3 pt-1' }, [
    h(
      'div',
      { class: 'text-sm leading-6 text-muted-foreground' },
      '检测到验证码已自动返回，系统即将使用当前账号信息登录。',
    ),
    h(
      'div',
      {
        class:
          'rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground',
      },
      `${seconds} 秒后自动登录`,
    ),
    h(
      'div',
      { class: 'text-xs leading-5 text-muted-foreground' },
      '取消后本次只填入验证码，不会自动提交登录。',
    ),
  ]);
}

function clearAutoLoginPromptTimer() {
  if (autoLoginPromptTimer) {
    clearInterval(autoLoginPromptTimer);
    autoLoginPromptTimer = null;
  }
}

function destroyAutoLoginPrompt() {
  clearAutoLoginPromptTimer();
  autoLoginPrompt?.destroy();
  autoLoginPrompt = null;
}

function confirmAutoLogin() {
  destroyAutoLoginPrompt();

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let seconds = AUTO_LOGIN_COUNTDOWN_SECONDS;

    const finish = (confirmed: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      clearAutoLoginPromptTimer();
      resolve(confirmed);
    };

    const updatePrompt = () => {
      autoLoginPrompt?.update({
        content: renderAutoLoginPromptContent(seconds),
        okText: `立即登录 (${seconds}s)`,
      });
    };

    autoLoginPrompt = Modal.confirm({
      centered: true,
      content: renderAutoLoginPromptContent(seconds),
      cancelText: '取消本次自动登录',
      okText: `立即登录 (${seconds}s)`,
      title: '即将自动登录',
      onCancel: () => {
        finish(false);
      },
      onOk: () => {
        finish(true);
      },
    }) as AutoLoginPromptHandle;

    autoLoginPromptTimer = setInterval(() => {
      seconds -= 1;

      if (seconds <= 0) {
        finish(true);
        autoLoginPrompt?.destroy();
        autoLoginPrompt = null;
        return;
      }

      updatePrompt();
    }, 1000);
  });
}

async function tryAutoLoginWithReturnedVerifyCode(verifyCode: string) {
  if (!verifyCode || authStore.loginLoading) {
    return;
  }

  const account = normalizeAccount();
  const password = formState.password.trim();

  if (!account || (isCaptchaTab.value && !password)) {
    return;
  }

  const signature = resolveAutoLoginSignature(verifyCode);
  if (lastAutoLoginSignature.value === signature) {
    return;
  }

  lastAutoLoginSignature.value = signature;

  const confirmed = await confirmAutoLogin();
  if (!confirmed) {
    message.info('已取消本次自动登录');
    return;
  }

  if (authStore.loginLoading) {
    return;
  }

  try {
    await handleSubmit();
  } catch {
    // 登录失败由统一 API 错误处理展示；这里避免误报为“获取验证码失败”。
  }
}

function getErrorSearchText(error: any) {
  const responseData = error?.response?.data ?? {};
  const directData =
    error && typeof error === 'object' && !('response' in error) ? error : {};
  return [
    error?.message,
    directData?.error,
    directData?.msg,
    directData?.message,
    directData?.detailMsg,
    directData?.errorType,
    responseData?.error,
    responseData?.msg,
    responseData?.message,
    responseData?.detailMsg,
    responseData?.errorType,
  ]
    .filter(Boolean)
    .join(' ');
}

function shouldRefreshVerifyCodeForLoginError(error: any) {
  const text = getErrorSearchText(error).toLowerCase();
  const isVerifyCodeError =
    text.includes('验证码') ||
    text.includes('verifycode') ||
    text.includes('verify code') ||
    text.includes('captcha');

  if (!isVerifyCodeError) {
    return false;
  }

  return (
    text.includes('错误') ||
    text.includes('过期') ||
    text.includes('失效') ||
    text.includes('无效') ||
    text.includes('不正确') ||
    text.includes('expired') ||
    text.includes('invalid') ||
    text.includes('incorrect')
  );
}

async function refreshVerifyCodeAfterLoginError() {
  formState.verifyCode = '';
  lastAutoLoginSignature.value = '';
  await requestVerifyCode({ autoLogin: false, force: true });
}

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startCountdown(seconds = 60) {
  clearCountdown();
  countdown.value = seconds;
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearCountdown();
      countdown.value = 0;
    }
  }, 1000);
}

function resolveVerifyCodePayload(payload: any) {
  if (payload?.interactionData || payload?.type || payload?.code) {
    return payload;
  }

  if (
    payload?.data?.interactionData ||
    payload?.data?.type ||
    payload?.data?.code
  ) {
    return payload.data;
  }

  return payload;
}

function resolveImageMimeType(
  interactionData?: null | string,
  interactionDataType?: null | string,
) {
  const base64 = String(interactionData || '').trim();
  const declaredType = String(interactionDataType || '').trim();

  if (base64.startsWith('iVBOR')) {
    return 'image/png';
  }

  if (base64.startsWith('/9j/')) {
    return 'image/jpeg';
  }

  if (base64.startsWith('R0lGOD')) {
    return 'image/gif';
  }

  if (base64.startsWith('PHN2Zy') || base64.startsWith('PD94bWw')) {
    return 'image/svg+xml';
  }

  return declaredType || 'image/png';
}

function escapeSvgText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function createCaptchaImageFromReturnedCode(code: string) {
  const safeCode = escapeSvgText(code);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="116" height="40" viewBox="0 0 116 40">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#f8fafc" offset="0"/>
      <stop stop-color="#eef2ff" offset="1"/>
    </linearGradient>
  </defs>
  <rect width="116" height="40" rx="8" fill="url(#bg)"/>
  <path d="M8 28 C28 10, 55 36, 108 14" stroke="#a78bfa" stroke-width="1.4" fill="none" opacity=".55"/>
  <path d="M3 12 C24 25, 57 6, 114 27" stroke="#60a5fa" stroke-width="1.1" fill="none" opacity=".45"/>
  <text x="58" y="27" fill="#1f2937" font-family="monospace" font-size="22" font-weight="700" letter-spacing="5" text-anchor="middle">${safeCode}</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function requestVerifyCode(options: RequestVerifyCodeOptions = {}) {
  const account = normalizeAccount();

  if (!account) {
    message.warning('请先输入登录账号');
    return;
  }

  if (isContactTab.value && countdown.value > 0 && !options.force) {
    return;
  }

  try {
    verifyAssetLoading.value = true;
    const payload = resolveVerifyCodePayload(
      await getVerifyCodeApi({
        account,
        verifyCodeType: resolvedVerifyCodeType.value,
      }),
    );

    const returnedCode = extractReturnedVerifyCode(payload);

    if (isCaptchaTab.value) {
      const interactionData = String(payload?.interactionData || '').trim();
      const interactionDataType = String(
        payload?.interactionDataType || '',
      ).trim();

      if (interactionData) {
        captchaImage.value = `data:${resolveImageMimeType(interactionData, interactionDataType)};base64,${interactionData}`;
      } else if (returnedCode) {
        captchaImage.value = createCaptchaImageFromReturnedCode(returnedCode);
      } else {
        captchaImage.value = '';
      }

      if (!captchaImage.value && !returnedCode) {
        message.warning('当前没有获取到验证码图片');
      }

      if (returnedCode) {
        formState.verifyCode = returnedCode;
        if (options.autoLogin !== false) {
          await tryAutoLoginWithReturnedVerifyCode(returnedCode);
        }
      }
      return;
    }

    if (returnedCode) {
      formState.verifyCode = returnedCode;
    }

    startCountdown();

    if (returnedCode && options.autoLogin !== false) {
      await tryAutoLoginWithReturnedVerifyCode(returnedCode);
      return;
    }

    if (payload?.mock && payload?.code) {
      message.success(`验证码已生成：${payload.code}`);
      return;
    }

    message.success(
      resolvedVerifyCodeType.value === 'Email'
        ? '邮箱验证码已发送，请注意查收'
        : '短信验证码已发送，请注意查收',
    );
  } catch (error: any) {
    if (isCaptchaTab.value) {
      captchaImage.value = '';
    }
    message.error(error?.message || '获取验证码失败');
  } finally {
    verifyAssetLoading.value = false;
  }
}

async function handleSubmit() {
  if (authStore.loginLoading) {
    return;
  }

  const account = normalizeAccount();
  const verifyCode = formState.verifyCode.trim();
  const password = formState.password.trim();

  if (!account) {
    message.warning('请输入登录账号');
    return;
  }

  if (isCaptchaTab.value && !password) {
    message.warning('请输入登录密码');
    return;
  }

  if (!verifyCode) {
    message.warning('请输入验证码');
    return;
  }

  localStorage.setItem(REMEMBER_ME_KEY, rememberMe.value ? account : '');

  try {
    await authStore.authLogin({
      account,
      password: isCaptchaTab.value ? password : undefined,
      verifyCode,
      verifyCodeType: resolvedVerifyCodeType.value,
    });
  } catch (error) {
    if (shouldRefreshVerifyCodeForLoginError(error)) {
      await refreshVerifyCodeAfterLoginError();
    }
  }
}

watch(activeVerifyType, () => {
  formState.verifyCode = '';
  lastAutoLoginSignature.value = '';
  captchaImage.value = '';
  clearCountdown();
  countdown.value = 0;

  if (isCaptchaTab.value) {
    void requestVerifyCode();
  }
});

onMounted(() => {
  void loadAuthBrand();

  if (isCaptchaTab.value) {
    void requestVerifyCode();
  }
});

onBeforeUnmount(() => {
  clearCountdown();
  destroyAutoLoginPrompt();
});
</script>

<template>
  <div class="w-full">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-foreground">
        {{ $t('authentication.welcomeBack') }}
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">
        可使用账号密码登录，也可以使用手机或邮箱验证码登录。
      </p>
    </div>

    <Tabs v-model:active-key="activeVerifyType">
      <Tabs.TabPane
        v-for="item in verifyTabs"
        :key="item.key"
        :tab="item.title"
      />
    </Tabs>

    <Alert
      :message="currentTab.description"
      class="mb-5"
      show-icon
      type="info"
    />

    <div class="space-y-4" @keydown.enter.prevent="handleSubmit">
      <div>
        <label class="mb-2 block text-sm font-medium text-foreground">
          登录账号
        </label>
        <Input
          v-model:value="formState.account"
          autocomplete="username"
          placeholder="请输入手机号或邮箱"
          size="large"
          @blur="isCaptchaTab ? requestVerifyCode : undefined"
        />
      </div>

      <div v-if="isCaptchaTab">
        <label class="mb-2 block text-sm font-medium text-foreground">
          登录密码
        </label>
        <Input.Password
          v-model:value="formState.password"
          autocomplete="current-password"
          placeholder="请输入登录密码"
          size="large"
        />
      </div>

      <div>
        <label class="mb-2 block text-sm font-medium text-foreground">
          验证码
        </label>
        <div class="flex items-stretch gap-3">
          <Input
            v-model:value="formState.verifyCode"
            class="flex-1"
            placeholder="请输入验证码"
            size="large"
          />

          <Tooltip v-if="isCaptchaTab" title="刷新验证码">
            <span class="inline-flex">
              <button
                :aria-busy="verifyAssetLoading"
                :disabled="verifyAssetLoading"
                aria-label="刷新验证码"
                class="flex h-10 min-w-[116px] items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                @click="() => requestVerifyCode()"
              >
                <img
                  v-if="captchaImage"
                  :src="captchaImage"
                  alt="验证码"
                  class="h-full w-full object-cover"
                />
                <svg
                  v-else
                  :class="{ 'animate-spin': verifyAssetLoading }"
                  aria-hidden="true"
                  class="size-5"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 12a9 9 0 0 1-15.2 6.5" />
                  <path d="M3 12A9 9 0 0 1 18.2 5.5" />
                  <path d="M18 2v4h-4" />
                  <path d="M6 22v-4h4" />
                </svg>
              </button>
            </span>
          </Tooltip>

          <Button
            v-if="isContactTab"
            :disabled="verifyAssetLoading || countdown > 0"
            :loading="verifyAssetLoading"
            class="min-w-[116px]"
            size="large"
            @click="() => requestVerifyCode()"
          >
            {{ actionButtonText }}
          </Button>
        </div>
      </div>

      <div class="flex items-center justify-between pt-1">
        <Checkbox v-model:checked="rememberMe">记住账号</Checkbox>
        <span class="text-xs text-muted-foreground">
          <template v-if="techSupport"> 技术支持：{{ techSupport }} </template>
          <template v-else>
            当前使用 {{ verifyCodeUsageText }} 验证码
          </template>
        </span>
      </div>

      <Button
        :disabled="authStore.loginLoading"
        :loading="authStore.loginLoading"
        block
        size="large"
        type="primary"
        @click="handleSubmit"
      >
        {{ $t('common.login') }}
      </Button>
    </div>
  </div>
</template>
