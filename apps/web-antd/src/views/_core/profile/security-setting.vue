<script setup lang="ts">
import { computed, reactive } from 'vue';

import { useUserStore } from '@vben/stores';

import { Alert, Button, Card, Form, Input, message } from 'ant-design-vue';

import { getVerifyCodeApi, updateLoginInfoApi } from '#/api';
import { useAuthStore } from '#/store';

type VerifyCodeType = 'Email' | 'Sms';

const userStore = useUserStore();
const authStore = useAuthStore();

const phoneForm = reactive({
  newTelephone: '',
  newTelephoneVerifyCode: '',
  verifyCode: '',
});

const emailForm = reactive({
  newEmail: '',
  newEmailVerifyCode: '',
  verifyCode: '',
});

const loading = reactive<Record<string, boolean>>({});

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

function maskPhone(phone: string) {
  if (!phone) {
    return '未绑定';
  }

  if (phone.length < 7) {
    return phone;
  }

  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function maskEmail(email: string) {
  if (!email) {
    return '未绑定';
  }

  const [rawName = '', domain] = email.split('@');
  if (!domain) {
    return email;
  }

  const visibleName =
    rawName.length <= 2 ? rawName.slice(0, 1) : `${rawName.slice(0, 2)}***`;
  return `${visibleName}@${domain}`;
}

function extractReturnedVerifyCode(payload: any) {
  return String(payload?.code || payload?.verifyCode || '').trim();
}

async function sendVerifyCode(
  key: string,
  account: string,
  verifyCodeType: VerifyCodeType,
  fillCode: (code: string) => void,
) {
  const normalizedAccount = account.trim();
  if (!normalizedAccount) {
    message.warning('请先填写接收验证码的手机号或邮箱');
    return;
  }

  try {
    loading[key] = true;
    const payload = await getVerifyCodeApi({
      account: normalizedAccount,
      verifyCodeType,
    });
    const returnedCode = extractReturnedVerifyCode(payload);

    if (returnedCode) {
      fillCode(returnedCode);
      message.success(`验证码已生成：${returnedCode}`);
      return;
    }

    message.success(
      verifyCodeType === 'Email'
        ? '邮箱验证码已发送，请注意查收'
        : '短信验证码已发送，请注意查收',
    );
  } finally {
    loading[key] = false;
  }
}

async function submitPhone() {
  if (!currentTelephone.value) {
    message.warning('当前账号未绑定手机号，暂不能直接换绑手机号');
    return;
  }

  if (
    !phoneForm.verifyCode ||
    !phoneForm.newTelephone ||
    !phoneForm.newTelephoneVerifyCode
  ) {
    message.warning('请完整填写手机号换绑信息');
    return;
  }

  try {
    loading.phoneSubmit = true;
    await updateLoginInfoApi({
      newTelephone: phoneForm.newTelephone.trim(),
      newTelephoneVerifyCode: phoneForm.newTelephoneVerifyCode.trim(),
      verifyCode: phoneForm.verifyCode.trim(),
      verifyCodeType: 'Sms',
    });
    message.success('手机号换绑成功');
    resetPhoneForm();
    await authStore.fetchUserInfo();
  } finally {
    loading.phoneSubmit = false;
  }
}

async function submitEmail() {
  if (!currentEmail.value) {
    message.warning('当前账号未绑定邮箱，暂不能直接换绑邮箱');
    return;
  }

  if (
    !emailForm.verifyCode ||
    !emailForm.newEmail ||
    !emailForm.newEmailVerifyCode
  ) {
    message.warning('请完整填写邮箱换绑信息');
    return;
  }

  try {
    loading.emailSubmit = true;
    await updateLoginInfoApi({
      newEmail: emailForm.newEmail.trim(),
      newEmailVerifyCode: emailForm.newEmailVerifyCode.trim(),
      verifyCode: emailForm.verifyCode.trim(),
      verifyCodeType: 'Email',
    });
    message.success('邮箱换绑成功');
    resetEmailForm();
    await authStore.fetchUserInfo();
  } finally {
    loading.emailSubmit = false;
  }
}

function resetPhoneForm() {
  phoneForm.verifyCode = '';
  phoneForm.newTelephone = '';
  phoneForm.newTelephoneVerifyCode = '';
}

function resetEmailForm() {
  emailForm.verifyCode = '';
  emailForm.newEmail = '';
  emailForm.newEmailVerifyCode = '';
}
</script>

<template>
  <div class="space-y-4">
    <Alert
      show-icon
      type="info"
      message="换绑手机号或邮箱时，需要先验证当前绑定账号，再验证新的手机号或邮箱。"
    />

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card size="small" title="换绑手机号" class="border border-border">
        <Form layout="vertical">
          <Form.Item label="当前手机号">
            <span class="text-foreground">{{ maskedTelephone }}</span>
          </Form.Item>

          <Form.Item label="当前手机号验证码">
            <div class="flex gap-2">
              <Input
                v-model:value="phoneForm.verifyCode"
                allow-clear
                placeholder="请输入当前手机号验证码"
              />
              <Button
                html-type="button"
                :disabled="!currentTelephone"
                :loading="loading.currentPhoneCode"
                @click="
                  sendVerifyCode(
                    'currentPhoneCode',
                    currentTelephone,
                    'Sms',
                    (code) => (phoneForm.verifyCode = code),
                  )
                "
              >
                发送验证码
              </Button>
            </div>
          </Form.Item>

          <Form.Item label="新手机号">
            <Input
              v-model:value="phoneForm.newTelephone"
              allow-clear
              placeholder="请输入新手机号"
            />
          </Form.Item>

          <Form.Item label="新手机号验证码">
            <div class="flex gap-2">
              <Input
                v-model:value="phoneForm.newTelephoneVerifyCode"
                allow-clear
                placeholder="请输入新手机号验证码"
              />
              <Button
                html-type="button"
                :disabled="!phoneForm.newTelephone"
                :loading="loading.newPhoneCode"
                @click="
                  sendVerifyCode(
                    'newPhoneCode',
                    phoneForm.newTelephone,
                    'Sms',
                    (code) => (phoneForm.newTelephoneVerifyCode = code),
                  )
                "
              >
                发送验证码
              </Button>
            </div>
          </Form.Item>

          <Button
            type="primary"
            :loading="loading.phoneSubmit"
            @click="submitPhone"
          >
            保存手机号
          </Button>
        </Form>
      </Card>

      <Card size="small" title="换绑邮箱" class="border border-border">
        <Form layout="vertical">
          <Form.Item label="当前邮箱">
            <span class="text-foreground">{{ maskedEmail }}</span>
          </Form.Item>

          <Form.Item label="当前邮箱验证码">
            <div class="flex gap-2">
              <Input
                v-model:value="emailForm.verifyCode"
                allow-clear
                placeholder="请输入当前邮箱验证码"
              />
              <Button
                html-type="button"
                :disabled="!currentEmail"
                :loading="loading.currentEmailCode"
                @click="
                  sendVerifyCode(
                    'currentEmailCode',
                    currentEmail,
                    'Email',
                    (code) => (emailForm.verifyCode = code),
                  )
                "
              >
                发送验证码
              </Button>
            </div>
          </Form.Item>

          <Form.Item label="新邮箱">
            <Input
              v-model:value="emailForm.newEmail"
              allow-clear
              placeholder="请输入新邮箱"
            />
          </Form.Item>

          <Form.Item label="新邮箱验证码">
            <div class="flex gap-2">
              <Input
                v-model:value="emailForm.newEmailVerifyCode"
                allow-clear
                placeholder="请输入新邮箱验证码"
              />
              <Button
                html-type="button"
                :disabled="!emailForm.newEmail"
                :loading="loading.newEmailCode"
                @click="
                  sendVerifyCode(
                    'newEmailCode',
                    emailForm.newEmail,
                    'Email',
                    (code) => (emailForm.newEmailVerifyCode = code),
                  )
                "
              >
                发送验证码
              </Button>
            </div>
          </Form.Item>

          <Button
            type="primary"
            :loading="loading.emailSubmit"
            @click="submitEmail"
          >
            保存邮箱
          </Button>
        </Form>
      </Card>
    </div>
  </div>
</template>
