<script lang="ts" setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { useAuthStore } from '@levin/admin-framework/framework-commons/app/store';
import { Alert, Button, Input } from 'ant-design-vue';

import {
  getServiceRespMessage,
  isServiceResp,
} from '../../../api/service-resp';

defineOptions({ name: 'Register' });

type VerifyType = 'Captcha' | 'Email' | 'Sms';

const authStore = useAuthStore();
const registrationEnabled = ref(false);
const optionsLoading = ref(true);
const optionsError = ref('');

async function loadLoginOptions() {
  optionsLoading.value = true;
  optionsError.value = '';
  registrationEnabled.value = false;
  try {
    const options = await rbacService.getLoginOptions();
    if (active) registrationEnabled.value = options.enableUserRegister === true;
  } catch (error) {
    if (active)
      optionsError.value = failureMessage(error, '登录选项加载失败，请重试');
  } finally {
    if (active) optionsLoading.value = false;
  }
}

onMounted(loadLoginOptions);
const form = reactive({
  account: '',
  confirmPassword: '',
  password: '',
  verifyCode: '',
});
const account = computed(() => form.account.replaceAll(/\s/g, ''));
const loading = ref(false);
const codeLoading = ref(false);
const errorMessage = ref('');
const captchaImage = ref('');
const codeAccount = ref('');
const verifyType = ref<VerifyType>();
const mockCodeFilled = ref(false);
const countdown = ref(0);
// 注册成功后只允许重试登录收尾，不能再次提交创建请求。
const registrationToken = ref('');
let requestVersion = 0;
let active = true;
let countdownTimer: ReturnType<typeof setInterval> | undefined;

const codeHint = computed(() => {
  if (mockCodeFilled.value) return '测试验证码已填入';
  if (verifyType.value === 'Sms') return '短信验证码已发送，请查收。';
  if (verifyType.value === 'Email') return '邮箱验证码已发送，请查收。';
  return '普通账号使用图片验证码，手机号或邮箱使用对应验证码。';
});

function failureMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    if (isServiceResp(response?.data))
      return getServiceRespMessage(response.data);
  }
  if (isServiceResp(error)) return getServiceRespMessage(error);
  return error instanceof Error ? error.message : fallback;
}

function resetVerification() {
  requestVersion += 1;
  codeLoading.value = false;
  codeAccount.value = '';
  verifyType.value = undefined;
  form.verifyCode = '';
  captchaImage.value = '';
  mockCodeFilled.value = false;
  countdown.value = 0;
  clearInterval(countdownTimer);
}

watch(account, () => {
  resetVerification();
  errorMessage.value = '';
});

async function requestCode() {
  if (!registrationEnabled.value || optionsLoading.value) return;
  if (
    codeLoading.value ||
    loading.value ||
    countdown.value ||
    registrationToken.value
  )
    return;
  const requestedAccount = account.value;
  if (!requestedAccount) {
    errorMessage.value = '请先填写注册账号';
    return;
  }
  resetVerification();
  const version = requestVersion;
  codeLoading.value = true;
  errorMessage.value = '';
  try {
    // 账号类型由后端判断，不能在前端把手机号或邮箱降级为图片验证码。
    const result = await rbacService.getVerifyCode({
      account: requestedAccount,
    });
    if (
      !active ||
      version !== requestVersion ||
      requestedAccount !== account.value
    )
      return;
    if (!['Captcha', 'Email', 'Sms'].includes(result.type || '')) {
      throw new Error('当前验证码类型不支持注册');
    }
    const mime = result.interactionDataType || 'image/png';
    if (
      typeof result.interactionData === 'string' &&
      /^image\/(?:gif|jpeg|png|webp)$/.test(mime)
    ) {
      captchaImage.value = `data:${mime};base64,${result.interactionData}`;
    }
    if (result.mock === true && result.code) {
      form.verifyCode = result.code;
      mockCodeFilled.value = true;
    }
    if (
      result.type === 'Captcha' &&
      !captchaImage.value &&
      !mockCodeFilled.value
    ) {
      throw new Error('未获取到验证码图片，请重试');
    }
    codeAccount.value = requestedAccount;
    verifyType.value = result.type as VerifyType;
    if (result.type !== 'Captcha') {
      countdown.value = 60;
      countdownTimer = setInterval(() => {
        countdown.value -= 1;
        if (countdown.value <= 0) clearInterval(countdownTimer);
      }, 1000);
    }
  } catch (error) {
    if (active && version === requestVersion) {
      errorMessage.value = failureMessage(error, '获取验证码失败，请重试');
    }
  } finally {
    if (active && version === requestVersion) codeLoading.value = false;
  }
}

