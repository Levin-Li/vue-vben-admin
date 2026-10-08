import type { LocationQuery } from 'vue-router';

import type { OAuthCallbackParams } from '../../../api/oauth-service';

interface BindCallback {
  error?: boolean;
  expiresAt?: number;
  inApp: boolean;
  params: OAuthCallbackParams;
  transactionId: string;
}

const BIND_CALLBACK_QUERY_KEYS = [
  'oauthTransaction',
  'oauthInAppCode',
  'oauthInAppState',
  'oauthBindCallback',
  'oauthError',
];

// 同步清理路由对象，避免 createWebHistory 在初始化后把已删除的查询参数回填。
export function stripBindCallbackQuery(query: LocationQuery): LocationQuery {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([key]) => !BIND_CALLBACK_QUERY_KEYS.includes(key),
    ),
  );
}

// 在加载用户信息或发出网络请求前从 URL 取出并立即删除短期 code。
export function consumeBindCallback(
  href: string,
  replace: (url: string) => void,
): BindCallback | null {
  const url = new URL(href);
  const query = url.searchParams;
  const inApp = query.has('oauthInAppCode') || query.has('oauthInAppState');
  if (!inApp && !query.has('oauthBindCallback') && !query.has('oauthError'))
    return null;
  const transactionId = query.get('oauthTransaction') || '';
  const raw = query.get('oauthBindCallback');
  const code = query.get('oauthInAppCode') || '';
  const state = query.get('oauthInAppState') || '';
  const failed = query.has('oauthError');
  for (const key of BIND_CALLBACK_QUERY_KEYS) query.delete(key);
  replace(url.toString());
  const invalid = { error: true, inApp, params: { state: '' }, transactionId };
  if (failed || !transactionId) return invalid;
  if (inApp)
    return code && state
      ? { inApp, params: { code, state }, transactionId }
      : invalid;
  try {
    const decoded: unknown = JSON.parse(raw || '');
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded))
      return invalid;
    const fields = decoded as Record<string, unknown>;
    const params: OAuthCallbackParams = { state: '' };
    for (const key of [
      'state',
      'code',
      'auth_code',
      'authorization_code',
      'oauth_token',
      'oauth_verifier',
    ] as const) {
      if (typeof fields[key] === 'string') params[key] = fields[key];
    }
    return params.state &&
      (params.code ||
        params.auth_code ||
        params.authorization_code ||
        (params.oauth_token && params.oauth_verifier))
      ? { inApp, params, transactionId }
      : invalid;
  } catch {
    return invalid;
  }
}

// 启动阶段先清 URL；只在模块内存保存一次，避免路由与个人中心弹窗尚未挂载时丢失回调。
const CALLBACK_MEMORY_TTL_MS = 3 * 60 * 1000;
let callbackExpiryTimer: ReturnType<typeof setTimeout> | undefined;
let pendingCallback: null | { callback: BindCallback; expiresAt: number } =
  null;

export function captureBindCallbackBeforeStartup(
  href = location.href,
  replace: (url: string) => void = (url) =>
    window.history.replaceState(window.history.state, '', url),
): boolean {
  // 普通 LOGIN 的 oauthError 仍交给登录页，只有绑定桥接参数进入全局恢复。
  const query = new URL(href).searchParams;
  if (
    !query.has('oauthInAppCode') &&
    !query.has('oauthInAppState') &&
    !query.has('oauthBindCallback')
  )
    return false;
  const callback = consumeBindCallback(href, replace);
  if (!callback) return false;
  clearPendingBindCallback();
  pendingCallback = {
    callback,
    expiresAt: Date.now() + CALLBACK_MEMORY_TTL_MS,
  };
  callbackExpiryTimer = setTimeout(
    expirePendingCallback,
    CALLBACK_MEMORY_TTL_MS,
  );
  return true;
}

function expirePendingCallback() {
  if (pendingCallback && pendingCallback.expiresAt <= Date.now()) {
    // 过期立即抹掉 code，只保留让用户重新发起的错误状态。
    pendingCallback.callback = {
      error: true,
      inApp: pendingCallback.callback.inApp,
      params: { state: '' },
      transactionId: pendingCallback.callback.transactionId,
    };
  }
}

export function hasPendingBindCallback(): boolean {
  expirePendingCallback();
  return pendingCallback !== null;
}

export function takePendingBindCallback(): BindCallback | null {
  expirePendingCallback();
  const callback = pendingCallback
    ? { ...pendingCallback.callback, expiresAt: pendingCallback.expiresAt }
    : null;
  clearPendingBindCallback();
  return callback;
}

export function clearPendingBindCallback(): void {
  if (callbackExpiryTimer) clearTimeout(callbackExpiryTimer);
  callbackExpiryTimer = undefined;
  pendingCallback = null;
}

// 内存恢复不能跳过当前 URL 清理；不同事务或 state/code 一律拒绝，不能混用。
export function recoverBindCallbackForPage(
  href: string,
  replace: (url: string) => void,
): BindCallback | null {
  const cached = takePendingBindCallback();
  const current = consumeBindCallback(href, replace);
  if (!cached) return current;
  if (!current) return cached;
  const fields = [
    'state',
    'code',
    'auth_code',
    'authorization_code',
    'oauth_token',
    'oauth_verifier',
  ] as const;
  const matches =
    cached.transactionId === current.transactionId &&
    cached.inApp === current.inApp &&
    fields.every(
      (key) => (cached.params[key] || '') === (current.params[key] || ''),
    );
  if (!matches || current.error) {
    cached.params = { state: '' };
    current.params = { state: '' };
    return { ...cached, error: true };
  }
  current.params = { state: '' };
  return cached;
}
