<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Form,
  Input,
  Space,
  Tabs,
  Typography,
  message,
} from 'ant-design-vue';

import { getVerifyCodeApi, updateLoginInfoApi } from '#/api';

import { extractReturnedVerifyCode } from '../authentication/login-verify-type';

type PasswordMode = 'email' | 'oldPwd' | 'sms';
type VerifyCodeType = 'Email' | 'Sms';

const userStore = useUserStore();

const mode = ref<PasswordMode>('oldPwd');
const saving = ref(false);
const loading = reactive<Record<string, boolean>>({});
const form = reactive({
  confirmPassword: '',
  newPwd: '',
  oldPwd: '',
  verifyCode: '',
});

const currentUser = computed(() => userStore.userInfo as Record<string, any>);
const currentTelephone = computed(() =>
  String(
    currentUser.value?.telephone ||
      currentUser.value?.mobile ||
      currentUser.value?.phone ||
      '',
  ).trim(),
);
const currentEmail = computed(() =>
  String(currentUser.value?.email || '').trim(),
);
const maskedTelephone = computed(() => maskPhone(currentTelephone.value));
const maskedEmail = computed(() => maskEmail(currentEmail.value));

const currentVerifyAccount = computed(() =>
  mode.value === 'email' ? currentEmail.value : currentTelephone.value,
);
const currentVerifyType = computed<VerifyCodeType>(() =>
  mode.value === 'email' ? 'Email' : 'Sms',
);

function maskPhone(phone: string) {
  if (!phone) {
    return '未绑定手机号';
  }

  if (phone.length < 7) {
    return phone;
  }

  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function maskEmail(email: string) {
  if (!email) {
    return '未绑定邮箱';
  }

  const [rawName = '', domain] = email.split('@');
  if (!domain) {
    return email;
  }

  const visibleName =
    rawName.length <= 2 ? rawName.slice(0, 1) : `${rawName.slice(0, 2)}***`;
  return `${visibleName}@${domain}`;
}

function resetModeFields() {
  form.oldPwd = '';
  form.verifyCode = '';
}

function resetForm() {
  form.oldPwd = '';
  form.verifyCode = '';
  form.newPwd = '';
  form.confirmPassword = '';
}

function validateForm() {
  if (mode.value === 'oldPwd' && !form.oldPwd.trim()) {
    message.warning('请输入旧密码');
    return false;
  }

  if (mode.value !== 'oldPwd') {
    if (!currentVerifyAccount.value) {
      message.warning(
        mode.value === 'email'
          ? '当前账号未绑定邮箱，暂不能使用邮箱验证码修改密码'
          : '当前账号未绑定手机号，暂不能使用短信验证码修改密码',
      );
      return false;
    }

    if (!form.verifyCode.trim()) {
      message.warning('请输入验证码');
      return false;
    }
  }

  if (!form.newPwd.trim()) {
    message.warning('请输入新密码');
    return false;
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(form.newPwd)) {
    message.warning('密码必须包含数字和大小写字母且长度不少于6');
    return false;
  }

  if (form.confirmPassword !== form.newPwd) {
    message.warning('两次输入的新密码不一致');
    return false;
  }

  return true;
}

async function sendCurrentVerifyCode() {
  const account = currentVerifyAccount.value.trim();
  if (!account) {
    message.warning(
      mode.value === 'email'
        ? '当前账号未绑定邮箱，无法发送验证码'
        : '当前账号未绑定手机号，无法发送验证码',
    );
    return;
  }

  try {
    loading.verifyCode = true;
    const payload = await getVerifyCodeApi({
      account,
      verifyCodeType: currentVerifyType.value,
    });
    const returnedCode = String(extractReturnedVerifyCode(payload)).trim();

    if (returnedCode) {
      form.verifyCode = returnedCode;
      message.success(`验证码已生成：${returnedCode}`);
      return;
    }

    message.success(
      currentVerifyType.value === 'Email'
        ? '邮箱验证码已发送，请注意查收'
        : '短信验证码已发送，请注意查收',
    );
  } finally {
    loading.verifyCode = false;
  }
}

async function handleSubmit() {
  if (saving.value || !validateForm()) {
    return;
  }

  try {
    saving.value = true;
    const payload: Parameters<typeof updateLoginInfoApi>[0] = {
      newPwd: form.newPwd.trim(),
    };

    if (mode.value === 'oldPwd') {
      payload.oldPwd = form.oldPwd;
    } else {
      payload.verifyCode = form.verifyCode.trim();
      payload.verifyCodeType = currentVerifyType.value;
    }

    await updateLoginInfoApi(payload);
    message.success('密码修改成功');
    resetForm();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="w-full max-w-3xl">
    <Tabs v-model:active-key="mode" @change="resetModeFields">
      <Tabs.TabPane key="oldPwd" tab="原密码修改" />
      <Tabs.TabPane key="sms" tab="短信验证码修改" />
      <Tabs.TabPane key="email" tab="邮箱验证码修改" />
    </Tabs>

    <Alert
      class="mb-4"
      show-icon
      type="info"
      :message="
        mode === 'oldPwd'
          ? '通过当前登录密码验证后修改密码。'
          : mode === 'sms'
            ? '通过当前绑定的手机号验证码验证后修改密码。'
            : '通过当前绑定的邮箱验证码验证后修改密码。'
      "
    />

    <Form class="profile-password-form" layout="vertical">
      <Form.Item v-if="mode === 'oldPwd'" label="原密码" required>
        <Input.Password
          v-model:value="form.oldPwd"
          autocomplete="current-password"
          placeholder="请输入原密码"
        />
      </Form.Item>

      <template v-else>
        <Form.Item :label="mode === 'email' ? '当前邮箱' : '当前手机号'">
          <Typography.Text class="text-foreground">
            {{ mode === 'email' ? maskedEmail : maskedTelephone }}
          </Typography.Text>
        </Form.Item>

        <Form.Item label="验证码" required>
          <Space.Compact class="w-full">
            <Input
              v-model:value="form.verifyCode"
              allow-clear
              placeholder="请输入验证码"
            />
            <Button
              html-type="button"
              :disabled="!currentVerifyAccount"
              :loading="loading.verifyCode"
              @click="sendCurrentVerifyCode"
            >
              发送验证码
            </Button>
          </Space.Compact>
        </Form.Item>
      </template>

      <Form.Item label="新密码" required>
        <Input.Password
          v-model:value="form.newPwd"
          autocomplete="new-password"
          placeholder="请输入新密码"
        />
        <div class="mt-2 text-xs text-muted-foreground">
          密码必须包含数字和大小写字母，长度不少于 6 位。
        </div>
      </Form.Item>

      <Form.Item label="确认密码" required>
        <Input.Password
          v-model:value="form.confirmPassword"
          autocomplete="new-password"
          placeholder="请再次输入新密码"
        />
      </Form.Item>

      <Button type="primary" :loading="saving" @click="handleSubmit">
        更新密码
      </Button>
    </Form>
  </div>
</template>

<style scoped>
.profile-password-form {
  max-width: 560px;
}
</style>
