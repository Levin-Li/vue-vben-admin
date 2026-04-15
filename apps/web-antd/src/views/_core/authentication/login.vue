<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import { $t } from '@vben/locales';

import {
  Alert,
  Button,
  Checkbox,
  Input,
  message,
  Tabs,
} from 'ant-design-vue';

import { getVerifyCodeApi } from '#/api';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

type VerifyCodeTab = 'Captcha' | 'Email' | 'Mfa' | 'Sms';

interface VerifyCodeTabOption {
  description: string;
  key: VerifyCodeTab;
  title: string;
}

const REMEMBER_ME_KEY = `REMEMBER_ME_USERNAME_${location.hostname}`;

const verifyTabs: VerifyCodeTabOption[] = [
  {
    description: '输入账号和密码后，填写图片中的验证码登录。',
    key: 'Captcha',
    title: '图片验证码',
  },
  {
    description: '验证码会发送到账号绑定的手机，密码可选。',
    key: 'Sms',
    title: '手机短信',
  },
  {
    description: '验证码会发送到账号绑定的邮箱，密码可选。',
    key: 'Email',
    title: '邮箱验证码',
  },
  {
    description: '请输入身份验证器中的动态验证码。',
    key: 'Mfa',
    title: 'MFA',
  },
];

const defaultVerifyTab: VerifyCodeTabOption = verifyTabs[0]!;

const authStore = useAuthStore();
const rememberedAccount = localStorage.getItem(REMEMBER_ME_KEY) || '';

const activeVerifyType = ref<VerifyCodeTab>('Captcha');
const captchaImage = ref('');
const countdown = ref(0);
const verifyAssetLoading = ref(false);
const rememberMe = ref(!!rememberedAccount);

const formState = reactive({
  account: rememberedAccount || 'sa',
  password: '123456',
  verifyCode: '',
  verifyCodeType: 'Captcha' as VerifyCodeTab,
});

let countdownTimer: null | ReturnType<typeof setInterval> = null;

const currentTab = computed<VerifyCodeTabOption>(() => {
  return verifyTabs.find((item) => item.key === activeVerifyType.value) || defaultVerifyTab;
});

const isCaptchaTab = computed(() => activeVerifyType.value === 'Captcha');

const isSendCodeTab = computed(
  () =>
    activeVerifyType.value === 'Sms' || activeVerifyType.value === 'Email',
);

const passwordOptional = computed(() => isSendCodeTab.value);

const actionButtonText = computed(() => {
  if (verifyAssetLoading.value) {
    return '加载中...';
  }

  if (countdown.value > 0) {
    return `${countdown.value}s 后重试`;
  }

  return isCaptchaTab.value ? '刷新验证码' : '获取验证码';
});

function normalizeAccount() {
  return formState.account.trim();
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

function unwrapVerifyCodeResponse(payload: any) {
  if (payload?.interactionData || payload?.type) {
    return payload;
  }

  return payload?.data ?? payload;
}

function resolveVerifyCodePayload(payload: any) {
  const current = unwrapVerifyCodeResponse(payload);

  if (current?.interactionData || current?.type) {
    return current;
  }

  if (current?.data?.interactionData || current?.data?.type) {
    return current.data;
  }

  return current;
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

async function requestVerifyCode() {
  const account = normalizeAccount();

  if (!account) {
    message.warning('请先输入登录账号');
    return;
  }

  if (!isCaptchaTab.value && countdown.value > 0) {
    return;
  }

  try {
    verifyAssetLoading.value = true;
    const payload = resolveVerifyCodePayload(
      await getVerifyCodeApi({
        account,
        verifyCodeType: activeVerifyType.value,
      }),
    );

    if (isCaptchaTab.value) {
      const interactionData = String(payload?.interactionData || '').trim();
      const interactionDataType = String(payload?.interactionDataType || '').trim();

      captchaImage.value =
        interactionData
          ? `data:${resolveImageMimeType(interactionData, interactionDataType)};base64,${interactionData}`
          : '';

      if (!captchaImage.value) {
        message.warning('当前没有获取到验证码图片');
      }
      return;
    }

    startCountdown();

    if (payload?.mock && payload?.code) {
      message.success(`验证码已生成：${payload.code}`);
      return;
    }

    message.success(`${currentTab.value.title}已发送，请注意查收`);
  } catch (error: any) {
    if (isCaptchaTab.value) {
      captchaImage.value = '';
    }
    message.error(error?.message || '获取验证码失败');
  } finally {
    verifyAssetLoading.value = false;
  }
}

function handleAccountBlur() {
  if (isCaptchaTab.value) {
    void requestVerifyCode();
  }
}

async function handleSubmit() {
  const account = normalizeAccount();
  const verifyCode = formState.verifyCode.trim();
  const password = formState.password.trim();

  if (!account) {
    message.warning('请输入登录账号');
    return;
  }

  if (!passwordOptional.value && !password) {
    message.warning('请输入登录密码');
    return;
  }

  if (!verifyCode) {
    message.warning('请输入验证码');
    return;
  }

  localStorage.setItem(REMEMBER_ME_KEY, rememberMe.value ? account : '');

  await authStore.authLogin({
    account,
    password: password || undefined,
    verifyCode,
    verifyCodeType: activeVerifyType.value,
  });
}

watch(activeVerifyType, (value) => {
  formState.verifyCode = '';
  formState.verifyCodeType = value;
  captchaImage.value = '';
  clearCountdown();
  countdown.value = 0;

  if (value === 'Captcha') {
    void requestVerifyCode();
  }
});

onMounted(() => {
  formState.verifyCodeType = activeVerifyType.value;
  if (isCaptchaTab.value) {
    void requestVerifyCode();
  }
});

onBeforeUnmount(() => {
  clearCountdown();
});
</script>

<template>
  <div class="w-full">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-foreground">
        {{ $t('authentication.welcomeBack') }}
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">
        请输入账号信息，并按验证码方式完成登录。
      </p>
    </div>

    <Tabs v-model:activeKey="activeVerifyType">
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
          placeholder="请输入登录账号/手机号/邮箱"
          size="large"
          @blur="handleAccountBlur"
        />
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <label class="block text-sm font-medium text-foreground">
            登录密码
          </label>
          <span v-if="passwordOptional" class="text-xs text-muted-foreground">
            当前方式下可选
          </span>
        </div>
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

          <button
            v-if="isCaptchaTab"
            :disabled="verifyAssetLoading"
            class="h-10 min-w-[116px] overflow-hidden rounded-md border border-border bg-muted text-xs text-muted-foreground disabled:cursor-not-allowed"
            type="button"
            @click="requestVerifyCode"
          >
            <img
              v-if="captchaImage"
              :src="captchaImage"
              alt="验证码"
              class="h-full w-full object-cover"
            />
            <span v-else class="px-3">
              {{ actionButtonText }}
            </span>
          </button>

          <Button
            v-else-if="isSendCodeTab"
            :disabled="verifyAssetLoading || countdown > 0"
            :loading="verifyAssetLoading"
            class="min-w-[116px]"
            size="large"
            @click="requestVerifyCode"
          >
            {{ actionButtonText }}
          </Button>
        </div>
      </div>

      <div class="flex items-center justify-between pt-1">
        <Checkbox v-model:checked="rememberMe">记住账号</Checkbox>
        <span class="text-xs text-muted-foreground">
          当前账号可用：sa / 123456
        </span>
      </div>

      <Button
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
