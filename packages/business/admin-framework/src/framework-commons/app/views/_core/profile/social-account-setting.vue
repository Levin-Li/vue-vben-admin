<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { Alert, Button, Card, Modal, message } from 'ant-design-vue';

import { oauthService } from '@levin/admin-framework/framework-commons/app/api';
import { useAuthStore } from '@levin/admin-framework/framework-commons/app/store';

type OAuthBindingPurpose = 'BIND';

const OAUTH_BIND_TRANSACTION_STORAGE_KEY = `SECURITY_OAUTH_BIND_TRANSACTION_${location.pathname}`;
const OAUTH_BIND_POLL_INTERVAL_MS = 1500;

interface SocialBindingItem {
  accountText: string;
  boundAt: string;
  canUnbind: boolean;
  id: string;
  lastLoginAt: string;
  platformName: string;
}

interface SocialPlatformItem {
  authUrl: string;
  code: string;
  description: string;
  displayName: string;
  iconUrl: string;
}

const authStore = useAuthStore();
const loading = reactive<Record<string, boolean>>({});
const socialBindings = ref<SocialBindingItem[]>([]);
const socialPlatforms = ref<SocialPlatformItem[]>([]);
const socialBindDialogOpen = ref(false);
const socialBindErrorMessage = ref('');
const socialBindStatusMessage = ref('');
const socialBindActivePlatform = ref<null | SocialPlatformItem>(null);
const socialBindActiveTransactionId = ref('');
const socialBindAuthorizeUrl = ref('');
const socialBindSubmitting = ref(false);
const socialBindExchanging = ref(false);

let socialBindPollingTimer: null | ReturnType<typeof setInterval> = null;
let socialBindPollingInFlight = false;
let socialBindPopupWindow: null | Window = null;

const hasSocialPlatforms = computed(() => socialPlatforms.value.length > 0);
const hasSocialBindings = computed(() => socialBindings.value.length > 0);

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
      'binding',
      'capabilities',
      'code',
      'id',
      'items',
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

