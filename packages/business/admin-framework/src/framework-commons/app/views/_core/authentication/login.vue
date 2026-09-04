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
import { IconifyIcon } from '@vben/icons';

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
  oauthService,
  startPasswordLoginApi,
} from '@levin/admin-framework/framework-commons/app/api';
import { useAuthStore } from '@levin/admin-framework/framework-commons/app/store';

import { useAuthBrand } from './auth-brand';
import BehaviorCaptcha from './behavior-captcha.vue';
import {
  isSupportedBehaviorCaptchaMode,
  normalizeBehaviorCaptchaChallenge,
  type BehaviorCaptchaChallenge,
} from './behavior-captcha';
import {
  extractReturnedVerifyCode,
  resolveContactVerifyCodeType,
} from './login-verify-type';

defineOptions({ name: 'Login' });

type VerifyCodeTab = 'Captcha' | 'Contact';
type PasswordVerifyCodeType = 'Captcha' | 'Hmi' | 'Mfa';

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
const OAUTH_LOGIN_TRANSACTION_STORAGE_KEY = `LOGIN_OAUTH_TRANSACTION_${location.pathname}`;
const OAUTH_LOGIN_POLL_INTERVAL_MS = 1500;
const OAUTH_LOGIN_POLL_TIMEOUT_MS = 3 * 60 * 1000;

interface OAuthLoginPlatform {
  authUrl?: string;
  code: string;
  description: string;
  displayName: string;
  iconUrl: string;
}

const verifyTabs: VerifyCodeTabOption[] = [
  {
    description: '请输入账号和密码以继续登录。',
    key: 'Captcha',
    title: '密码登录',
  },
  {
    description: '输入手机号或邮箱后获取验证码。',
    key: 'Contact',
    title: '验证码登录',
  },
];

const defaultVerifyTab: VerifyCodeTabOption = verifyTabs[0]!;

const authStore = useAuthStore();
const rememberedAccount = localStorage.getItem(REMEMBER_ME_KEY) || '';
const isLoopbackBrowserHost = ['127.0.0.1', 'localhost'].includes(
  location.hostname,
);

const activeVerifyType = ref<VerifyCodeTab>('Captcha');
const passwordLoginChallengeId = ref('');
const passwordVerifyCodeType = ref<PasswordVerifyCodeType | undefined>();
const passwordVerifyDialogOpen = ref(false);
const captchaImage = ref('');
const hmiCaptchaChallenge = ref<BehaviorCaptchaChallenge | null>(null);

const passwordVerifyDialogWidth = computed(() => {
  if (!isPasswordHmiMode.value || !hmiCaptchaChallenge.value) {
    return undefined;
  }
  const challengeWidth =
    Number(hmiCaptchaChallenge.value.payload?.width) || 427;
  return Math.min(challengeWidth + 48, 700);
});
const countdown = ref(0);
const verifyAssetLoading = ref(false);
const rememberMe = ref(!!rememberedAccount);
const lastAutoLoginSignature = ref('');
const autoLoginCountdown = ref(0);
const oauthPlatformsLoading = ref(false);
const oauthPlatforms = ref<OAuthLoginPlatform[]>([]);
const oauthLoginModalOpen = ref(false);
const oauthLoginErrorMessage = ref('');
const oauthLoginStatusMessage = ref('');
const oauthLoginActivePlatform = ref<null | OAuthLoginPlatform>(null);
const oauthLoginActiveTransactionId = ref('');
const oauthLoginAuthorizeUrl = ref('');
const oauthTransactionSubmitting = ref(false);
const oauthTransactionExchanging = ref(false);
const oauthRemainingSeconds = ref(0);

