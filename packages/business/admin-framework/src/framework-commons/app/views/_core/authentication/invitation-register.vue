<script setup lang="ts">
import type { InvitationPreview } from '../../../api/invitation-register-service';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { Alert, Button, Input } from 'ant-design-vue';

import { invitationRegisterService } from '../../../api/invitation-register-service';
import { oauthService } from '../../../api/oauth-service';
import { rbacService } from '../../../api/rbac-service';
import {
  accountChannel,
  channelAllowed,
} from './invitation-registration-policy';

const route = useRoute();
const token = ref(
  typeof route.query.token === 'string' ? route.query.token : '',
);
const preview = ref<InvitationPreview>();
const loading = ref(false);
const submitting = ref(false);
const codeLoading = ref(false);
const completed = ref(false);
const error = ref('');
const verificationCodeType = ref<'Email' | 'Sms'>();
const verifiedAccount = ref('');
const oauthTransactionId = computed(() =>
  typeof route.query.oauthTransaction === 'string'
    ? route.query.oauthTransaction
    : '',
);
const isMemberOAuthCompletion = computed(
  () => preview.value?.targetType === 'Member' && !!oauthTransactionId.value,
);
const showBackendLoginLink = computed(
  () => !completed.value || preview.value?.targetType !== 'Member',
);
const oauthPlatforms = ref<{ code: string; name: string }[]>([]);
const oauthEnabled = ref(false);
let referrerMeta: HTMLMetaElement | null = null;
let originalReferrerPolicy: null | string = null;
let addedReferrerMeta = false;
const form = reactive({
  account: '',
  name: '',
  password: '',
  confirmPassword: '',
  verificationCode: '',
  organizationName: '',
  legalSubjectName: '',
  unifiedCreditNo: '',
});
const targetName: Record<string, string> = {
  Internal: '内部用户',
  Member: '会员用户',
  Customer: '客户',
  SupplierPartner: '供应伙伴',
  ChannelPartner: '渠道伙伴',
};
const registrationChannelName: Record<string, string> = {
  Phone: '手机号',
  Email: '邮箱',
  Either: '手机号或邮箱',
  ThirdParty: '第三方认证',
  Unrestricted: '手机号、邮箱或第三方认证',
};

// 单渠道链接的账号标签与服务端预览保持一致，避免提示用户填写不被允许的联系方式。
const accountLabel = computed(() => {
  if (preview.value?.registrationChannel === 'Phone') return '手机号';
  if (preview.value?.registrationChannel === 'Email') return '邮箱';
  return '手机号或邮箱';
});

// 令牌仅原样发送后端预览，不根据 URL 自报的类型或角色显示可提交表单。
async function loadPreview() {
  preview.value = undefined;
  completed.value = false;
  error.value = '';
  if (!token.value) {
    error.value = '邀请链接无效';
    return;
  }
  loading.value = true;
  try {
    const options = await rbacService.getLoginOptions();
    if (options.enableInvitationRegister !== true)
      throw new Error('当前站点未开放邀请注册');
    preview.value = await invitationRegisterService.preview(token.value);
    if (typeof route.query.oauthError === 'string') {
      error.value = route.query.oauthError.slice(0, 200);
    }
    oauthEnabled.value =
      options.enableThirdLogin === true && options.enableThirdRegister === true;
    if (
      oauthEnabled.value &&
      ['ThirdParty', 'Unrestricted'].includes(preview.value.registrationChannel)
    ) {
      try {
        const catalog = await oauthService.getSupportedPlatforms();
        let raw: Record<string, any>[] = [];
        if (Array.isArray(catalog)) raw = catalog;
        else if (Array.isArray(catalog?.items)) raw = catalog.items;
        else if (Array.isArray(catalog?.records)) raw = catalog.records;
        else if (Array.isArray(catalog?.data)) raw = catalog.data;
        oauthPlatforms.value = raw
          .map((item: Record<string, any>) => ({
            code: String(item.code || item.platform || item.id || '')
              .trim()
              .toUpperCase(),
            name: String(item.title || item.name || item.code || '').trim(),
            enabled: item.enabled !== false,
          }))
          .filter(
            (item: { code: string; enabled: boolean }) =>
              item.enabled &&
              item.code &&
              !/^(?:WECHAT_ENTERPRISE_V2|WECOM|WEWORK|WECHAT_WORK|WE_COM|FEISHU|DINGTALK(?:_V2)?)$/.test(
                item.code,
              ),
          );
      } catch {
        // 第三方目录失败不阻断同一链接允许的手机号或邮箱注册。
        oauthPlatforms.value = [];
      }
    }
  } catch (error_) {
    error.value =
      error_ instanceof Error ? error_.message : '邀请链接无效或已失效';
  } finally {
    loading.value = false;
  }
}
function hideTokenFromAddress() {
  const visibleUrl = new URL(window.location.href);
  if (!visibleUrl.searchParams.has('token')) return;
  visibleUrl.searchParams.delete('token');
  window.history.replaceState(window.history.state, '', visibleUrl);
}
onMounted(() => {
  // 先将令牌保留在组件内存并移出可见地址，防止复制地址或来源头泄漏。
  hideTokenFromAddress();
  referrerMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="referrer"]',
  );
  if (referrerMeta) {
    originalReferrerPolicy = referrerMeta.content;
  } else {
    referrerMeta = document.createElement('meta');
    referrerMeta.name = 'referrer';
    document.head.append(referrerMeta);
    addedReferrerMeta = true;
  }
  referrerMeta.content = 'no-referrer';
  void loadPreview();
});
onBeforeUnmount(() => {
  if (addedReferrerMeta) referrerMeta?.remove();
  else if (referrerMeta && originalReferrerPolicy !== null) {
    referrerMeta.content = originalReferrerPolicy;
  }
});
watch(
  () => route.query.token,
  (next) => {
    if (typeof next !== 'string' || next === token.value) return;
    token.value = next;
    hideTokenFromAddress();
  },
);
watch(token, loadPreview);