async function handleSubmit() {
  if (
    !registrationToken.value &&
    (!registrationEnabled.value || optionsLoading.value)
  )
    return;
  if (loading.value || codeLoading.value) return;
  errorMessage.value = '';
  if (!registrationToken.value) {
    if (!account.value || !form.password || !form.confirmPassword) {
      errorMessage.value = '请填写账号、密码和确认密码';
      return;
    }
    if (form.password !== form.confirmPassword) {
      errorMessage.value = '两次输入的密码不一致';
      return;
    }
    if (
      codeAccount.value !== account.value ||
      !verifyType.value ||
      !form.verifyCode.trim()
    ) {
      errorMessage.value = '请为当前账号获取并填写验证码';
      return;
    }
  }
  loading.value = true;
  try {
    if (!registrationToken.value) {
      const result = await rbacService.register({
        account: account.value,
        name: account.value,
        password: form.password,
        verifyCode: form.verifyCode.trim(),
        verifyCodeType: verifyType.value,
      });
      if (!active) return;
      if (!result.accessToken)
        throw new Error('注册未返回登录凭据，请使用登录页确认账号状态');
      registrationToken.value = result.accessToken;
      form.password = '';
      form.confirmPassword = '';
      form.verifyCode = '';
    }
    await authStore.authLoginWithAccessToken(registrationToken.value);
  } catch (error) {
    if (active) {
      errorMessage.value = failureMessage(error, '注册或登录失败，请重试');
      if (!registrationToken.value) resetVerification();
    }
  } finally {
    if (active) loading.value = false;
  }
}

onBeforeUnmount(() => {
  active = false;
  resetVerification();
  form.password = '';
  form.confirmPassword = '';
  registrationToken.value = '';
});
</script>

<template>
  <div class="w-full">
    <h1 class="text-foreground mb-3 text-3xl font-semibold">注册账号</h1>
    <p class="text-muted-foreground mb-6 text-sm">
      验证账号后注册，成功后自动登录。
    </p>
    <Alert v-if="optionsLoading" message="正在加载登录选项…" type="info" />
    <div v-else-if="optionsError" class="space-y-3">
      <Alert :message="optionsError" type="error" role="alert" />
      <Button @click="loadLoginOptions">重新加载</Button>
      <a class="text-primary block" href="/auth/login">返回登录</a>
    </div>
    <div
      v-else-if="!registrationEnabled && !registrationToken"
      class="space-y-3"
    >
      <Alert message="当前站点未开放用户注册" type="info" role="alert" />
      <a class="text-primary block" href="/auth/login">返回登录</a>
    </div>
    <form v-else class="space-y-4" @submit.prevent="handleSubmit">
      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        show-icon
        type="error"
        role="alert"
      />
      <div class="space-y-2">
        <label for="register-account" class="text-foreground block text-sm">
          <span>注册账号</span>
        </label>
        <Input
          id="register-account"
          v-model:value="form.account"
          :disabled="loading || !!registrationToken"
          autocomplete="username"
          placeholder="登录名、手机号或邮箱"
          size="large"
        />
      </div>
      <template v-if="!registrationToken">
        <div class="space-y-2">
          <label for="register-password" class="text-foreground block text-sm">
            <span>登录密码</span>
          </label>
          <Input.Password
            id="register-password"
            v-model:value="form.password"
            :disabled="loading"
            autocomplete="new-password"
            placeholder="请输入密码"
            size="large"
          />
        </div>
        <div class="space-y-2">
          <label
            for="register-confirm-password"
            class="text-foreground block text-sm"
          >
            <span>确认密码</span>
          </label>
          <Input.Password
            id="register-confirm-password"
            v-model:value="form.confirmPassword"
            :disabled="loading"
            autocomplete="new-password"
            placeholder="请再次输入密码"
            size="large"
          />
        </div>
        <div class="space-y-2">
          <label for="register-code" class="text-foreground block text-sm">
            <span>验证码</span>
          </label>
          <div class="flex gap-2">
            <Input
              id="register-code"
              v-model:value="form.verifyCode"
              :disabled="loading || codeLoading"
              autocomplete="one-time-code"
              placeholder="请输入验证码"
              size="large"
            />
            <Button
              :disabled="loading || codeLoading || countdown > 0 || !account"
              :loading="codeLoading"
              class="shrink-0"
              html-type="button"
              size="large"
              @click="requestCode"
            >
              {{ countdown > 0 ? `${countdown}s 后重试` : '获取验证码' }}
            </Button>
          </div>
          <button
            v-if="captchaImage"
            type="button"
            :disabled="codeLoading || loading"
            aria-label="刷新验证码图片"
            @click="requestCode"
          >
            <img :src="captchaImage" alt="注册验证码" class="h-12 rounded" />
          </button>
          <p class="text-muted-foreground text-xs">{{ codeHint }}</p>
        </div>
      </template>
      <Alert
        v-else
        message="账号已创建，请继续完成登录。"
        show-icon
        type="info"
      />
      <Button
        :disabled="loading || codeLoading"
        :loading="loading"
        block
        html-type="submit"
        size="large"
        type="primary"
      >
        {{ registrationToken ? '继续登录' : '注册并登录' }}
      </Button>
      <div class="text-muted-foreground flex justify-center gap-1 text-sm">
        <span>已有账号？</span>
        <a class="text-primary hover:underline" href="/auth/login">
          <span>去登录</span>
        </a>
      </div>
    </form>
  </div>
</template>