let oauthPollingTimer: null | ReturnType<typeof setInterval> = null;
let oauthCountdownTimer: null | ReturnType<typeof setInterval> = null;
let oauthPollingInFlight = false;
let oauthPollingStartedAt = 0;
let oauthPopupWindow: null | Window = null;

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
const isPasswordHmiMode = computed(
  () =>
    isCaptchaTab.value &&
    !!passwordLoginChallengeId.value &&
    passwordVerifyCodeType.value === 'Hmi',
);
const isPasswordInteractiveVerifyMode = computed(
  () => isPasswordCaptchaMode.value || isPasswordHmiMode.value,
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

const isContactVerifyCodeRequestDisabled = computed(
  () => verifyAssetLoading.value || countdown.value > 0 || !normalizeAccount(),
);

const hasOAuthPlatforms = computed(() => oauthPlatforms.value.length > 0);
const oauthWaitProgress = computed(() =>
  Math.max(
    0,
    Math.round(
      (oauthRemainingSeconds.value / (OAUTH_LOGIN_POLL_TIMEOUT_MS / 1000)) *
        100,
    ),
  ),
);

function unwrapOAuthPayload<T extends Record<string, any> | null | undefined>(
  payload: T,
) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const nestedPayload = payload.data;
  if (
    nestedPayload &&
    typeof nestedPayload === 'object' &&
    [
      'accessToken',
      'authUrl',
      'authorizeUrl',
      'capabilities',
      'code',
      'id',
      'items',
      'loginTicket',
      'platform',
      'records',
      'status',
      'supports',
      'token',
    ].some((key) => key in nestedPayload)
  ) {
    return nestedPayload;
  }

  return payload;
}

function extractOAuthPlatforms(payload: any) {
  const normalizedPayload = unwrapOAuthPayload(payload);
  if (Array.isArray(normalizedPayload)) {
    return normalizedPayload;
  }

  if (Array.isArray(normalizedPayload?.items)) {
    return normalizedPayload.items;
  }

  if (Array.isArray(normalizedPayload?.records)) {
    return normalizedPayload.records;
  }

  if (Array.isArray(normalizedPayload?.data)) {
    return normalizedPayload.data;
  }

  return [];
}

function resolvePlatformCode(platform: Record<string, any>) {
  return String(
    platform.code || platform.platform || platform.id || platform.name || '',
  )
    .trim()
    .toUpperCase();
}

function resolvePlatformDisplayName(platform: Record<string, any>) {
  return String(
    platform.title ||
      platform.name ||
      platform.platformName ||
      platform.platform ||
      platform.code ||
      '第三方平台',
  ).trim();
}