// 第三方事务由服务端绑定链接和浏览器，回跳地址仅指向本站公开邀请页。
async function startOAuth(platform: string) {
  if (!preview.value || !oauthEnabled.value || submitting.value) return;
  submitting.value = true;
  error.value = '';
  try {
    const returnUrl = new URL(
      '/auth/invitation-register',
      window.location.origin,
    );
    returnUrl.searchParams.set('token', token.value);
    const transaction = await oauthService.createTransaction({
      platform,
      purpose: 'INVITE',
      invitationToken: token.value,
      returnUrl: returnUrl.toString(),
    });
    if (!transaction.authorizeUrl && !transaction.authUrl)
      throw new Error('授权地址不可用');
    hideTokenFromAddress();
    window.location.assign(
      String(transaction.authorizeUrl || transaction.authUrl),
    );
  } catch (error_) {
    error.value =
      error_ instanceof Error ? error_.message : '第三方授权发起失败';
    submitting.value = false;
  }
}

async function finishOAuth() {
  if (
    !preview.value ||
    !oauthTransactionId.value ||
    submitting.value ||
    completed.value
  )
    return;
  if (isMemberOAuthCompletion.value) {
    const account = form.account.trim();
    if (!accountChannel(account) || !form.password) {
      error.value = '请填写手机号或邮箱及登录密码';
      return;
    }
    if (form.password !== form.confirmPassword) {
      error.value = '两次密码不一致';
      return;
    }
    if (
      verifiedAccount.value !== account ||
      !verificationCodeType.value ||
      !form.verificationCode.trim()
    ) {
      error.value = '请为当前账号获取并填写验证码';
      return;
    }
  }
  if (
    preview.value.organizationMode === 'CreateChildOrg' &&
    !form.organizationName.trim()
  ) {
    error.value = '请填写新组织名称';
    return;
  }
  if (
    preview.value.requiresExternalOrganization &&
    (!form.legalSubjectName.trim() || !form.unifiedCreditNo.trim())
  ) {
    error.value = '请填写法律主体名称和统一社会信用代码';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    await oauthService.redeemInvitation({
      token: token.value,
      transactionId: oauthTransactionId.value,
      ...(isMemberOAuthCompletion.value
        ? {
            account: form.account.trim(),
            password: form.password,
            verificationCode: form.verificationCode.trim(),
            verifyCodeType: verificationCodeType.value,
          }
        : {}),
      ...(preview.value.organizationMode === 'CreateChildOrg'
        ? { organizationName: form.organizationName.trim() }
        : {}),
      ...(preview.value.requiresExternalOrganization
        ? {
            legalSubjectName: form.legalSubjectName.trim(),
            unifiedCreditNo: form.unifiedCreditNo.trim(),
          }
        : {}),
    });
    completed.value = true;
    form.password = '';
    form.confirmPassword = '';
    form.verificationCode = '';
  } catch (error_) {
    error.value =
      error_ instanceof Error ? error_.message : '第三方邀请注册失败';
  } finally {
    submitting.value = false;
  }
}