function extractItems(payload: any) {
  const normalizedPayload = unwrapOAuthPayload(payload);
  if (Array.isArray(normalizedPayload)) {
    return normalizedPayload;
  }

  return (
    ['items', 'records', 'data']
      .map((key) => normalizedPayload?.[key])
      .find(Array.isArray) || []
  );
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

  const capabilities = [
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

  return (
    capabilities.length === 0 ||
    capabilities.some((item) =>
      ['oauth', 'authorization', 'auth', 'qr_login', 'qr-login'].some((keyword) =>
        item.includes(keyword),
      ),
    )
  );
}

function normalizeSocialPlatform(platform: Record<string, any>) {
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

function normalizeSocialBinding(
  binding: Record<string, any>,
): null | SocialBindingItem {
  const id = String(binding.id || '').trim();
  if (!id) {
    return null;
  }

  return {
    accountText: String(
      binding.externalUsername ||
        binding.nickname ||
        binding.externalUserId ||
        binding.name ||
        '-',
    ).trim(),
    boundAt: String(binding.boundAt || binding.bindTime || '').trim(),
    canUnbind: binding.canUnbind !== false,
    id,
    lastLoginAt: String(binding.lastLoginAt || '').trim(),
    platformName: resolvePlatformDisplayName(binding),
  };
}

function resolveOAuthTransaction(payload: any) {
  return unwrapOAuthPayload(payload) || {};
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

function resolveOAuthTransactionStatus(transaction: Record<string, any>) {
  return String(transaction.status || 'PENDING')
    .trim()
    .toUpperCase();
}

function saveSocialBindResumeTransaction(
  transactionId: string,
  platformCode: string,
  authorizeUrl: string,
) {
  sessionStorage.setItem(
    OAUTH_BIND_TRANSACTION_STORAGE_KEY,
    JSON.stringify({ authorizeUrl, platformCode, transactionId }),
  );
}

function readSocialBindResumeTransaction() {
  const rawValue = sessionStorage.getItem(OAUTH_BIND_TRANSACTION_STORAGE_KEY);
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

function clearSocialBindResumeTransaction() {
  sessionStorage.removeItem(OAUTH_BIND_TRANSACTION_STORAGE_KEY);
}

function clearSocialBindPolling() {
  if (socialBindPollingTimer) {
    clearInterval(socialBindPollingTimer);
    socialBindPollingTimer = null;
  }
}

function closeSocialBindPopupWindow() {
  if (socialBindPopupWindow && !socialBindPopupWindow.closed) {
    socialBindPopupWindow.close();
  }
  socialBindPopupWindow = null;
}

function resetSocialBindState(options: { keepDialog?: boolean } = {}) {
  clearSocialBindPolling();
  socialBindPollingInFlight = false;
  socialBindSubmitting.value = false;
  socialBindExchanging.value = false;
  socialBindActivePlatform.value = null;
  socialBindActiveTransactionId.value = '';
  socialBindAuthorizeUrl.value = '';
  socialBindStatusMessage.value = '';
  socialBindErrorMessage.value = '';
  if (!options.keepDialog) {
    socialBindDialogOpen.value = false;
  }
  closeSocialBindPopupWindow();
}

async function loadSocialBindings() {
  try {
    loading.socialBindings = true;
    socialBindings.value = extractItems(await oauthService.getMyBindings())
      .map((binding) => normalizeSocialBinding(binding))
      .filter((binding): binding is SocialBindingItem => Boolean(binding));
  } catch (error: any) {
    socialBindings.value = [];
    message.error(error?.message || '加载第三方绑定列表失败');
  } finally {
    loading.socialBindings = false;
  }
}

async function loadSocialPlatforms() {
  try {
    loading.socialPlatforms = true;
    socialPlatforms.value = extractItems(
      await oauthService.getSupportedPlatforms(),
    )
      .map((platform) => normalizeSocialPlatform(platform))
      .filter((platform): platform is SocialPlatformItem => Boolean(platform));
  } catch (error: any) {
    socialPlatforms.value = [];
    message.error(error?.message || '加载可绑定平台失败');
  } finally {
    loading.socialPlatforms = false;
  }
}

function openSocialBindAuthorizeWindow(authorizeUrl: string) {
  const popup = window.open(
    authorizeUrl,
    'oauth-bind',
    'popup=yes,width=720,height=780,noopener=yes,noreferrer=yes',
  );
  if (popup) {
    socialBindPopupWindow = popup;
    socialBindStatusMessage.value = '已打开第三方授权窗口，请在新窗口完成账号绑定授权。';
    return;
  }

  socialBindStatusMessage.value = '浏览器拦截了弹窗，正在切换到整页绑定流程。';
  window.location.assign(authorizeUrl);
}

async function finishSocialBindTransaction(transactionId: string) {
  if (socialBindExchanging.value) {
    return;
  }
  socialBindExchanging.value = true;
  try {
    await oauthService.exchangeTransaction(transactionId);
    clearSocialBindResumeTransaction();
    resetSocialBindState();
    await Promise.all([loadSocialBindings(), authStore.fetchUserInfo()]);
    message.success('第三方账号绑定成功');
  } catch (error: any) {
    socialBindErrorMessage.value =
      error?.message || '完成第三方账号绑定失败，请稍后重试';
    socialBindStatusMessage.value = socialBindErrorMessage.value;
    message.error(socialBindErrorMessage.value);
  } finally {
    socialBindExchanging.value = false;
  }
}

async function pollSocialBindTransaction(transactionId: string) {
  if (socialBindPollingInFlight || socialBindExchanging.value) {
    return;
  }
  socialBindPollingInFlight = true;
  try {
    const transaction = resolveOAuthTransaction(
      await oauthService.getTransaction(transactionId),
    );
    const status = resolveOAuthTransactionStatus(transaction);
    const transactionMessage = String(
      transaction.message || transaction.errorMessage || '',
    ).trim();
    if (transactionMessage) {
      socialBindStatusMessage.value = transactionMessage;
    }
    if (['AUTHORIZED', 'COMPLETED', 'EXCHANGED'].includes(status)) {
      clearSocialBindPolling();
      await finishSocialBindTransaction(transactionId);
      return;
    }
    if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(status)) {
      clearSocialBindPolling();
      clearSocialBindResumeTransaction();
      socialBindErrorMessage.value =
        transactionMessage || '第三方账号绑定未完成，请重新发起';
      socialBindStatusMessage.value = socialBindErrorMessage.value;
      closeSocialBindPopupWindow();
      return;
    }
    if (
      socialBindPopupWindow?.closed &&
      !socialBindStatusMessage.value.includes('关闭')
    ) {
      socialBindStatusMessage.value =
        '授权窗口已关闭。如未完成绑定，可重新发起第三方账号绑定。';
    }
  } catch (error: any) {
    socialBindStatusMessage.value =
      error?.message || '获取绑定状态失败，正在重试...';
  } finally {
    socialBindPollingInFlight = false;
  }
}

function beginSocialBindPolling(transactionId: string) {
  clearSocialBindPolling();
  socialBindActiveTransactionId.value = transactionId;
  socialBindPollingTimer = setInterval(() => {
    void pollSocialBindTransaction(transactionId);
  }, OAUTH_BIND_POLL_INTERVAL_MS);
  void pollSocialBindTransaction(transactionId);
}

async function startSocialBinding(platform: SocialPlatformItem) {
  if (socialBindSubmitting.value) {
    return;
  }
  try {
    socialBindSubmitting.value = true;
    socialBindDialogOpen.value = true;
    socialBindErrorMessage.value = '';
    socialBindStatusMessage.value = '正在创建第三方账号绑定事务...';
    socialBindActivePlatform.value = platform;
    const transaction = resolveOAuthTransaction(
      await oauthService.createTransaction({
        callbackUrl: location.href,
        platform: platform.code,
        purpose: 'BIND' as OAuthBindingPurpose,
      }),
    );
    const transactionId = String(
      transaction.transactionId || transaction.id || '',
    ).trim();
    const authorizeUrl =
      resolveOAuthAuthorizeUrl(transaction) || platform.authUrl;
    if (!transactionId) {
      throw new Error('创建第三方账号绑定事务失败：缺少事务编号');
    }
    if (!authorizeUrl) {
      throw new Error('创建第三方账号绑定事务失败：缺少授权地址');
    }
    socialBindAuthorizeUrl.value = authorizeUrl;
    saveSocialBindResumeTransaction(transactionId, platform.code, authorizeUrl);
    beginSocialBindPolling(transactionId);
    openSocialBindAuthorizeWindow(authorizeUrl);
  } catch (error: any) {
    socialBindErrorMessage.value =
      error?.message || '发起第三方账号绑定失败，请稍后重试';
    socialBindStatusMessage.value = socialBindErrorMessage.value;
    message.error(socialBindErrorMessage.value);
  } finally {
    socialBindSubmitting.value = false;
  }
}

function confirmStartSocialBinding(platform: SocialPlatformItem) {
  Modal.confirm({
    title: `绑定${platform.displayName}`,
    content:
      '继续前请确认你已在近期完成密码或 MFA 二次验证。授权成功后，当前账号会绑定该第三方身份。',
    okText: '继续绑定',
    cancelText: '取消',
    async onOk() {
      await startSocialBinding(platform);
    },
  });
}

function cancelSocialBinding() {
  clearSocialBindResumeTransaction();
  resetSocialBindState();
}

function reopenSocialBindWindow() {
  if (socialBindAuthorizeUrl.value) {
    openSocialBindAuthorizeWindow(socialBindAuthorizeUrl.value);
  }
}

function resumeSocialBindingFromStorage() {
  const pendingTransaction = readSocialBindResumeTransaction();
  if (!pendingTransaction) {
    return;
  }
  socialBindDialogOpen.value = true;
  socialBindErrorMessage.value = '';
  socialBindStatusMessage.value = '正在恢复第三方账号绑定状态...';
  socialBindAuthorizeUrl.value = pendingTransaction.authorizeUrl;
  socialBindActivePlatform.value = socialPlatforms.value.find(
    (platform) => platform.code === pendingTransaction.platformCode,
  ) || {
    authUrl: pendingTransaction.authorizeUrl,
    code: pendingTransaction.platformCode,
    description: '',
    displayName: pendingTransaction.platformCode,
    iconUrl: '',
  };
  beginSocialBindPolling(pendingTransaction.transactionId);
}

function confirmUnbindSocialBinding(binding: SocialBindingItem) {
  Modal.confirm({
    title: `解除${binding.platformName}绑定`,
    content:
      '解绑前请确认你已在近期完成密码或 MFA 二次验证。若这是最后一种可用登录或恢复方式，后端会拒绝解绑。',
    okText: '确认解绑',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        loading[`unbind:${binding.id}`] = true;
        await oauthService.unbindBinding(binding.id);
        message.success(`${binding.platformName} 已解绑`);
        await Promise.all([loadSocialBindings(), authStore.fetchUserInfo()]);
      } finally {
        loading[`unbind:${binding.id}`] = false;
      }
    },
  });
}

onMounted(() => {
  void Promise.all([loadSocialBindings(), loadSocialPlatforms()]).finally(
    () => {
      resumeSocialBindingFromStorage();
    },
  );
});

onBeforeUnmount(() => {
  resetSocialBindState({ keepDialog: true });
});
</script>

<template>
  <div class="space-y-4">
    <Card size="small" title="第三方账号绑定" class="border-border border">
      <div class="space-y-4">
        <Alert
          show-icon
          type="info"
          message="绑定和解绑第三方账号前，请先完成近期密码或 MFA 二次验证。若后端判定当前账号缺少可用登录或恢复方式，会拒绝解绑。"
        />

        <div v-if="hasSocialPlatforms" class="space-y-2">
          <div class="text-foreground text-sm font-medium">可绑定平台</div>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="platform in socialPlatforms"
              :key="platform.code"
              :disabled="socialBindSubmitting"
              html-type="button"
              @click="confirmStartSocialBinding(platform)"
            >
              <span class="flex items-center gap-2">
                <img
                  v-if="platform.iconUrl"
                  :alt="`${platform.displayName} 图标`"
                  :src="platform.iconUrl"
                  class="size-4 rounded-sm object-cover"
                />
                <span>{{ platform.displayName }}</span>
              </span>
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-foreground text-sm font-medium">已绑定账号</div>
          <div
            v-if="hasSocialBindings"
            class="grid grid-cols-1 gap-3 xl:grid-cols-2"
          >
            <div
              v-for="binding in socialBindings"
              :key="binding.id"
              class="border-border bg-background rounded-lg border p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-foreground font-medium">
                    {{ binding.platformName }}
                  </div>
                  <div class="text-muted-foreground mt-1 break-all text-sm">
                    {{ binding.accountText }}
                  </div>
                  <div
                    v-if="binding.boundAt"
                    class="text-muted-foreground mt-2 text-xs"
                  >
                    绑定时间：{{ binding.boundAt }}
                  </div>
                  <div
                    v-if="binding.lastLoginAt"
                    class="text-muted-foreground mt-1 text-xs"
                  >
                    最近登录：{{ binding.lastLoginAt }}
                  </div>
                </div>
                <Button
                  danger
                  :disabled="!binding.canUnbind"
                  :loading="loading[`unbind:${binding.id}`]"
                  @click="confirmUnbindSocialBinding(binding)"
                >
                  解绑
                </Button>
              </div>
            </div>
          </div>
          <div
            v-else
            class="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-sm"
            data-test="empty-social-bindings"
          >
            暂未绑定第三方账号。
          </div>
        </div>
      </div>
    </Card>

    <Modal
      :cancel-text="'取消'"
      :confirm-loading="socialBindSubmitting || socialBindExchanging"
      :mask-closable="false"
      :ok-button-props="{ disabled: !socialBindAuthorizeUrl }"
      :ok-text="'重新打开授权窗口'"
      :open="socialBindDialogOpen"
      :title="`绑定第三方账号${socialBindActivePlatform?.displayName ? ` - ${socialBindActivePlatform.displayName}` : ''}`"
      centered
      destroy-on-close
      @cancel="cancelSocialBinding"
      @ok="reopenSocialBindWindow"
      @update:open="(open) => !open && cancelSocialBinding()"
    >
      <div class="space-y-3">
        <Alert
          :message="
            socialBindErrorMessage ||
            socialBindStatusMessage ||
            '请在新窗口完成第三方账号授权，当前页面会自动完成绑定。'
          "
          show-icon
          :type="socialBindErrorMessage ? 'warning' : 'info'"
        />
        <div class="bg-muted/30 rounded-md px-3 py-2 text-sm">
          <div class="text-foreground font-medium">
            {{ socialBindActivePlatform?.displayName || '第三方账号绑定' }}
          </div>
          <div
            v-if="socialBindActiveTransactionId"
            class="text-muted-foreground mt-1 break-all"
            data-test="social-bind-transaction-id"
          >
            事务号：{{ socialBindActiveTransactionId }}
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>
