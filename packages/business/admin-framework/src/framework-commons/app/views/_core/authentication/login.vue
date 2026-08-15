<script lang="ts" setup>
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
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

import {
  getVerifyCodeApi,
  startPasswordLoginApi,
} from '@levin/admin-framework/framework-commons/app/api';
import { useAuthStore } from '@levin/admin-framework/framework-commons/app/store';

import { useAuthBrand } from './auth-brand';
import {
  extractReturnedVerifyCode,
  resolveContactVerifyCodeType,
} from './login-verify-type';

defineOptions({ name: 'Login' });

type VerifyCodeTab = 'Captcha' | 'Contact';
type PasswordVerifyCodeType = 'Captcha' | 'Mfa';

interface VerifyCodeTabOption {
  description: string;
  key: VerifyCodeTab;
  title: string;
}

interface RequestVerifyCodeOptions {
  autoLogin?: boolean;
  force?: boolean;
}

const REMEMBER_ME_KEY = `REMEMBER_ME_USERNAME_${location.hostname}`;
const AUTO_LOGIN_COUNTDOWN_SECONDS = 5;

const verifyTabs: VerifyCodeTabOption[] = [
  {
    description: '请输入账号和密码以继续登录。',
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
const { techSupport } = useAuthBrand();
const rememberedAccount = localStorage.getItem(REMEMBER_ME_KEY) || '';
const isLoopbackBrowserHost = ['127.0.0.1', 'localhost'].includes(
  location.hostname,
);

const activeVerifyType = ref<VerifyCodeTab>('Captcha');
const passwordLoginChallengeId = ref('');
const passwordVerifyCodeType = ref<PasswordVerifyCodeType | undefined>();
const passwordVerifyDialogOpen = ref(false);
const captchaImage = ref('');
const countdown = ref(0);
const verifyAssetLoading = ref(false);
const rememberMe = ref(!!rememberedAccount);
const lastAutoLoginSignature = ref('');
const autoLoginCountdown = ref(0);

const formState = reactive({
  account: rememberedAccount || (isLoopbackBrowserHost ? 'sa' : ''),
  password: isLoopbackBrowserHost ? '123456' : '',
  verifyCode: '',
});

let countdownTimer: null | ReturnType<typeof setInterval> = null;
let autoLoginTimer: null | ReturnType<typeof setInterval> = null;
let loginPageActive = true;

const currentTab = computed<VerifyCodeTabOption>(() => {
  return (
    verifyTabs.find((item) => item.key === activeVerifyType.value) ||
    defaultVerifyTab
  );
});

const isContactTab = computed(() => activeVerifyType.value === 'Contact');
const isCaptchaTab = computed(() => activeVerifyType.value === 'Captcha');
const isPasswordCaptchaMode = computed(
  () =>
    isCaptchaTab.value &&
    !!passwordLoginChallengeId.value &&
    passwordVerifyCodeType.value === 'Captcha',
);
const isPasswordMfaMode = computed(
  () =>
    isCaptchaTab.value &&
    !!passwordLoginChallengeId.value &&
    passwordVerifyCodeType.value === 'Mfa',
);

const resolvedVerifyCodeType = computed(() =>
  isContactTab.value
    ? resolveContactVerifyCodeType(normalizeAccount())
    : passwordVerifyCodeType.value || 'Captcha',
);

const currentTabDescription = computed(() => currentTab.value.description);

const actionButtonText = computed(() => {
  if (verifyAssetLoading.value) {
    return '加载中...';
  }

  if (countdown.value > 0) {
    return `${countdown.value}s 后重试`;
  }

  return isPasswordCaptchaMode.value ? '刷新验证码' : '获取验证码';
});

const verifyCodeUsageText = computed(() => {
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

function clearAutoLoginCountdown() {
  if (autoLoginTimer) {
    clearInterval(autoLoginTimer);
    autoLoginTimer = null;
  }
  autoLoginCountdown.value = 0;
}

function tryAutoLoginWithReturnedVerifyCode(verifyCode: string) {
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
  clearAutoLoginCountdown();
  autoLoginCountdown.value = AUTO_LOGIN_COUNTDOWN_SECONDS;
  autoLoginTimer = setInterval(() => {
    autoLoginCountdown.value -= 1;
    if (autoLoginCountdown.value > 0) {
      return;
    }

    clearAutoLoginCountdown();
    if (!loginPageActive || authStore.loginLoading) {
      return;
    }

    void (isPasswordCaptchaMode.value
      ? completePasswordLogin()
      : handleSubmit());
  }, 1000);
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
  if (
    payload?.data?.interactionData ||
    payload?.data?.type ||
    payload?.data?.code
  ) {
    return payload.data;
  }

  if (payload?.interactionData || payload?.type || payload?.code) {
    return payload;
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

  if (isCaptchaTab.value && !isPasswordCaptchaMode.value) {
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

    if (!loginPageActive) {
      return;
    }

    const returnedCode = extractReturnedVerifyCode(payload);

    if (isPasswordCaptchaMode.value) {
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
    if (isPasswordCaptchaMode.value) {
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

  clearAutoLoginCountdown();

  const account = normalizeAccount();
  const password = formState.password.trim();

  if (!account) {
    message.warning('请输入登录账号');
    return;
  }

  if (isCaptchaTab.value && !password) {
    message.warning('请输入登录密码');
    return;
  }

  if (isCaptchaTab.value) {
    await startPasswordLogin(account, password);
    return;
  }

  const verifyCode = formState.verifyCode.trim();

  if (!verifyCode) {
    message.warning('请输入验证码');
    return;
  }

  localStorage.setItem(REMEMBER_ME_KEY, rememberMe.value ? account : '');

  try {
    await authStore.authLogin({
      account,
      verifyCode,
      verifyCodeType: resolvedVerifyCodeType.value,
    });
  } catch (error) {
    if (shouldRefreshVerifyCodeForLoginError(error)) {
      await refreshVerifyCodeAfterLoginError();
    }
  }
}

async function completePasswordLogin() {
  if (authStore.loginLoading || !passwordLoginChallengeId.value) {
    return;
  }

  clearAutoLoginCountdown();

  const verifyCode = formState.verifyCode.trim();
  if (!verifyCode) {
    message.warning(
      isPasswordMfaMode.value ? '请输入 Google 验证器验证码' : '请输入验证码',
    );
    return;
  }

  const account = normalizeAccount();
  if (!account) {
    resetPasswordLoginChallenge();
    return;
  }

  try {
    await authStore.authLoginWithPasswordChallenge({
      account,
      loginVerifyChallengeId: passwordLoginChallengeId.value,
      verifyCode,
      verifyCodeType: resolvedVerifyCodeType.value,
    });
  } catch {
    resetPasswordLoginChallenge();
  }
}

async function startPasswordLogin(account: string, password: string) {
  try {
    verifyAssetLoading.value = true;
    const challenge = await startPasswordLoginApi({ account, password });

    passwordLoginChallengeId.value = challenge.challengeId;
    passwordVerifyCodeType.value = challenge.verifyCodeType;
    formState.verifyCode = '';
    captchaImage.value = '';

    localStorage.setItem(REMEMBER_ME_KEY, rememberMe.value ? account : '');

    if (challenge.verifyCodeType === 'Captcha') {
      passwordVerifyDialogOpen.value = true;
      await requestVerifyCode({ force: true });
    } else if (!challenge.verifyCodeType) {
      await authStore.authLoginWithPasswordChallenge({
        account,
        loginVerifyChallengeId: challenge.challengeId,
      });
      return;
    }

    passwordVerifyDialogOpen.value = true;
  } catch {
    resetPasswordLoginChallenge();
  } finally {
    verifyAssetLoading.value = false;
  }
}

function resetPasswordLoginChallenge() {
  clearAutoLoginCountdown();
  passwordVerifyDialogOpen.value = false;
  passwordLoginChallengeId.value = '';
  passwordVerifyCodeType.value = undefined;
  formState.verifyCode = '';
  captchaImage.value = '';
  lastAutoLoginSignature.value = '';
}

function handlePasswordVerifyDialogOpenChange(open: boolean) {
  if (!open) {
    resetPasswordLoginChallenge();
    return;
  }

  passwordVerifyDialogOpen.value = true;
}

watch(activeVerifyType, () => {
  resetPasswordLoginChallenge();
  clearCountdown();
  countdown.value = 0;
});

onMounted(() => {
  loginPageActive = true;
});

onActivated(() => {
  loginPageActive = true;
});

onDeactivated(() => {
  loginPageActive = false;
  clearAutoLoginCountdown();
});

onBeforeUnmount(() => {
  loginPageActive = false;
  clearCountdown();
  clearAutoLoginCountdown();
});
</script>

<template>
  <div class="w-full">
    <div class="mb-6">
      <h1 class="text-foreground text-2xl font-semibold">
        {{ $t('authentication.welcomeBack') }}
      </h1>
      <p class="text-muted-foreground mt-2 text-sm">
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
      :message="currentTabDescription"
      class="mb-5"
      show-icon
      type="info"
    />

    <div class="space-y-4" @keydown.enter.prevent="handleSubmit">
      <div>
        <label class="text-foreground mb-2 block text-sm font-medium">
          登录账号
        </label>
        <Input
          v-model:value="formState.account"
          autocomplete="username"
          placeholder="请输入手机号或邮箱"
          size="large"
          @update:value="
            () => passwordVerifyDialogOpen && resetPasswordLoginChallenge()
          "
        />
      </div>

      <div v-if="isCaptchaTab">
        <label class="text-foreground mb-2 block text-sm font-medium">
          登录密码
        </label>
        <Input.Password
          v-model:value="formState.password"
          autocomplete="current-password"
          placeholder="请输入登录密码"
          size="large"
        />
      </div>

      <div v-if="isContactTab">
        <label class="text-foreground mb-2 block text-sm font-medium">
          验证码
        </label>
        <div class="flex items-stretch gap-3">
          <Input
            v-model:value="formState.verifyCode"
            class="flex-1"
            :placeholder="
              isPasswordMfaMode ? '请输入MFA验证码' : '请输入验证码'
            "
            size="large"
          />

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
        <span class="text-muted-foreground text-xs">
          <template v-if="techSupport"> 技术支持：{{ techSupport }} </template>
          <template v-else>
            <template v-if="isCaptchaTab"> 登录后将进行安全验证 </template>
            <template v-else>
              当前使用 {{ verifyCodeUsageText }} 验证码
            </template>
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

    <Modal
      :cancel-text="'取消'"
      :closable="!authStore.loginLoading"
      :confirm-loading="authStore.loginLoading"
      :mask-closable="!authStore.loginLoading"
      :ok-text="$t('common.login')"
      :open="passwordVerifyDialogOpen"
      :title="isPasswordMfaMode ? 'Google 验证器验证' : '安全验证'"
      centered
      destroy-on-close
      @cancel="resetPasswordLoginChallenge"
      @ok="completePasswordLogin"
      @update:open="handlePasswordVerifyDialogOpenChange"
    >
      <div class="space-y-4" @keydown.enter.prevent="completePasswordLogin">
        <Alert
          :message="
            isPasswordMfaMode
              ? '请打开 Google Authenticator，输入当前显示的 6 位验证码。'
              : '请输入图片中的验证码以完成登录。'
          "
          show-icon
          type="info"
        />

        <div>
          <label class="text-foreground mb-2 block text-sm font-medium">
            {{ isPasswordMfaMode ? 'Google 验证器验证码' : '验证码' }}
          </label>
          <div class="flex items-stretch gap-3">
            <Input
              v-model:value="formState.verifyCode"
              class="flex-1"
              :placeholder="
                isPasswordMfaMode
                  ? '请输入 Google 验证器验证码'
                  : '请输入验证码'
              "
              size="large"
              @update:value="clearAutoLoginCountdown"
            />

            <Tooltip v-if="isPasswordCaptchaMode" title="刷新验证码">
              <span class="inline-flex">
                <button
                  :aria-busy="verifyAssetLoading"
                  :disabled="verifyAssetLoading"
                  aria-label="刷新验证码"
                  class="border-border bg-muted text-muted-foreground hover:border-primary hover:text-primary flex h-10 min-w-[116px] items-center justify-center overflow-hidden rounded-md border transition disabled:cursor-not-allowed disabled:opacity-70"
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
          </div>
          <p
            v-if="isPasswordCaptchaMode && autoLoginCountdown > 0"
            class="text-muted-foreground mt-2 text-xs"
          >
            验证码已自动填入，
            <span
              data-test="auto-login-countdown"
              class="text-destructive inline-block text-lg font-semibold tabular-nums leading-none motion-safe:animate-bounce"
            >
              {{ autoLoginCountdown }}
            </span>
            秒后将自动登录。
          </p>
        </div>
      </div>
    </Modal>
  </div>
</template>