// 注册账号与验证码必须对应，切换手机号或邮箱后清除旧验证码。
watch(
  () => form.account,
  () => {
    verifiedAccount.value = '';
    verificationCodeType.value = undefined;
    form.verificationCode = '';
  },
);

async function requestCode() {
  const channel = accountChannel(form.account);
  if (
    !channel ||
    !preview.value ||
    (!isMemberOAuthCompletion.value &&
      !channelAllowed(preview.value, channel)) ||
    codeLoading.value
  ) {
    error.value = '请填写邀请链接允许的手机号或邮箱';
    return;
  }
  codeLoading.value = true;
  error.value = '';
  try {
    const account = form.account.trim();
    const result = await rbacService.getVerifyCode({ account });
    const expected = channel === 'Phone' ? 'Sms' : 'Email';
    if (result.type !== expected) throw new Error('验证码类型与注册账号不一致');
    verifiedAccount.value = account;
    verificationCodeType.value = expected;
    if (result.mock === true && result.code)
      form.verificationCode = result.code;
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : '验证码发送失败';
  } finally {
    codeLoading.value = false;
  }
}

async function submit() {
  if (!preview.value || submitting.value || completed.value) return;
  const account = form.account.trim();
  if (!channelAllowed(preview.value, accountChannel(account))) {
    error.value = '注册方式与邀请链接不符';
    return;
  }
  if (!form.name.trim() || !form.password) {
    error.value = '请填写姓名和密码';
    return;
  }
  if (form.password !== form.confirmPassword) {
    error.value = '两次密码不一致';
    return;
  }
  if (
    verifiedAccount.value !== account ||
    !verificationCodeType.value ||
    !form.verificationCode.trim()
  ) {
    error.value = '请为当前账号获取并填写验证码';
    return;
  }
  if (
    preview.value.organizationMode === 'CreateChildOrg' &&
    !form.organizationName.trim()
  ) {
    error.value = '请填写新组织名称';
    return;
  }
  if (
    preview.value.requiresExternalOrganization &&
    (!form.legalSubjectName.trim() || !form.unifiedCreditNo.trim())
  ) {
    error.value = '请填写法律主体名称和统一社会信用代码';
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    await invitationRegisterService.redeem({
      token: token.value,
      account,
      name: form.name.trim(),
      password: form.password,
      verificationCode: form.verificationCode.trim(),
      verifyCodeType: verificationCodeType.value,
      ...(preview.value.organizationMode === 'CreateChildOrg'
        ? { organizationName: form.organizationName.trim() }
        : {}),
      ...(preview.value.requiresExternalOrganization
        ? {
            legalSubjectName: form.legalSubjectName.trim(),
            unifiedCreditNo: form.unifiedCreditNo.trim(),
          }
        : {}),
    });
    completed.value = true;
    form.password = '';
    form.confirmPassword = '';
    form.verificationCode = '';
  } catch (error_) {
    error.value =
      error_ instanceof Error
        ? error_.message
        : '邀请注册失败，请核对资料后重试';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="w-full">
    <h1 class="text-foreground mb-3 text-3xl font-semibold">邀请注册</h1>
    <Alert v-if="loading" type="info" message="正在验证邀请链接…" />
    <div v-else-if="error && !preview" class="space-y-3">
      <Alert type="error" :message="error" />
      <Button @click="loadPreview">重新验证</Button>
    </div>
    <div v-else-if="completed" class="space-y-3">
      <Alert
        type="success"
        :message="
          preview?.targetType === 'Member'
            ? '会员注册成功；登录入口将由后续会员客户端提供'
            : '注册成功，请登录'
        "
      />
      <a v-if="preview?.targetType !== 'Member'" href="/auth/login">前往登录</a>
    </div>
    <div v-else-if="preview" class="space-y-4">
      <p class="text-muted-foreground text-sm">
        邀请目标：{{ targetName[preview.targetType] || preview.targetType }}；
        注册方式：{{ registrationChannelName[preview.registrationChannel] }}；
        有效期至 {{ preview.expiresAt }}。
      </p>
      <Alert v-if="error" type="error" :message="error" />
      <Alert
        v-if="preview.registrationChannel === 'ThirdParty'"
        type="info"
        message="请通过支持的第三方认证完成注册。"
      />
      <div
        v-if="
          oauthEnabled &&
          ['ThirdParty', 'Unrestricted'].includes(
            preview.registrationChannel,
          ) &&
          !oauthTransactionId
        "
        class="space-y-2"
      >
        <Alert
          v-if="oauthPlatforms.length === 0"
          type="info"
          message="当前没有可用的第三方认证平台"
        />
        <Button
          v-for="platform in oauthPlatforms"
          :key="platform.code"
          :disabled="submitting"
          @click="startOAuth(platform.code)"
        >
          使用{{ platform.name }}认证注册
        </Button>
      </div>
      <form
        v-if="
          oauthTransactionId &&
          ['ThirdParty', 'Unrestricted'].includes(preview.registrationChannel)
        "
        class="space-y-3"
        @submit.prevent="finishOAuth"
      >
        <Alert type="info" message="第三方认证已返回，请完成业务资料。" />
        <template v-if="isMemberOAuthCompletion">
          <label class="block" for="oauth-member-account">手机号或邮箱</label>
          <Input
            id="oauth-member-account"
            v-model:value="form.account"
            autocomplete="username"
          />
          <label class="block" for="oauth-member-password">登录密码</label>
          <Input.Password
            id="oauth-member-password"
            v-model:value="form.password"
            autocomplete="new-password"
          />
          <label class="block" for="oauth-member-confirm">确认密码</label>
          <Input.Password
            id="oauth-member-confirm"
            v-model:value="form.confirmPassword"
            autocomplete="new-password"
          />
          <label class="block" for="oauth-member-code">验证码</label>
          <div class="flex gap-2">
            <Input
              id="oauth-member-code"
              v-model:value="form.verificationCode"
              autocomplete="one-time-code"
            />
            <Button
              :loading="codeLoading"
              :disabled="!accountChannel(form.account)"
              @click="requestCode"
            >
              获取验证码
            </Button>
          </div>
        </template>
        <template v-if="preview.organizationMode === 'CreateChildOrg'">
          <label class="block" for="invite-oauth-org">新组织名称</label>
          <Input id="invite-oauth-org" v-model:value="form.organizationName" />
        </template>
        <template v-if="preview.requiresExternalOrganization">
          <label class="block" for="oauth-legal">法律主体名称</label>
          <Input id="oauth-legal" v-model:value="form.legalSubjectName" />
          <label class="block" for="oauth-credit">统一社会信用代码</label>
          <Input id="oauth-credit" v-model:value="form.unifiedCreditNo" />
        </template>
        <Button type="primary" html-type="submit" block :loading="submitting">
          完成第三方邀请注册
        </Button>
      </form>
      <form
        v-if="
          preview.registrationChannel !== 'ThirdParty' && !oauthTransactionId
        "
        class="space-y-3"
        @submit.prevent="submit"
      >
        <label class="block" for="invite-account">{{ accountLabel }}</label>
        <Input
          id="invite-account"
          v-model:value="form.account"
          autocomplete="username"
        />
        <label class="block" for="invite-name">姓名</label>
        <Input id="invite-name" v-model:value="form.name" autocomplete="name" />
        <label class="block" for="invite-password">密码</label>
        <Input.Password
          id="invite-password"
          v-model:value="form.password"
          autocomplete="new-password"
        />
        <label class="block" for="invite-confirm-password">确认密码</label>
        <Input.Password
          id="invite-confirm-password"
          v-model:value="form.confirmPassword"
          autocomplete="new-password"
        />
        <label class="block" for="invite-code">验证码</label>
        <div class="flex gap-2">
          <Input
            id="invite-code"
            v-model:value="form.verificationCode"
            autocomplete="one-time-code"
          />
          <Button
            :loading="codeLoading"
            :disabled="!accountChannel(form.account)"
            @click="requestCode"
          >
            获取验证码
          </Button>
        </div>
        <template v-if="preview.organizationMode === 'CreateChildOrg'">
          <label class="block" for="invite-org">新组织名称</label>
          <Input id="invite-org" v-model:value="form.organizationName" />
        </template>
        <template v-if="preview.requiresExternalOrganization">
          <label class="block" for="invite-legal-name">法律主体名称</label>
          <Input id="invite-legal-name" v-model:value="form.legalSubjectName" />
          <label class="block" for="invite-credit-no">统一社会信用代码</label>
          <Input id="invite-credit-no" v-model:value="form.unifiedCreditNo" />
        </template>
        <Button type="primary" html-type="submit" block :loading="submitting">
          完成邀请注册
        </Button>
      </form>
    </div>
    <a v-if="showBackendLoginLink" class="mt-5 block" href="/auth/login">
      <span>返回登录</span>
    </a>
  </div>
</template>