function supportsOauthLogin(platform: Record<string, any>) {
  if (typeof platform.capabilities?.oauth === 'boolean') {
    return platform.capabilities.oauth;
  }

  const capabilityEntries = [
    ...(Array.isArray(platform.capabilities) ? platform.capabilities : []),
    ...(Array.isArray(platform.capability) ? platform.capability : []),
    ...(Array.isArray(platform.supports) ? platform.supports : []),
    platform.authType,
  ]
    .map((item) =>
      String(item || '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  if (capabilityEntries.length === 0) {
    return true;
  }

  return capabilityEntries.some((item) =>
    ['oauth', 'authorization', 'auth', 'qr_login', 'qr-login'].some((keyword) =>
      item.includes(keyword),
    ),
  );
}

function normalizeOAuthPlatform(
  platform: Record<string, any>,
): OAuthLoginPlatform | null {
  const code = resolvePlatformCode(platform);
  if (!code || !supportsOauthLogin(platform)) {
    return null;
  }

  return {
    authUrl: String(
      platform.authorizeUrl || platform.authUrl || platform.loginUrl || '',
    ).trim(),
    code,
    description: String(platform.description || '').trim(),
    displayName: resolvePlatformDisplayName(platform),
    iconUrl: String(platform.iconUrl || platform.icon || '').trim(),
  };
}

function resolveOAuthTransaction(payload: any) {
  return unwrapOAuthPayload(payload) || {};
}

function resolveOAuthExchangeResult(payload: any) {
  return unwrapOAuthPayload(payload) || {};
}

function resolveOAuthTransactionStatus(transaction: Record<string, any>) {
  return String(transaction.status || 'PENDING')
    .trim()
    .toUpperCase();
}

function resolveOAuthAuthorizeUrl(transaction: Record<string, any>) {
  return String(
    transaction.authorizeUrl ||
      transaction.authUrl ||
      transaction.qrCodeUrl ||
      transaction.providerData?.authorizeUrl ||
      transaction.providerData?.authUrl ||
      '',
  ).trim();
}

function resolveOAuthAccessToken(result: Record<string, any>) {
  return String(
    result.accessToken ||
      result.token ||
      result.data?.accessToken ||
      result.data?.token ||
      '',
  ).trim();
}

function buildOAuthLoginCallbackUrl() {
  if (typeof location.href === 'string' && location.href) {
    return location.href;
  }

  return `https://${location.hostname}/`;
}

function saveOAuthResumeTransaction(
  transactionId: string,
  platformCode: string,
  authorizeUrl: string,
) {
  sessionStorage.setItem(
    OAUTH_LOGIN_TRANSACTION_STORAGE_KEY,
    JSON.stringify({
      authorizeUrl,
      platformCode,
      transactionId,
    }),
  );
}

function readOAuthResumeTransaction() {
  const rawValue = sessionStorage.getItem(OAUTH_LOGIN_TRANSACTION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    const transactionId = String(parsedValue?.transactionId || '').trim();
    const platformCode = String(parsedValue?.platformCode || '').trim();

    if (!transactionId || !platformCode) {
      return null;
    }

    return {
      authorizeUrl: String(parsedValue?.authorizeUrl || '').trim(),
      platformCode: platformCode.toUpperCase(),
      transactionId,
    };
  } catch {
    return null;
  }
}

function clearOAuthResumeTransaction() {
  sessionStorage.removeItem(OAUTH_LOGIN_TRANSACTION_STORAGE_KEY);
}

function consumeOAuthCallbackError() {
  if (typeof location.href !== 'string' || !location.href) {
    return false;
  }

  const callbackUrl = new URL(location.href);
  const errorMessage = callbackUrl.searchParams.get('oauthError');
  if (!errorMessage) {
    return false;
  }

  clearOAuthResumeTransaction();
  callbackUrl.searchParams.delete('oauthError');
  window.history.replaceState({}, '', callbackUrl.toString());
  message.error(errorMessage);
  return true;
}

function clearOAuthPolling() {
  if (oauthPollingTimer) {
    clearInterval(oauthPollingTimer);
    oauthPollingTimer = null;
  }
  if (oauthCountdownTimer) {
    clearInterval(oauthCountdownTimer);
    oauthCountdownTimer = null;
  }
  oauthPollingStartedAt = 0;
  oauthRemainingSeconds.value = 0;
}

function formatOAuthRemainingTime() {
  const minutes = Math.floor(oauthRemainingSeconds.value / 60);
  const seconds = oauthRemainingSeconds.value % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function closeOAuthPopupWindow() {
  if (oauthPopupWindow && !oauthPopupWindow.closed) {
    oauthPopupWindow.close();
  }
  oauthPopupWindow = null;
}

function resetOAuthLoginState(options: { keepDialog?: boolean } = {}) {
  clearOAuthPolling();
  oauthPollingInFlight = false;
  oauthTransactionExchanging.value = false;
  oauthTransactionSubmitting.value = false;
  oauthLoginActivePlatform.value = null;
  oauthLoginActiveTransactionId.value = '';
  oauthLoginAuthorizeUrl.value = '';
  oauthLoginStatusMessage.value = '';
  oauthLoginErrorMessage.value = '';
  if (!options.keepDialog) {
    oauthLoginModalOpen.value = false;
  }
  closeOAuthPopupWindow();
}

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

  if (isCaptchaTab.value && !isPasswordInteractiveVerifyMode.value) {
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

    if (isPasswordHmiMode.value) {
      const interactionData = payload?.interactionData;
      const interactionSource =
        typeof interactionData === 'string'
          ? JSON.parse(interactionData)
          : interactionData;
      const interaction = normalizeBehaviorCaptchaChallenge(interactionSource);

      if (!interaction) {
        const mode = String(
          interactionSource && typeof interactionSource === 'object'
            ? interactionSource.mode || interactionSource.type || ''
            : '',
        ).trim();
        if (mode && !isSupportedBehaviorCaptchaMode(mode)) {
          message.warning('当前行为验证码类型暂不支持');
        } else {
          message.error('当前没有获取到人机验证码');
        }
        resetPasswordLoginChallenge();
        return;
      }

      hmiCaptchaChallenge.value = interaction;
      return;
    }

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
    const isHmiRequest = isPasswordHmiMode.value;
    if (isPasswordInteractiveVerifyMode.value) {
      captchaImage.value = '';
      hmiCaptchaChallenge.value = null;
    }
    if (isHmiRequest) {
      resetPasswordLoginChallenge();
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

async function completePasswordLogin(verifyCodeValue?: unknown) {
  if (authStore.loginLoading || !passwordLoginChallengeId.value) {
    return;
  }

  clearAutoLoginCountdown();

  // Ant Design Modal 的 ok 回调会传入 MouseEvent；不能让它覆盖输入框验证码。
  const verifyCode =
    typeof verifyCodeValue === 'string'
      ? verifyCodeValue.trim()
      : formState.verifyCode.trim();
  if (!verifyCode) {
    message.warning(
      isPasswordMfaMode.value
        ? '请输入 MFA 验证码'
        : isPasswordHmiMode.value
          ? '请先完成行为验证码'
          : '请输入验证码',
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
  } catch (error) {
    if (shouldRefreshVerifyCodeForLoginError(error)) {
      formState.verifyCode = '';
      lastAutoLoginSignature.value = '';
      await startPasswordLogin(account, formState.password.trim(), {
        autoLogin: false,
      });
      return;
    }

    resetPasswordLoginChallenge();
  }
}

function completePasswordLoginWithHmiVerifyCode(verifyCode: unknown) {
  if (typeof verifyCode !== 'string') {
    return;
  }
  formState.verifyCode = verifyCode;
  void completePasswordLogin(verifyCode);
}

function handlePasswordVerifyCodeInput(value: string) {
  clearAutoLoginCountdown();

  const verifyCode = isPasswordMfaMode.value
    ? String(value || '')
        .replaceAll(/\D/g, '')
        .slice(0, 6)
    : value;

  if (formState.verifyCode !== verifyCode) {
    formState.verifyCode = verifyCode;
  }

  if (
    isPasswordMfaMode.value &&
    verifyCode.length === 6 &&
    !authStore.loginLoading
  ) {
    void completePasswordLogin(verifyCode);
  }
}

async function startPasswordLogin(
  account: string,
  password: string,
  options: RequestVerifyCodeOptions = {},
) {
  try {
    verifyAssetLoading.value = true;
    const challenge = await startPasswordLoginApi({ account, password });

    passwordLoginChallengeId.value = challenge.challengeId;
    passwordVerifyCodeType.value = challenge.verifyCodeType;
    formState.verifyCode = '';
    captchaImage.value = '';
    hmiCaptchaChallenge.value = null;

    localStorage.setItem(REMEMBER_ME_KEY, rememberMe.value ? account : '');

    if (
      challenge.verifyCodeType === 'Captcha' ||
      challenge.verifyCodeType === 'Hmi'
    ) {
      passwordVerifyDialogOpen.value = true;
      await requestVerifyCode({
        autoLogin: options.autoLogin,
        force: true,
      });
      if (!passwordLoginChallengeId.value) {
        return;
      }
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
  hmiCaptchaChallenge.value = null;
  lastAutoLoginSignature.value = '';
}

function handlePasswordVerifyDialogOpenChange(open: boolean) {
  if (!open) {
    resetPasswordLoginChallenge();
    return;
  }

  passwordVerifyDialogOpen.value = true;
}

async function loadOAuthPlatforms() {
  try {
    oauthPlatformsLoading.value = true;
    const rawPlatforms = extractOAuthPlatforms(
      await oauthService.getSupportedPlatforms(),
    );

    oauthPlatforms.value = rawPlatforms
      .map((platform) => normalizeOAuthPlatform(platform))
      .filter((platform): platform is OAuthLoginPlatform => Boolean(platform));
  } catch (error: any) {
    oauthPlatforms.value = [];
    message.error(error?.message || '加载第三方登录平台失败');
  } finally {
    oauthPlatformsLoading.value = false;
  }
}

function findOAuthPlatform(platformCode: string) {
  return (
    oauthPlatforms.value.find((platform) => platform.code === platformCode) ||
    null
  );
}

function openOAuthAuthorizeWindow(authorizeUrl: string) {
  const popup = window.open(
    'about:blank',
    'oauth-login',
    'popup=yes,width=720,height=780',
  );

  if (popup) {
    // `noopener`/`noreferrer` may return null even when the popup opened,
    // which would incorrectly trigger the full-page fallback and open two pages.
    popup.opener = null;
    popup.location.replace(authorizeUrl);
    oauthPopupWindow = popup;
    oauthLoginStatusMessage.value = `已打开【${oauthLoginActivePlatform.value?.displayName || '第三方平台'}】授权窗口，请在新窗口完成授权并等待登录结果。`;
    return;
  }

  message.warning('浏览器拦截了授权窗口，请允许弹窗后再试。');
  oauthLoginErrorMessage.value = '';
  oauthLoginStatusMessage.value = '';
}

async function finishOAuthLoginTransaction(transactionId: string) {
  if (oauthTransactionExchanging.value) {
    return;
  }

  oauthTransactionExchanging.value = true;

  try {
    const exchangeResult = resolveOAuthExchangeResult(
      await oauthService.exchangeTransaction(transactionId),
    );
    const accessToken = resolveOAuthAccessToken(exchangeResult);

    if (!accessToken) {
      throw new Error('第三方授权已完成，但没有取回访问令牌');
    }

    clearOAuthResumeTransaction();
    resetOAuthLoginState();
    await authStore.authLoginWithAccessToken(accessToken);
  } catch (error: any) {
    oauthLoginErrorMessage.value =
      error?.message || '兑换第三方授权结果失败，请稍后重试';
    oauthLoginStatusMessage.value = oauthLoginErrorMessage.value;
    message.error(oauthLoginErrorMessage.value);
  } finally {
    oauthTransactionExchanging.value = false;
  }
}

async function pollOAuthLoginTransaction(transactionId: string) {
  if (oauthPollingInFlight || oauthTransactionExchanging.value) {
    return;
  }

  oauthPollingInFlight = true;

  try {
    const transaction = resolveOAuthTransaction(
      await oauthService.getTransaction(transactionId),
    );
    const status = resolveOAuthTransactionStatus(transaction);
    const transactionMessage = String(
      transaction.message || transaction.errorMessage || '',
    ).trim();

    if (transactionMessage) {
      oauthLoginStatusMessage.value = transactionMessage;
    }

    if (['AUTHORIZED', 'COMPLETED', 'EXCHANGED'].includes(status)) {
      clearOAuthPolling();
      await finishOAuthLoginTransaction(transactionId);
      return;
    }

    if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(status)) {
      clearOAuthPolling();
      clearOAuthResumeTransaction();
      message.warning(transactionMessage || '第三方授权未完成');
      oauthLoginErrorMessage.value = '';
      oauthLoginStatusMessage.value = '';
      oauthLoginModalOpen.value = false;
      closeOAuthPopupWindow();
      return;
    }

    if (
      oauthPopupWindow?.closed &&
      !oauthLoginStatusMessage.value.includes('关闭')
    ) {
      await cancelOAuthLoginTransaction(transactionId);
    }
  } catch (error: any) {
    const errorText = getErrorSearchText(error);
    if (errorText.includes('第三方登录事务已失效')) {
      clearOAuthPolling();
      clearOAuthResumeTransaction();
      message.warning('第三方授权事务已失效');
      oauthLoginErrorMessage.value = '';
      oauthLoginStatusMessage.value = '';
      oauthLoginModalOpen.value = false;
      return;
    }

    oauthLoginStatusMessage.value =
      error?.message || '获取第三方授权状态失败，正在重试...';
  } finally {
    oauthPollingInFlight = false;
  }
}

async function cancelOAuthLoginTransaction(transactionId: string) {
  clearOAuthPolling();
  clearOAuthResumeTransaction();
  try {
    await oauthService.cancelTransaction(transactionId, {
      __silentError: true,
    });
  } catch {
    // 事务可能已由授权回调完成或超时，前端仍应结束等待状态。
  }
  message.info('已取消第三方登录。');
  oauthLoginErrorMessage.value = '';
  oauthLoginStatusMessage.value = '';
  oauthLoginModalOpen.value = false;
  closeOAuthPopupWindow();
}

function beginOAuthLoginPolling(transactionId: string) {
  clearOAuthPolling();
  oauthPollingStartedAt = Date.now();
  oauthRemainingSeconds.value = OAUTH_LOGIN_POLL_TIMEOUT_MS / 1000;
  oauthCountdownTimer = setInterval(() => {
    oauthRemainingSeconds.value = Math.max(
      0,
      Math.ceil(
        (OAUTH_LOGIN_POLL_TIMEOUT_MS - (Date.now() - oauthPollingStartedAt)) /
          1000,
      ),
    );
  }, 1000);
  oauthLoginActiveTransactionId.value = transactionId;
  oauthPollingTimer = setInterval(() => {
    if (Date.now() - oauthPollingStartedAt >= OAUTH_LOGIN_POLL_TIMEOUT_MS) {
      clearOAuthPolling();
      clearOAuthResumeTransaction();
      message.warning('第三方授权已超时');
      oauthLoginErrorMessage.value = '';
      oauthLoginStatusMessage.value = '';
      oauthLoginModalOpen.value = false;
      closeOAuthPopupWindow();
      return;
    }
    void pollOAuthLoginTransaction(transactionId);
  }, OAUTH_LOGIN_POLL_INTERVAL_MS);
  void pollOAuthLoginTransaction(transactionId);
}

async function startOAuthLogin(platform: OAuthLoginPlatform) {
  if (oauthTransactionSubmitting.value || authStore.loginLoading) {
    return;
  }

  try {
    oauthTransactionSubmitting.value = true;
    oauthLoginModalOpen.value = true;
    oauthLoginErrorMessage.value = '';
    oauthLoginStatusMessage.value = '正在创建第三方授权事务...';
    oauthLoginActivePlatform.value = platform;

    const transaction = resolveOAuthTransaction(
      await oauthService.createTransaction({
        callbackUrl: buildOAuthLoginCallbackUrl(),
        platform: platform.code,
        purpose: 'LOGIN',
      }),
    );
    const transactionId = String(
      transaction.transactionId || transaction.id || '',
    ).trim();
    const authorizeUrl =
      resolveOAuthAuthorizeUrl(transaction) || platform.authUrl;

    if (!transactionId) {
      throw new Error('创建第三方授权事务失败：缺少事务编号');
    }

    if (!authorizeUrl) {
      throw new Error('创建第三方授权事务失败：缺少授权地址');
    }

    oauthLoginAuthorizeUrl.value = authorizeUrl;
    saveOAuthResumeTransaction(transactionId, platform.code, authorizeUrl);
    beginOAuthLoginPolling(transactionId);
    openOAuthAuthorizeWindow(authorizeUrl);
  } catch (error: any) {
    oauthLoginErrorMessage.value =
      error?.message || '发起第三方授权失败，请稍后重试';
    oauthLoginStatusMessage.value = oauthLoginErrorMessage.value;
    message.error(oauthLoginErrorMessage.value);
  } finally {
    oauthTransactionSubmitting.value = false;
  }
}

function cancelOAuthLogin() {
  clearOAuthResumeTransaction();
  resetOAuthLoginState();
}

function reopenOAuthLoginWindow() {
  const platform = oauthLoginActivePlatform.value;
  if (!platform) {
    return;
  }

  clearOAuthResumeTransaction();
  resetOAuthLoginState({ keepDialog: true });
  void startOAuthLogin(platform);
}

function resumeOAuthLoginFromStorage() {
  const pendingTransaction = readOAuthResumeTransaction();
  if (!pendingTransaction) {
    return;
  }

  oauthLoginModalOpen.value = true;
  oauthLoginErrorMessage.value = '';
  oauthLoginStatusMessage.value = '正在恢复第三方授权状态...';
  oauthLoginAuthorizeUrl.value = pendingTransaction.authorizeUrl;
  oauthLoginActivePlatform.value = findOAuthPlatform(
    pendingTransaction.platformCode,
  ) || {
    authUrl: pendingTransaction.authorizeUrl,
    code: pendingTransaction.platformCode,
    description: '',
    displayName: pendingTransaction.platformCode,
    iconUrl: '',
  };
  beginOAuthLoginPolling(pendingTransaction.transactionId);
}

watch(activeVerifyType, () => {
  resetPasswordLoginChallenge();
  clearCountdown();
  countdown.value = 0;
});

onMounted(() => {
  loginPageActive = true;
  const hasOAuthCallbackError = consumeOAuthCallbackError();
  void loadOAuthPlatforms().finally(() => {
    if (!hasOAuthCallbackError) {
      resumeOAuthLoginFromStorage();
    }
  });
});

onActivated(() => {
  loginPageActive = true;
  if (!oauthLoginActiveTransactionId.value) {
    resumeOAuthLoginFromStorage();
  }
});

onDeactivated(() => {
  loginPageActive = false;
  clearAutoLoginCountdown();
  clearOAuthPolling();
});

onBeforeUnmount(() => {
  loginPageActive = false;
  clearCountdown();
  clearAutoLoginCountdown();
  resetOAuthLoginState({ keepDialog: true });
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
            :disabled="isContactVerifyCodeRequestDisabled"
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
        <span v-if="isCaptchaTab" class="text-muted-foreground text-xs">
          登录后将进行安全验证
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

      <div
        v-if="hasOAuthPlatforms"
        data-test="oauth-login-section"
        class="border-border mt-3 border-t pt-4"
      >
        <div class="text-muted-foreground mb-3 text-sm">其它第3方登录</div>

        <div class="flex flex-wrap gap-3">
          <Tooltip
            v-for="platform in oauthPlatforms"
            :key="platform.code"
            :title="platform.description || platform.displayName"
          >
            <Button
              :aria-label="platform.displayName"
              :disabled="oauthTransactionSubmitting"
              class="size-11 !p-0"
              html-type="button"
              shape="circle"
              @click="startOAuthLogin(platform)"
            >
              <img
                v-if="platform.iconUrl"
                :alt="`${platform.displayName} 图标`"
                :src="platform.iconUrl"
                class="size-6 rounded-sm object-cover"
              />
              <IconifyIcon
                v-else
                aria-hidden="true"
                class="size-6"
                icon="lucide:scan-line"
              />
            </Button>
          </Tooltip>
        </div>

        <Alert
          v-if="oauthLoginStatusMessage"
          class="mt-3"
          :message="oauthLoginStatusMessage"
          show-icon
          type="info"
        />
      </div>
    </div>

    <Modal
      :cancel-text="'取消等待'"
      :closable="!oauthTransactionExchanging"
      :confirm-loading="oauthTransactionExchanging"
      :footer="null"
      :mask-closable="false"
      :open="oauthLoginModalOpen"
      :title="`等待【${oauthLoginActivePlatform?.displayName || '第三方平台'}】授权登录`"
      centered
      @cancel="cancelOAuthLogin"
      @update:open="(open) => !open && cancelOAuthLogin()"
    >
      <div class="space-y-5 py-2">
        <Alert
          v-if="!isPasswordHmiMode"
          :message="
            oauthLoginErrorMessage ||
            oauthLoginStatusMessage ||
            `请在【${oauthLoginActivePlatform?.displayName || '第三方平台'}】授权窗口完成授权，当前页面将自动完成登录。`
          "
          show-icon
          :type="oauthLoginErrorMessage ? 'warning' : 'info'"
        />
        <div v-if="!oauthLoginErrorMessage" class="space-y-3">
          <div class="flex items-center justify-center gap-3 text-sm">
            <IconifyIcon
              aria-label="正在等待授权"
              class="text-primary size-7 animate-spin"
              icon="lucide:loader-circle"
            />
            <span class="text-muted-foreground">
              正在等待【{{
                oauthLoginActivePlatform?.displayName || '第三方平台'
              }}】授权结果
            </span>
          </div>
          <div
            aria-label="第三方授权剩余时间"
            class="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            :aria-valuenow="oauthWaitProgress"
            aria-valuemax="100"
            aria-valuemin="0"
          >
            <div
              class="bg-primary h-full rounded-full transition-all duration-1000"
              :style="{ width: `${oauthWaitProgress}%` }"
            />
          </div>
          <div class="text-muted-foreground text-center text-xs">
            剩余等待时间 {{ formatOAuthRemainingTime() }}
          </div>
        </div>
      </div>
      <div class="mt-4 flex justify-end">
        <Button @click="cancelOAuthLogin">取消</Button>
      </div>
    </Modal>

    <Modal
      :cancel-text="'取消'"
      :closable="!authStore.loginLoading"
      :confirm-loading="authStore.loginLoading"
      :ok-button-props="{
        disabled: isPasswordHmiMode,
        style: isPasswordHmiMode ? { display: 'none' } : undefined,
      }"
      :mask-closable="!authStore.loginLoading"
      :ok-text="isPasswordHmiMode ? '完成验证后自动登录' : $t('common.login')"
      :open="passwordVerifyDialogOpen"
      :title="isPasswordMfaMode ? 'MFA 验证' : '安全验证'"
      :width="passwordVerifyDialogWidth"
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
              ? '请使用 Microsoft Authenticator 或其他兼容 TOTP 的认证器，输入当前显示的 6 位 MFA 验证码。'
              : isPasswordHmiMode
                ? '验证通过后将自动登录。'
                : '请输入图片中的验证码以完成登录。'
          "
          show-icon
          type="info"
        />

        <div :class="isPasswordHmiMode ? '' : undefined">
          <label
            v-if="!isPasswordHmiMode"
            class="text-foreground mb-2 block text-sm font-medium"
          >
            {{
              isPasswordMfaMode
                ? 'MFA 验证码'
                : isPasswordHmiMode
                  ? '行为验证'
                  : '验证码'
            }}
          </label>
          <BehaviorCaptcha
            v-if="isPasswordHmiMode"
            :challenge="hmiCaptchaChallenge"
            :loading="verifyAssetLoading || authStore.loginLoading"
            @complete="completePasswordLoginWithHmiVerifyCode"
            @refresh="() => requestVerifyCode({ force: true })"
          />
          <div class="flex items-stretch gap-3">
            <Input
              v-if="!isPasswordHmiMode"
              :value="formState.verifyCode"
              class="flex-1"
              :inputmode="isPasswordMfaMode ? 'numeric' : undefined"
              :maxlength="isPasswordMfaMode ? 6 : undefined"
              :placeholder="
                isPasswordMfaMode ? '请输入 MFA 验证码' : '请输入验证码'
              "
              size="large"
              @update:value="handlePasswordVerifyCodeInput"
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
