<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  QRCode,
  Tabs,
  message,
} from 'ant-design-vue';

import { getAdminUserSecurityService } from '@levin/admin-framework';
import { getVerifyCodeApi, updateLoginInfoApi } from '@levin/admin-framework/framework-commons/app/api';
import { useAuthStore } from '@levin/admin-framework/framework-commons/app/store';

import { extractReturnedVerifyCode } from '../authentication/login-verify-type';

type VerifyCodeType = 'Email' | 'Sms';

const userStore = useUserStore();
const authStore = useAuthStore();

interface UserMfaInfo {
  id?: string;
  mfaQrCode?: string;
  name?: string;
}

const activeTab = ref<'email' | 'mfa' | 'phone'>('phone');
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
const mfaInfo = ref<null | UserMfaInfo>(null);

const currentUser = computed(() => userStore.userInfo as Record<string, any>);
const currentUserId = computed(() =>
  String(currentUser.value?.id || '').trim(),
);
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
const mfaQrCode = computed(() => String(mfaInfo.value?.mfaQrCode || '').trim());
const hasMfaService = computed(() => Boolean(getAdminUserSecurityService()));
const isTelephoneBound = computed(() => !!currentTelephone.value);
const isEmailBound = computed(() => !!currentEmail.value);

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

async function loadMfaInfo(silent = false) {
  const userSecurityService = getAdminUserSecurityService();
  if (!userSecurityService) {
    mfaInfo.value = null;
    return;
  }

  try {
    loading.mfaLoad = true;
    mfaInfo.value =
      (await userSecurityService.viewMyMfaQrCode()) as UserMfaInfo;
    if (!silent) {
      message.success('MFA 二维码已刷新');
    }
  } finally {
    loading.mfaLoad = false;
  }
}

function resetMfaSecretKey() {
  if (!currentUserId.value) {
    message.warning('当前用户信息缺少用户 ID，暂不能重置 MFA 密钥');
    return;
  }

  Modal.confirm({
    title: '确认重置 MFA 密钥吗？',
    content: '重置后旧 MFA 密钥会立即失效，请使用新的二维码重新绑定认证器。',
    okText: '确认重置',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      loading.mfaReset = true;
      try {
        const userSecurityService = getAdminUserSecurityService();
        if (!userSecurityService) {
          message.warning('当前应用没有配置 MFA 安全服务');
          return;
        }

        await userSecurityService.resetMfaSecretKey({
          forQrCode: true,
          id: currentUserId.value,
        });
        await loadMfaInfo(true);
        message.success('MFA 密钥已重置，请重新绑定认证器');
      } finally {
        loading.mfaReset = false;
      }
    },
  });
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
    const returnedCode = String(extractReturnedVerifyCode(payload)).trim();

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
  if (!phoneForm.newTelephone || !phoneForm.newTelephoneVerifyCode) {
    message.warning(
      isTelephoneBound.value
        ? '请完整填写手机号换绑信息'
        : '请完整填写手机号绑定信息',
    );
    return;
  }

  if (isTelephoneBound.value && !phoneForm.verifyCode) {
    message.warning('请输入当前手机号验证码');
    return;
  }

  try {
    loading.phoneSubmit = true;
    const payload: Parameters<typeof updateLoginInfoApi>[0] = {
      newTelephone: phoneForm.newTelephone.trim(),
      newTelephoneVerifyCode: phoneForm.newTelephoneVerifyCode.trim(),
    };

    if (isTelephoneBound.value) {
      payload.verifyCode = phoneForm.verifyCode.trim();
      payload.verifyCodeType = 'Sms';
    }

    await updateLoginInfoApi(payload);
    message.success(
      isTelephoneBound.value ? '手机号换绑成功' : '手机号绑定成功',
    );
    resetPhoneForm();
    await authStore.fetchUserInfo();
  } finally {
    loading.phoneSubmit = false;
  }
}

async function submitEmail() {
  if (!emailForm.newEmail || !emailForm.newEmailVerifyCode) {
    message.warning(
      isEmailBound.value ? '请完整填写邮箱换绑信息' : '请完整填写邮箱绑定信息',
    );
    return;
  }

  if (isEmailBound.value && !emailForm.verifyCode) {
    message.warning('请输入当前邮箱验证码');
    return;
  }

  try {
    loading.emailSubmit = true;
    const payload: Parameters<typeof updateLoginInfoApi>[0] = {
      newEmail: emailForm.newEmail.trim(),
      newEmailVerifyCode: emailForm.newEmailVerifyCode.trim(),
    };

    if (isEmailBound.value) {
      payload.verifyCode = emailForm.verifyCode.trim();
      payload.verifyCodeType = 'Email';
    }

    await updateLoginInfoApi(payload);
    message.success(isEmailBound.value ? '邮箱换绑成功' : '邮箱绑定成功');
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

onMounted(() => {
  loadMfaInfo(true).catch(() => {
    // 安全设置不因 MFA 插件临时不可用而阻塞手机号/邮箱换绑。
    mfaInfo.value = null;
  });
});
</script>

<template>
  <div class="space-y-4">
    <Alert
      show-icon
      type="info"
      message="未绑定手机号或邮箱时，只需验证新账号；换绑时，需要先验证当前绑定账号，再验证新的手机号或邮箱。"
    />

    <Tabs v-model:active-key="activeTab">
      <Tabs.TabPane key="phone" tab="手机号">
        <Card
          size="small"
          :title="isTelephoneBound ? '换绑手机号' : '绑定手机号'"
          class="border border-border"
        >
          <Form layout="vertical">
            <Form.Item label="当前手机号">
              <span class="text-foreground">{{ maskedTelephone }}</span>
            </Form.Item>

            <Form.Item v-if="isTelephoneBound" label="当前手机号验证码">
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
              {{ isTelephoneBound ? '保存手机号' : '绑定手机号' }}
            </Button>
          </Form>
        </Card>
      </Tabs.TabPane>

      <Tabs.TabPane key="email" tab="邮箱">
        <Card
          size="small"
          :title="isEmailBound ? '换绑邮箱' : '绑定邮箱'"
          class="border border-border"
        >
          <Form layout="vertical">
            <Form.Item label="当前邮箱">
              <span class="text-foreground">{{ maskedEmail }}</span>
            </Form.Item>

            <Form.Item v-if="isEmailBound" label="当前邮箱验证码">
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
              {{ isEmailBound ? '保存邮箱' : '绑定邮箱' }}
            </Button>
          </Form>
        </Card>
      </Tabs.TabPane>

      <Tabs.TabPane v-if="hasMfaService" key="mfa" tab="MFA">
        <Card size="small" title="MFA 多因子认证" class="border border-border">
          <div
            class="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)]"
          >
            <div
              class="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-4"
            >
              <QRCode v-if="mfaQrCode" :size="168" :value="mfaQrCode" />
              <div v-else class="text-center text-sm text-muted-foreground">
                暂未加载 MFA 二维码
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <div>
                <div class="text-sm text-muted-foreground">绑定账号</div>
                <div class="mt-1 text-base font-medium">
                  {{
                    mfaInfo?.name ||
                    currentUser?.name ||
                    currentUser?.loginName ||
                    '-'
                  }}
                </div>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button :loading="loading.mfaLoad" @click="loadMfaInfo()">
                  查看 MFA 二维码
                </Button>
                <Button
                  danger
                  :loading="loading.mfaReset"
                  @click="resetMfaSecretKey"
                >
                  重置 MFA 密钥
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </Tabs.TabPane>
    </Tabs>
  </div>
</template>
